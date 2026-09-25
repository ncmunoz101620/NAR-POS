<?php

namespace App\Models;

class InventoryTransaction extends DomainModel
{
    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function ingredient()
    {
        return $this->belongsTo(Ingredient::class, 'production_id');
    }

    public function rawMaterial()
    {
        return $this->belongsTo(RawMaterial::class);
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('Inventory transactions are immutable.'));
        static::deleting(fn () => throw new \LogicException('Inventory transactions are immutable.'));
    }

    protected $table = 'inventory_transactions';

    protected $fillable = ['ingredient_id', 'ingredient_name', 'ingredient_type', 'branch', 'type', 'quantity', 'unit', 'reference', 'user_name', 'notes'];

    protected $casts = ['quantity' => 'float'];
}
