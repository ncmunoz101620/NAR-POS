<?php

namespace App\Models;

class Category extends DomainModel
{
    protected $table = 'categories';

    protected $fillable = ['name', 'description', 'image_url', 'sort_order', 'is_active', 'deleted_at'];

    protected $casts = ['sort_order' => 'float', 'is_active' => 'boolean'];

    public function products()
    {
        return $this->hasMany(Product::class);
    }
}
