<?php

namespace App\Services;

use App\Models\Ingredient;
use App\Models\InventoryTransaction;
use App\Models\Order;
use App\Models\RawMaterial;
use App\Models\Recipe;
use App\Models\StockLedger;
use App\Models\StockTransfer;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public const BRANCHES = ['NAR Commi', 'NAR Greenwoods'];

    public function item(string $id, string $type)
    {
        return ($type === 'Raw' ? RawMaterial::class : Ingredient::class)::whereNull('deleted_at')->findOrFail($id);
    }

    public function ensureRows($item, string $type): void
    {
        foreach (self::BRANCHES as $branch) {
            $row = StockLedger::firstOrNew(['item_id' => $item->id, 'item_type' => $type, 'branch' => $branch]);
            if ($row->exists) {
                continue;
            }
            $row->fill(['item_name' => $item->name, 'unit' => $item->unit, 'min_stock' => $item->min_stock ?? 0, 'current_stock' => 0]);
            $row->{$type === 'Raw' ? 'raw_material_id' : 'production_id'} = $item->id;
            $row->save();
        }
    }

    public function recordTransaction($item, string $type, string $branch, string $movement, float $delta, string $reference = '', string $notes = '', ?Order $order = null, ?string $reversal = null): InventoryTransaction
    {
        $tx = new InventoryTransaction(['ingredient_id' => $item->id, 'ingredient_name' => $item->name, 'ingredient_type' => $type, 'branch' => $branch, 'type' => $movement, 'quantity' => $delta, 'unit' => $item->unit, 'reference' => $reference, 'notes' => $notes, 'user_name' => auth()->user()?->name ?? 'System']);
        $tx->{$type === 'Raw' ? 'raw_material_id' : 'production_id'} = $item->id;
        $tx->order_id = $order?->id;
        $tx->reversal_of = $reversal;
        $tx->save();

        return $tx;
    }

    public function adjustStock(string $id, string $type, string $branch, float $delta, string $movement = 'Adjustment', string $reference = '', string $notes = '', ?Order $order = null, ?string $reversal = null): StockLedger
    {
        return DB::transaction(function () use ($id, $type, $branch, $delta, $movement, $reference, $notes, $order, $reversal) {
            // Lock the item first, consistently across receives, transfers and order deductions.
            $class = $type === 'Raw' ? RawMaterial::class : Ingredient::class;
            $item = $class::lockForUpdate()->findOrFail($id);
            $this->ensureRows($item, $type);
            $row = StockLedger::where(['item_id' => $id, 'item_type' => $type, 'branch' => $branch])->lockForUpdate()->firstOrFail();
            $next = (int) round($row->current_stock * 1000) + (int) round($delta * 1000);
            if ($next < 0) {
                throw ValidationException::withMessages(['quantity' => "Insufficient {$item->name} stock in {$branch}."]);
            }
            $row->current_stock = $next / 1000;
            $row->save();
            $this->recordTransaction($item, $type, $branch, $movement, $delta, $reference, $notes, $order, $reversal);
            $item->current_stock = StockLedger::where(['item_id' => $id, 'item_type' => $type])->sum('current_stock');
            $item->save();

            return $row;
        }, 3);
    }

    public function receiveStock(string $id, string $type, string $branch, float $quantity): StockLedger
    {
        return $this->adjustStock($id, $type, $branch, abs($quantity), 'Stock In');
    }

    public function calculateAvailableStock(string $id, string $type, string $branch): float
    {
        return (float) StockLedger::where(['item_id' => $id, 'item_type' => $type, 'branch' => $branch])->value('current_stock');
    }

    public function requirements(array $items): array
    {
        $recipes = Recipe::with('items')->whereIn('product_id', array_column($items, 'product_id'))->get();
        $needs = [];
        foreach ($items as $item) {
            $recipe = $recipes->first(fn ($r) => $r->product_id === $item['product_id'] && $r->variant_name === $item['variant_name']);
            foreach ($recipe?->items ?? [] as $line) {
                $needs[$line->ingredient_id] = ($needs[$line->ingredient_id] ?? 0) + $line->quantity * $item['quantity'];
            }
        }
        ksort($needs);

        return $needs;
    }

    public function validateAvailability(array $items, string $branch): void
    {
        foreach ($this->requirements($items) as $id => $qty) {
            Ingredient::lockForUpdate()->findOrFail($id);
            if ($this->calculateAvailableStock($id, 'Production', $branch) < $qty) {
                throw ValidationException::withMessages(['items' => 'Insufficient recipe ingredient stock.']);
            }
        }
    }

    public function deductStock(Order $order): void
    {
        if ($order->inventory_deducted) {
            return;
        }
        foreach ($this->requirements($order->items->toArray()) as $id => $qty) {
            $this->adjustStock($id, 'Production', $order->branch, -$qty, 'Sales Consumption', $order->order_number, '', $order);
        }
        $order->inventory_deducted = true;
        $order->save();
    }

    public function restoreStock(Order $order): void
    {
        if (! $order->inventory_deducted) {
            return;
        }
        $reversed = InventoryTransaction::whereNotNull('reversal_of')->pluck('reversal_of');
        $transactions = InventoryTransaction::where('order_id', $order->id)->where('type', 'Sales Consumption')->whereNotIn('id', $reversed)->orderBy('ingredient_id')->get();
        foreach ($transactions as $tx) {
            $this->adjustStock($tx->ingredient_id, $tx->ingredient_type, $tx->branch, abs($tx->quantity), 'Return', $order->order_number, 'Order reversal', $order, $tx->id);
        }
        $order->inventory_deducted = false;
        $order->save();
    }

    public function transferStock(array $data): StockTransfer
    {
        return DB::transaction(function () use ($data) {
            $item = $this->item($data['item_id'], $data['item_type']);
            $transfer = new StockTransfer($data);
            $transfer->item_name = $item->name;
            $transfer->unit = $item->unit;
            $transfer->user_name = auth()->user()?->name;
            $transfer->{$data['item_type'] === 'Raw' ? 'raw_material_id' : 'production_id'} = $item->id;
            $transfer->status = 'Completed';
            $transfer->save();
            $this->adjustStock($item->id, $data['item_type'], $data['from_branch'], -$data['quantity'], 'Transfer Out', $transfer->id, $data['notes'] ?? '');
            $this->adjustStock($item->id, $data['item_type'], $data['to_branch'], $data['quantity'], 'Transfer In', $transfer->id, $data['notes'] ?? '');
            AuditService::record('Stock transfer', 'stock_transfers', $transfer->id, [], $transfer->toArray());

            return $transfer;
        }, 3);
    }
}
