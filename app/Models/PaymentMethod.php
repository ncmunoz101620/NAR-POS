<?php

namespace App\Models;

class PaymentMethod extends DomainModel
{
    protected $table = 'payment_methods';

    protected $fillable = ['name', 'description', 'instructions', 'requires_reference', 'is_active', 'sort_order'];

    protected $casts = ['requires_reference' => 'boolean', 'is_active' => 'boolean', 'sort_order' => 'float'];
}
