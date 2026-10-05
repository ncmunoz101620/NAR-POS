<?php

namespace App\Support;

class DataTransferTables
{
    /**
     * Application data tables in dependency order for portable export/import.
     *
     * Excludes transient framework tables such as migrations, cache, jobs,
     * sessions, password reset tokens, and email verification codes.
     */
    public const TABLES = [
        'users',
        'roles',
        'categories',
        'ingredients',
        'raw_materials',
        'payment_methods',
        'settings',
        'products',
        'app_users',
        'recipes',
        'stock_ledgers',
        'orders',
        'product_variants',
        'product_modifiers',
        'recipe_items',
        'role_permissions',
        'order_items',
        'order_item_modifiers',
        'order_status_histories',
        'inventory_transactions',
        'stock_transfers',
        'audit_logs',
        'order_sequences',
        'uploaded_assets',
    ];
}
