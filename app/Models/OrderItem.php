<?php

namespace App\Models;

class OrderItem extends DomainModel
{
    protected $table = 'order_items';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected $casts = ['price' => 'float', 'quantity' => 'float', 'unit_price' => 'float', 'subtotal' => 'float', 'is_available' => 'boolean'];

    protected $with = ['modifierRows'];

    protected $hidden = ['modifierRows'];

    protected $appends = ['modifiers'];

    public function modifierRows()
    {
        return $this->hasMany(OrderItemModifier::class);
    }

    public function getModifiersAttribute()
    {
        return $this->modifierRows->pluck('name')->all();
    }
}
