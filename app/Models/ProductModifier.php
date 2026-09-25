<?php

namespace App\Models;

class ProductModifier extends DomainModel
{
    protected $table = 'product_modifiers';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected $casts = ['price' => 'float', 'quantity' => 'float', 'unit_price' => 'float', 'subtotal' => 'float', 'is_available' => 'boolean'];
}
