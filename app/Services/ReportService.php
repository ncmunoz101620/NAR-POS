<?php

namespace App\Services;

use App\Models\Ingredient;
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
        $groups = fn ($column) => (clone $q)->select($column.' as name')->selectRaw('COUNT(*) as value')->groupBy($column)->get()->toArray();
        $byStatus = $groups('status');

        return ['sales' => $sales, 'avg' => $count ? $sales / $count : 0, 'validCount' => $count, 'orderCount' => (clone $q)->count(), 'productCount' => Product::whereNull('deleted_at')->count(), 'lowStockCount' => Access::scope(StockLedger::query())->whereColumn('current_stock', '<=', 'min_stock')->count(),
            'lowStock' => Access::scope(StockLedger::query())->whereColumn('current_stock', '<=', 'min_stock')->limit(20)->get()->map(fn ($r) => ['id' => $r->id, 'name' => $r->item_name.' · '.$r->branch, 'current_stock' => $r->current_stock, 'unit' => $r->unit]),
            'byStatus' => $byStatus, 'bySource' => $groups('customer_source'),
            'byPayment' => (clone $valid)->select('payment_method')->selectRaw('SUM(total) as amount')->groupBy('payment_method')->orderByDesc('amount')->get()->map(fn ($r) => [$r->payment_method, (float) $r->amount]),
            'byDay' => (clone $q)->selectRaw($this->dateSql()." as day, COUNT(*) as orders, SUM(CASE WHEN status NOT IN ('Cancelled','Refunded') THEN total ELSE 0 END) as sales")->groupByRaw($this->dateSql())->orderBy('day')->get(),
        ];
    }

    public function reports(array $filters): array
    {
        $q = $this->orders($filters);
        $valid = (clone $q)->whereNotIn('status', ['Cancelled', 'Refunded']);
        $daily = (clone $q)->selectRaw($this->dateSql()." as day, COUNT(*) as orders, SUM(total) as gross, SUM(discount) as discounts, SUM(CASE WHEN status='Refunded' THEN total ELSE 0 END) as refunds, SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) as cancelled, SUM(CASE WHEN status='Cancelled' THEN total ELSE 0 END) as cancelled_amount")->groupByRaw($this->dateSql())->orderBy('day')->get()->map(fn ($r) => [$r->day, $r->orders, $this->money($r->gross), $this->money($r->discounts), $this->money($r->refunds), $r->cancelled, $this->money($r->cancelled_amount), $this->money($r->gross - $r->refunds - $r->cancelled_amount)]);
        $payments = (clone $valid)->select('payment_method', 'gcash_type')->selectRaw('COUNT(*) as count, SUM(total) as amount')->groupBy('payment_method', 'gcash_type')->get()->map(fn ($r) => [strtolower($r->payment_method ?? '') === 'gcash' && $r->gcash_type ? 'GCash ('.$r->gcash_type.')' : $r->payment_method, $r->count, $this->money($r->amount)]);
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

        return ['validCount' => (clone $valid)->count(), 'daily' => $daily, 'payments' => $payments, 'productSales' => $products, 'categorySales' => $categories, 'consumption' => $consumption, 'foodCost' => $costs, 'methods' => $this->orders([])->select('payment_method')->distinct()->pluck('payment_method')];
    }
}
