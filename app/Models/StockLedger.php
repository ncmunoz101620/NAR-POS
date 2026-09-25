<?php

namespace App\Models;

class StockLedger extends DomainModel
{
    public function ingredient()
    {
        return $this->belongsTo(Ingredient::class, 'production_id');
    }

    public function rawMaterial()
    {
        return $this->belongsTo(RawMaterial::class);
    }

    protected $table = 'stock_ledgers';

    protected $fillable = ['item_id', 'item_type', 'item_name', 'branch', 'current_stock', 'unit', 'min_stock'];

    protected $casts = ['current_stock' => 'float', 'min_stock' => 'float'];
}
