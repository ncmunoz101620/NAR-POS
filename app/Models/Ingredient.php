<?php

namespace App\Models;

class Ingredient extends DomainModel
{
    public function recipeItems()
    {
        return $this->hasMany(RecipeItem::class);
    }

    public function stock()
    {
        return $this->hasMany(StockLedger::class, 'production_id');
    }

    protected $table = 'ingredients';

    protected $fillable = ['name', 'sku', 'unit', 'current_stock', 'min_stock', 'reorder_level', 'cost_per_unit', 'supplier', 'storage_location', 'expiration_date', 'is_active', 'notes', 'deleted_at'];

    protected $casts = ['current_stock' => 'float', 'min_stock' => 'float', 'reorder_level' => 'float', 'cost_per_unit' => 'float', 'is_active' => 'boolean'];
}
