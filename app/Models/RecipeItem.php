<?php

namespace App\Models;

class RecipeItem extends DomainModel
{
    protected $table = 'recipe_items';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected $casts = ['price' => 'float', 'quantity' => 'float', 'unit_price' => 'float', 'subtotal' => 'float', 'is_available' => 'boolean'];

    public function ingredient()
    {
        return $this->belongsTo(Ingredient::class);
    }
}
