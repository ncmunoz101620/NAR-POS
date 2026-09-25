<?php

namespace App\Models;

class Product extends DomainModel
{
    protected $table = 'products';

    protected $fillable = ['name', 'sku', 'category_id', 'description', 'image_url', 'is_active', 'is_featured', 'is_popular', 'show_on_landing', 'sort_order', 'is_sample', 'deleted_at'];

    protected $casts = ['is_active' => 'boolean', 'is_featured' => 'boolean', 'is_popular' => 'boolean', 'show_on_landing' => 'boolean', 'sort_order' => 'float', 'is_sample' => 'boolean'];

    protected $with = ['variants', 'modifiers'];

    public function variants()
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function modifiers()
    {
        return $this->hasMany(ProductModifier::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function recipes()
    {
        return $this->hasMany(Recipe::class);
    }
}
