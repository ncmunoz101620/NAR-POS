<?php

namespace App\Models;

class Setting extends DomainModel
{
    protected $table = 'settings';

    protected $fillable = ['restaurant_name', 'logo_url', 'banner_image_url', 'address', 'phone', 'email', 'business_hours', 'currency_symbol', 'tax_rate', 'receipt_footer', 'enable_dinein', 'enable_takeout', 'enable_delivery', 'min_order', 'delivery_fee', 'prep_time_minutes', 'low_stock_threshold', 'deduct_on_status', 'receipt_width', 'receipt_copies', 'receipt_auto_print', 'receipt_show_logo', 'receipt_show_customer', 'receipt_show_vat', 'receipt_header', 'coming_soon_enabled', 'coming_soon_title', 'coming_soon_message', 'coming_soon_background_url'];

    protected $casts = ['tax_rate' => 'float', 'enable_dinein' => 'boolean', 'enable_takeout' => 'boolean', 'enable_delivery' => 'boolean', 'min_order' => 'float', 'delivery_fee' => 'float', 'prep_time_minutes' => 'float', 'low_stock_threshold' => 'float', 'receipt_copies' => 'float', 'receipt_auto_print' => 'boolean', 'receipt_show_logo' => 'boolean', 'receipt_show_customer' => 'boolean', 'receipt_show_vat' => 'boolean', 'coming_soon_enabled' => 'boolean'];
}
