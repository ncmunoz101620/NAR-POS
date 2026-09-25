<?php

namespace App\Models;

class RawMaterial extends DomainModel
{
    public function stock()
    {
        return $this->hasMany(StockLedger::class);
    }

    protected $table = 'raw_materials';

    protected $fillable = ['name', 'sku', 'unit', 'current_stock', 'min_stock', 'reorder_level', 'cost_per_unit', 'supplier', 'storage_location', 'expiration_date', 'is_active', 'notes', 'deleted_at'];

    protected $casts = ['current_stock' => 'float', 'min_stock' => 'float', 'reorder_level' => 'float', 'cost_per_unit' => 'float', 'is_active' => 'boolean'];
}
