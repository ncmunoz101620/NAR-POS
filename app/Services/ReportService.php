<?php

namespace App\Services;

use App\Models\Ingredient;
use App\Models\EventSale;
use App\Models\InventoryTransaction;
use App\Models\Order;
use App\Models\Product;
use App\Models\Recipe;
use App\Models\StockLedger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class ReportService
{
    public function ingredientLedger(string $ingredientId, string $branch, ?string $from, ?string $to, int $page = 1, int $perPage = 50): array
    {
        $ingredient = Ingredient::whereNull('deleted_at')->findOrFail($ingredientId);
        $current = (int) round((float) StockLedger::where('item_id', $ingredientId)
            ->where('item_type', 'Production')->where('branch', $branch)->value('current_stock') * 1000);
        $movements = InventoryTransaction::where('ingredient_id', $ingredientId)
            ->where('ingredient_type', 'Production')->where('branch', $branch);
        $fromUtc = $from ? CarbonImmutable::parse($from, 'Asia/Manila')->startOfDay()->utc() : null;
        $toUtc = $to ? CarbonImmutable::parse($to, 'Asia/Manila')->addDay()->startOfDay()->utc() : null;

        // Reconcile journal history with the current ledger so imported opening stock is retained.
        $sinceOpening = clone $movements;
        if ($fromUtc) {
            $sinceOpening->where('created_at', '>=', $fromUtc);
        }
        $opening = $current - (int) round((float) $sinceOpening->sum('quantity') * 1000);

        $period = clone $movements;
        if ($fromUtc) {
            $period->where('created_at', '>=', $fromUtc);
        }
        if ($toUtc) {
            $period->where('created_at', '<', $toUtc);
        }
        $totals = (clone $period)->selectRaw("COALESCE(SUM(CASE WHEN type = 'Stock In' THEN quantity ELSE 0 END), 0) AS stock_in")
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'Sales Consumption' THEN -quantity ELSE 0 END), 0) AS consumed")
            ->selectRaw("COALESCE(SUM(CASE WHEN type NOT IN ('Stock In', 'Sales Consumption') THEN quantity ELSE 0 END), 0) AS other")
            ->selectRaw('COALESCE(SUM(quantity), 0) AS net')->first();
        $stockIn = (int) round((float) $totals->stock_in * 1000);
        $consumed = (int) round((float) $totals->consumed * 1000);
        $other = (int) round((float) $totals->other * 1000);
        $net = (int) round((float) $totals->net * 1000);
        $total = (clone $period)->count();
        $pages = max(1, (int) ceil($total / $perPage));
        $page = min($page, $pages);
        $rows = (clone $period)->orderBy('created_at')->orderBy('id')
            ->forPage($page, $perPage)->get();
        $beforePage = 0;
        if ($rows->isNotEmpty()) {
            $first = $rows->first();
            $beforePage = (int) round((float) (clone $period)
                ->where(fn ($query) => $query->where('created_at', '<', $first->created_at)
                    ->orWhere(fn ($sameTime) => $sameTime->where('created_at', $first->created_at)->where('id', '<', $first->id)))
                ->sum('quantity') * 1000);
        }
        $balance = $opening + $beforePage;

        return [
            'ingredient' => ['id' => $ingredient->id, 'name' => $ingredient->name, 'unit' => $ingredient->unit],
            'branch' => $branch, 'from' => $from, 'to' => $to,
            'opening' => $opening / 1000, 'stockIn' => $stockIn / 1000,
            'consumed' => $consumed / 1000, 'other' => $other / 1000,
            'closing' => ($opening + $net) / 1000,
            'total' => $total, 'page' => $page, 'pages' => $pages,
            'rows' => $rows->map(function ($movement) use (&$balance) {
                $quantity = (int) round($movement->quantity * 1000);
                $balance += $quantity;

                return [
                    'id' => $movement->id, 'at' => $movement->created_at->toISOString(),
                    'type' => $movement->type, 'quantity' => $quantity / 1000,
                    'stockIn' => $movement->type === 'Stock In' ? $quantity / 1000 : 0,
                    'consumed' => $movement->type === 'Sales Consumption' ? -$quantity / 1000 : 0,
                    'other' => in_array($movement->type, ['Stock In', 'Sales Consumption'], true) ? 0 : $quantity / 1000,
                    'balance' => $balance / 1000, 'reference' => $movement->reference,
                    'notes' => $movement->notes, 'user' => $movement->user_name,
                ];
            })->all(),
        ];
    }

    public function inventorySummary(array $filters): array
    {
        $moves = $this->scope(InventoryTransaction::query(), $filters)->where('ingredient_type', 'Production')->select('ingredient_id')->selectRaw('SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as total_in, SUM(CASE WHEN quantity < 0 THEN -quantity ELSE 0 END) as total_out')->groupBy('ingredient_id')->get()->keyBy('ingredient_id');
        $stock = Access::scope(StockLedger::query())->where('item_type', 'Production')->select('item_id')->selectRaw('SUM(current_stock) as balance')->groupBy('item_id')->pluck('balance', 'item_id');

        return Ingredient::whereNull('deleted_at')->orderBy('name')->get()->map(fn ($ing) => [
            'id' => $ing->id, 'name' => $ing->name, 'unit' => $ing->unit, 'cost_per_unit' => $ing->cost_per_unit,
            'current_stock' => (float) ($stock[$ing->id] ?? 0), 'totalIn' => (float) ($moves->get($ing->id)?->total_in ?? 0), 'totalOut' => (float) ($moves->get($ing->id)?->total_out ?? 0),
        ])->all();
    }

    private function scope($query, array $filters, string $date = 'created_at')
    {
        Access::scope($query);
        if (! empty($filters['branch']) && $filters['branch'] !== 'all') {
            $query->where('branch', $filters['branch']);
        }
        if (! empty($filters['from'])) {
            $query->where($date, '>=', CarbonImmutable::parse($filters['from'], 'Asia/Manila')->startOfDay()->utc());
        }
        if (! empty($filters['to'])) {
            $query->where($date, '<', CarbonImmutable::parse($filters['to'], 'Asia/Manila')->addDay()->startOfDay()->utc());
        }

        return $query;
    }

    private function orders(array $filters)
    {
        $q = $this->scope(Order::without(['items', 'status_history'])->whereNull('deleted_at'), $filters);
        if (! empty($filters['method']) && $filters['method'] !== 'all') {
            $q->where('payment_method', $filters['method']);
        }

        return $q;
    }

    private function eventSales(array $filters)
    {
        $assigned = Access::profile(auth()->user())?->branch;
        if ($assigned !== 'All' || ! in_array($filters['branch'] ?? 'all', ['all', ''], true) || ! in_array($filters['method'] ?? 'all', ['all', ''], true)) {
            return EventSale::query()->whereRaw('1 = 0');
        }
        $query = EventSale::query();
        if (! empty($filters['from'])) {
            $query->where('event_date', '>=', $filters['from']);
        }
        if (! empty($filters['to'])) {
            $query->where('event_date', '<=', $filters['to']);
        }

        return $query;
    }

    private function dateSql(): string
    {
        return DB::getDriverName() === 'sqlite' ? "date(created_at, '+8 hours')" : 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
    }

    private function money($n): string
    {
        return '₱'.number_format((float) $n, 2);
    }

    public function dashboard(array $filters): array
    {
        $q = $this->orders($filters);
        $valid = (clone $q)->whereNotIn('status', ['Cancelled', 'Refunded']);
        $count = (clone $valid)->count();
        $sales = (float) (clone $valid)->sum('total');
        $eventGross = (float) $this->eventSales($filters)->sum('gross_sales');
        $eventDiscount = (float) $this->eventSales($filters)->sum('discount');
        $eventSales = round($eventGross - $eventDiscount, 2);
        $discounts = (float) (clone $valid)->sum('discount') + $eventDiscount;
        // Stored totals already include discounts, delivery fees and tax.
        $grossSales = round($sales + $eventSales + $discounts, 2);
        $groups = fn ($column) => (clone $q)->select($column.' as name')->selectRaw('COUNT(*) as value')->groupBy($column)->get()->toArray();
        $byStatus = $groups('status');

        return ['sales' => round($sales + $eventSales, 2), 'eventSales' => $eventSales, 'grossSales' => $grossSales, 'discounts' => $discounts, 'netSales' => round($sales + $eventSales, 2), 'avg' => $count ? $sales / $count : 0, 'validCount' => $count, 'orderCount' => (clone $q)->count(), 'productCount' => Product::whereNull('deleted_at')->count(), 'lowStockCount' => Access::scope(StockLedger::query())->whereColumn('current_stock', '<=', 'min_stock')->count(),
            'lowStock' => Access::scope(StockLedger::query())->whereColumn('current_stock', '<=', 'min_stock')->limit(20)->get()->map(fn ($r) => ['id' => $r->id, 'name' => $r->item_name.' · '.$r->branch, 'current_stock' => $r->current_stock, 'unit' => $r->unit]),
            'byStatus' => $byStatus, 'bySource' => $groups('customer_source'),
            'byPayment' => (clone $valid)->select('payment_method')->selectRaw('SUM(total) as amount')->groupBy('payment_method')->orderByDesc('amount')->get()->map(fn ($r) => [$r->payment_method, (float) $r->amount]),
            'byDay' => $this->mergeEventDays((clone $q)->selectRaw($this->dateSql()." as day, COUNT(*) as orders, SUM(CASE WHEN status NOT IN ('Cancelled','Refunded') THEN total ELSE 0 END) as sales")->groupByRaw($this->dateSql())->orderBy('day')->get()->map(fn ($row) => [
                'day' => $row->day, 'orders' => (int) $row->orders, 'sales' => (float) $row->sales,
            ])->all(), $filters),
        ];
    }

    private function mergeEventDays(array $days, array $filters): array
    {
        $merged = collect($days)->keyBy('day');
        foreach ($this->eventSales($filters)->selectRaw('event_date as day, SUM(gross_sales - discount) as net_sales')->groupBy('event_date')->get() as $event) {
            $row = $merged->get($event->day, ['day' => $event->day, 'orders' => 0, 'sales' => 0]);
            $row['sales'] = round($row['sales'] + (float) $event->net_sales, 2);
            $merged->put($event->day, $row);
        }

        return $merged->sortKeys()->values()->all();
    }

    public function reports(array $filters): array
    {
        $q = $this->orders($filters);
        $valid = (clone $q)->whereNotIn('status', ['Cancelled', 'Refunded']);
        $eventQuery = $this->eventSales($filters);
        $eventGrossTotal = (float) (clone $eventQuery)->sum('gross_sales');
        $eventDiscountTotal = (float) (clone $eventQuery)->sum('discount');
        $eventNetTotal = round($eventGrossTotal - $eventDiscountTotal, 2);
        $eventSalesCount = (clone $eventQuery)->count();
        $events = (clone $eventQuery)->orderByDesc('event_date')->orderByDesc('created_at')->limit(500)->get(['id', 'event_name', 'event_date', 'gross_sales', 'discount', 'created_at']);
        $eventByDay = (clone $eventQuery)->selectRaw('event_date as day, SUM(gross_sales) as gross, SUM(discount) as discounts')->groupBy('event_date')->get()->keyBy('day');
        $daily = (clone $q)->selectRaw($this->dateSql()." as day, COUNT(*) as orders, SUM(CASE WHEN status NOT IN ('Cancelled','Refunded') THEN total + discount ELSE 0 END) as gross, SUM(CASE WHEN status NOT IN ('Cancelled','Refunded') THEN discount ELSE 0 END) as discounts, SUM(CASE WHEN status='Refunded' THEN total ELSE 0 END) as refunds, SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as cancelled, SUM(CASE WHEN status='Cancelled' THEN total ELSE 0 END) as cancelled_amount")->groupByRaw($this->dateSql())->orderBy('day')->get()->mapWithKeys(function ($r) use ($eventByDay) {
            $event = $eventByDay->get($r->day);
            $eventGross = (float) ($event?->gross ?? 0);
            $eventDiscount = (float) ($event?->discounts ?? 0);
            $net = (float) $r->gross - (float) $r->discounts + $eventGross - $eventDiscount;

            return [$r->day => [$r->day, $r->orders, $this->money($r->gross + $eventGross), $this->money($r->discounts + $eventDiscount), $this->money($r->refunds), $r->cancelled, $this->money($r->cancelled_amount), $this->money($net), $this->money($eventGross - $eventDiscount)]];
        });
        foreach ($eventByDay as $day => $event) {
            if (! $daily->has($day)) {
                $net = (float) $event->gross - (float) $event->discounts;
                $daily->put($day, [$day, 0, $this->money($event->gross), $this->money($event->discounts), $this->money(0), 0, $this->money(0), $this->money($net), $this->money($net)]);
            }
        }
        $daily = $daily->sortKeys()->values();
        $orderTotals = (clone $q)->selectRaw("COUNT(*) as orders, SUM(CASE WHEN status NOT IN ('Cancelled','Refunded') THEN total ELSE 0 END) as net_sales, SUM(CASE WHEN status NOT IN ('Cancelled','Refunded') THEN discount ELSE 0 END) as discounts, SUM(CASE WHEN status='Refunded' THEN total ELSE 0 END) as refunds, SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as cancelled, SUM(CASE WHEN status='Cancelled' THEN total ELSE 0 END) as cancelled_amount")->first();
        $orderNet = (float) ($orderTotals?->net_sales ?? 0);
        $orderDiscount = (float) ($orderTotals?->discounts ?? 0);
        $dailyTotals = [
            'Total', (int) ($orderTotals?->orders ?? 0),
            $this->money($orderNet + $orderDiscount + $eventGrossTotal),
            $this->money($orderDiscount + $eventDiscountTotal),
            $this->money($orderTotals?->refunds ?? 0),
            (int) ($orderTotals?->cancelled ?? 0),
            $this->money($orderTotals?->cancelled_amount ?? 0),
            $this->money($orderNet + $eventNetTotal),
            $this->money($eventNetTotal),
        ];
        $paymentGroups = (clone $valid)->select('payment_method', 'gcash_type')->selectRaw('COUNT(*) as count, SUM(total) as amount')->groupBy('payment_method', 'gcash_type')->get();
        $payments = $paymentGroups->groupBy(function ($row) {
            $method = trim($row->payment_method ?? '');
            if (strcasecmp($method, 'GCash') === 0 && trim($row->gcash_type ?? '') !== '') {
                return 'GCash ('.trim($row->gcash_type).')';
            }

            return strcasecmp($method, 'GRAB') === 0 ? 'GRAB' : $method;
        })->map(fn ($rows, $label) => [$label, (int) $rows->sum('count'), $this->money($rows->sum('amount'))])->values();
        $items = DB::table('order_items')->whereIn('order_id', (clone $valid)->select('id'));
        $products = (clone $items)->select('product_name', 'variant_name')->selectRaw('SUM(quantity) as qty, SUM(subtotal) as revenue')->groupBy('product_name', 'variant_name')->orderByDesc('qty')->get()->map(fn ($r) => [$r->product_name, $r->variant_name, $r->qty, $this->money($r->revenue)]);
        $categories = (clone $items)->leftJoin('products', 'products.id', '=', 'order_items.product_id')->leftJoin('categories', 'categories.id', '=', 'products.category_id')->select('categories.name')->selectRaw('SUM(quantity) as qty, SUM(subtotal) as revenue')->groupBy('categories.name')->get()->map(fn ($r) => [$r->name ?? 'Uncategorized', $r->qty, $this->money($r->revenue)]);
        $consumption = [];
        $tx = $this->scope(InventoryTransaction::query(), $filters)->where('ingredient_type', 'Production')->select('ingredient_id', 'type')->selectRaw('SUM(quantity) as qty')->groupBy('ingredient_id', 'type')->get()->groupBy('ingredient_id');
        $stock = $this->scope(StockLedger::query(), array_intersect_key($filters, ['branch' => true]))->where('item_type', 'Production')->select('item_id')->selectRaw('SUM(current_stock) as stock')->groupBy('item_id')->pluck('stock', 'item_id');
        foreach (Ingredient::whereNull('deleted_at')->get() as $ing) {
            $moves = $tx->get($ing->id, collect());
            $sum = fn ($type) => (float) $moves->where('type', $type)->sum('qty');
            $ending = (float) ($stock[$ing->id] ?? 0);
            // Remove movements after the reporting end to obtain historical ending stock.
            if (! empty($filters['to'])) {
                $ending -= (float) $this->scope(InventoryTransaction::query(), ['branch' => $filters['branch'] ?? 'all'])->where('ingredient_id', $ing->id)->where('ingredient_type', 'Production')->where('created_at', '>=', CarbonImmutable::parse($filters['to'], 'Asia/Manila')->addDay()->startOfDay()->utc())->sum('quantity');
            }
            $beginning = $ending - (float) $moves->sum('qty');
            $consumption[] = [$ing->name, round($beginning, 3).' '.$ing->unit, $sum('Stock In'), abs($sum('Sales Consumption')), abs($sum('Waste')), $sum('Adjustment') + $sum('Correction'), round($ending, 3).' '.$ing->unit];
        }
        $costs = [];
        $recipes = Recipe::with('items.ingredient')->get();
        foreach (Product::whereNull('deleted_at')->with('variants')->get() as $p) {
            foreach ($p->variants as $v) {
                $recipe = $recipes->first(fn ($r) => $r->product_id === $p->id && $r->variant_name === $v->name);
                $cost = $recipe?->items->sum(fn ($i) => $i->quantity * ($i->ingredient?->cost_per_unit ?? 0)) ?? 0;
                $profit = $v->price - $cost;
                $costs[] = [$p->name, $v->name, $this->money($v->price), $this->money($cost), $this->money($profit), ($v->price ? number_format($profit / $v->price * 100, 1) : 0).'%'];
            }
        }

        if ($eventSalesCount > 0) {
            $payments->push(['Event sales', 0, $this->money($eventNetTotal)]);
        }

        return ['validCount' => (clone $valid)->count(), 'dailyTotals' => $dailyTotals, 'eventSalesTotal' => $eventNetTotal, 'eventGrossTotal' => $eventGrossTotal, 'eventDiscountTotal' => $eventDiscountTotal, 'eventNetTotal' => $eventNetTotal, 'eventSalesCount' => $eventSalesCount, 'eventSales' => $events->map(fn ($event) => [$event->event_date, $event->event_name, $event->created_at->setTimezone('Asia/Manila')->format('Y-m-d g:i A'), $this->money($event->gross_sales), $this->money($event->discount), $this->money((float) $event->gross_sales - (float) $event->discount)]), 'daily' => $daily, 'payments' => $payments, 'productSales' => $products, 'categorySales' => $categories, 'consumption' => $consumption, 'foodCost' => $costs, 'methods' => $this->orders([])->select('payment_method')->distinct()->pluck('payment_method')];
    }
}
