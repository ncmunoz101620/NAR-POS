<?php

namespace App\Models;

class Recipe extends DomainModel
{
    protected $table = 'recipes';

    protected $fillable = ['product_id', 'product_name', 'variant_name'];

    protected $casts = [];

    protected $with = ['items'];

    public function items()
    {
        return $this->hasMany(RecipeItem::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
