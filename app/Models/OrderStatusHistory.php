<?php

namespace App\Models;

class OrderStatusHistory extends DomainModel
{
    protected $table = 'order_status_histories';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected $casts = ['price' => 'float', 'quantity' => 'float', 'unit_price' => 'float', 'subtotal' => 'float', 'is_available' => 'boolean'];
}
