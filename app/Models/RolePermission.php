<?php

namespace App\Models;

class RolePermission extends DomainModel
{
    protected $table = 'role_permissions';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected $casts = ['price' => 'float', 'quantity' => 'float', 'unit_price' => 'float', 'subtotal' => 'float', 'is_available' => 'boolean'];
}
