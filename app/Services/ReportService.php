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
            $query->where('created_at', '>=', CarbonImmutable::parse($filters['from'], 'Asia/Manila')->startOfDay()->utc());
        }
        if (! empty($filters['to'])) {
            $query->where('created_at', '<', CarbonImmutable::parse($filters['to'], 'Asia/Manila')->addDay()->startOfDay()->utc());
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
        $eventSales = (float) $this->eventSales($filters)->sum('amount');
        $discounts = (float) (clone $valid)->sum('discount');
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
        foreach ($this->eventSales($filters)->selectRaw($this->dateSql().' as day, SUM(amount) as amount')->groupByRaw($this->dateSql())->get() as $event) {
            $row = $merged->get($event->day, ['day' => $event->day, 'orders' => 0, 'sales' => 0]);
            $row['sales'] = round($row['sales'] + (float) $event->amount, 2);
            $merged->put($event->day, $row);
        }

        return $merged->sortKeys()->values()->all();
    }

    public function reports(array $filters): array
    {
        $q = $this->orders($filters);
        $valid = (clone $q)->whereNotIn('status', ['Cancelled', 'Refunded']);
        $eventQuery = $this->eventSales($filters);
        $eventSalesTotal = (float) (clone $eventQuery)->sum('amount');
        $eventSalesCount = (clone $eventQuery)->count();
        $events = (clone $eventQuery)->orderByDesc('created_at')->limit(500)->get(['id', 'event_name', 'amount', 'created_at']);
        $eventByDay = (clone $eventQuery)->selectRaw($this->dateSql().' as day, SUM(amount) as amount')->groupByRaw($this->dateSql())->get()->pluck('amount', 'day');
        $daily = (clone $q)->selectRaw($this->dateSql()." as day, COUNT(*) as orders, SUM(total) as gross, SUM(discount) as discounts, SUM(CASE WHEN status='Refunded' THEN total ELSE 0 END) as refunds, SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as cancelled, SUM(CASE WHEN status='Cancelled' THEN total ELSE 0 END) as cancelled_amount")->groupByRaw($this->dateSql())->orderBy('day')->get()->mapWithKeys(fn ($r) => [$r->day => [$r->day, $r->orders, $this->money($r->gross + ($eventByDay[$r->day] ?? 0)), $this->money($r->discounts), $this->money($r->refunds), $r->cancelled, $this->money($r->cancelled_amount), $this->money($r->gross - $r->refunds - $r->cancelled_amount + ($eventByDay[$r->day] ?? 0)), $this->money($eventByDay[$r->day] ?? 0)]]);
        foreach ($eventByDay as $day => $amount) {
            if (! $daily->has($day)) {
                $daily->put($day, [$day, 0, $this->money($amount), $this->money(0), $this->money(0), 0, $this->money(0), $this->money($amount), $this->money($amount)]);
            }
        }
        $daily = $daily->sortKeys()->values();
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
            $payments->push(['Event sales', 0, $this->money($eventSalesTotal)]);
        }

        return ['validCount' => (clone $valid)->count(), 'eventSalesTotal' => $eventSalesTotal, 'eventSalesCount' => $eventSalesCount, 'eventSales' => $events->map(fn ($event) => [$event->created_at->setTimezone('Asia/Manila')->format('Y-m-d g:i A'), $event->event_name, $this->money($event->amount)]), 'daily' => $daily, 'payments' => $payments, 'productSales' => $products, 'categorySales' => $categories, 'consumption' => $consumption, 'foodCost' => $costs, 'methods' => $this->orders([])->select('payment_method')->distinct()->pluck('payment_method')];
    }
}
