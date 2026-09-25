<?php

namespace App\Models;

class StockTransfer extends DomainModel
{
    protected $table = 'stock_transfers';

    protected $fillable = ['item_id', 'item_type', 'item_name', 'from_branch', 'to_branch', 'quantity', 'unit', 'user_name', 'notes', 'status'];

    protected $casts = ['quantity' => 'float'];
}
