<?php

namespace App\Models;

class Order extends DomainModel
{
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function paymentMethod()
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function transactions()
    {
        return $this->hasMany(InventoryTransaction::class);
    }

    protected $table = 'orders';

    protected $fillable = ['order_number', 'customer_name', 'customer_phone', 'customer_email', 'order_type', 'customer_source', 'branch', 'table_number', 'province', 'city', 'barangay', 'address', 'landmark', 'postcode', 'preferred_date', 'preferred_time', 'notes', 'status', 'payment_status', 'payment_method', 'gcash_type', 'payment_reference', 'payment_reference_2', 'subtotal', 'discount', 'discount_type', 'discount_reason', 'discount_id_url', 'delivery_fee', 'tax', 'total', 'source', 'created_by_name', 'cook_name', 'inventory_deducted'];

    protected $casts = ['subtotal' => 'float', 'discount' => 'float', 'delivery_fee' => 'float', 'tax' => 'float', 'total' => 'float', 'inventory_deducted' => 'boolean'];

    protected $with = ['items', 'status_history'];

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function status_history()
    {
        return $this->hasMany(OrderStatusHistory::class);
    }
}
