<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name', 255)->unique();
            $t->text('description')->nullable();
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });
        Schema::create('app_users', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name', 255);
            $t->string('email', 255)->unique();
            $t->string('mobile', 255)->nullable();
            $t->string('role_name', 255)->nullable()->index();
            $t->enum('branch', ['All', 'NAR Commi', 'NAR Greenwoods'])->nullable()->index();
            $t->boolean('is_active')->default(true);
            $t->string('last_login', 255)->nullable();
            $t->foreignId('user_id')->nullable()->unique()->constrained()->restrictOnDelete();
            $t->foreignUuid('role_id')->nullable()->constrained()->restrictOnDelete();
            $t->timestamps();
        });
        Schema::create('categories', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name', 255);
            $t->text('description')->nullable();
            $t->string('image_url', 2048)->nullable();
            $t->decimal('sort_order', 15, 2)->default(0);
            $t->boolean('is_active')->default(true);
            $t->timestamp('deleted_at')->nullable();
            $t->timestamps();
        });
        Schema::create('products', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name', 255);
            $t->string('sku', 255)->nullable()->unique();
            $t->foreignUuid('category_id')->nullable()->constrained('categories')->restrictOnDelete();
            $t->text('description')->nullable();
            $t->string('image_url', 2048)->nullable();
            $t->boolean('is_active')->default(true);
            $t->boolean('is_featured')->default(false);
            $t->boolean('is_popular')->default(false);
            $t->boolean('show_on_landing')->default(false);
            $t->decimal('sort_order', 15, 2)->default(0);
            $t->boolean('is_sample')->default(false);
            $t->timestamp('deleted_at')->nullable();
            $t->timestamps();
        });
        Schema::create('ingredients', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name', 255);
            $t->string('sku', 255)->nullable()->unique();
            $t->string('unit', 255)->default('kg');
            $t->decimal('current_stock', 15, 3)->default(0);
            $t->decimal('min_stock', 15, 3)->default(0);
            $t->decimal('reorder_level', 15, 3)->default(0);
            $t->decimal('cost_per_unit', 15, 2)->default(0);
            $t->string('supplier', 255)->nullable();
            $t->string('storage_location', 255)->nullable();
            $t->date('expiration_date')->nullable();
            $t->boolean('is_active')->default(true);
            $t->text('notes')->nullable();
            $t->timestamp('deleted_at')->nullable();
            $t->timestamps();
        });
        Schema::create('raw_materials', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name', 255);
            $t->string('sku', 255)->nullable()->unique();
            $t->string('unit', 255)->default('kg');
            $t->decimal('current_stock', 15, 3)->default(0);
            $t->decimal('min_stock', 15, 3)->default(0);
            $t->decimal('reorder_level', 15, 3)->default(0);
            $t->decimal('cost_per_unit', 15, 2)->default(0);
            $t->string('supplier', 255)->nullable();
            $t->string('storage_location', 255)->nullable();
            $t->date('expiration_date')->nullable();
            $t->boolean('is_active')->default(true);
            $t->text('notes')->nullable();
            $t->timestamp('deleted_at')->nullable();
            $t->timestamps();
        });
        Schema::create('recipes', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('product_id')->nullable()->constrained('products')->restrictOnDelete();
            $t->string('product_name', 255)->nullable();
            $t->string('variant_name', 255);
            $t->unique(['product_id', 'variant_name']);
            $t->timestamps();
        });
        Schema::create('payment_methods', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name', 255)->unique();
            $t->text('description')->nullable();
            $t->text('instructions')->nullable();
            $t->boolean('requires_reference')->default(false);
            $t->boolean('is_active')->default(true);
            $t->decimal('sort_order', 15, 2)->default(0);
            $t->timestamps();
        });
        Schema::create('settings', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('restaurant_name', 255)->default('Nanay Asa Restaurant');
            $t->string('logo_url', 2048)->nullable();
            $t->string('banner_image_url', 2048)->nullable();
            $t->text('address')->nullable();
            $t->string('phone', 255)->nullable();
            $t->string('email', 255)->nullable()->unique();
            $t->string('business_hours', 255)->nullable();
            $t->string('currency_symbol', 255)->default('₱');
            $t->decimal('tax_rate', 15, 2)->default(0);
            $t->text('receipt_footer')->nullable();
            $t->boolean('enable_dinein')->default(true);
            $t->boolean('enable_takeout')->default(true);
            $t->boolean('enable_delivery')->default(true);
            $t->decimal('min_order', 15, 2)->default(0);
            $t->decimal('delivery_fee', 15, 2)->default(0);
            $t->decimal('prep_time_minutes', 15, 2)->default(30);
            $t->decimal('low_stock_threshold', 15, 3)->default(0);
            $t->string('deduct_on_status', 255)->default('Completed');
            $t->string('receipt_width', 255)->default('80mm');
            $t->decimal('receipt_copies', 15, 2)->default(1);
            $t->boolean('receipt_auto_print')->default(false);
            $t->boolean('receipt_show_logo')->default(true);
            $t->boolean('receipt_show_customer')->default(true);
            $t->boolean('receipt_show_vat')->default(true);
            $t->text('receipt_header')->nullable();
            $t->boolean('coming_soon_enabled')->default(false);
            $t->string('coming_soon_title', 255)->default('Coming Soon');
            $t->text('coming_soon_message')->default('We are working on something amazing. Stay tuned!');
            $t->string('coming_soon_background_url', 2048)->nullable();
            $t->timestamps();
        });
        Schema::create('orders', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('order_number', 255)->unique();
            $t->string('customer_name', 255)->nullable();
            $t->string('customer_phone', 255)->nullable();
            $t->string('customer_email', 255)->nullable();
            $t->enum('order_type', ['Delivery', 'Pick-up', 'Dine-In', 'Walk-in'])->default('Delivery');
            $t->enum('customer_source', ['Walk-in', 'Grab', 'Meta'])->nullable();
            $t->enum('branch', ['NAR Commi', 'NAR Greenwoods'])->nullable()->index();
            $t->string('table_number', 255)->nullable();
            $t->string('province', 255)->nullable();
            $t->string('city', 255)->nullable();
            $t->string('barangay', 255)->nullable();
            $t->text('address')->nullable();
            $t->string('landmark', 255)->nullable();
            $t->string('postcode', 255)->nullable();
            $t->string('preferred_date', 255)->nullable()->index();
            $t->string('preferred_time', 255)->nullable();
            $t->text('notes')->nullable();
            $t->enum('status', ['Pending', 'For Reservation', 'Confirmed', 'Preparing', 'Ready', 'Out for Delivery', 'Completed', 'Cancelled', 'Refunded'])->default('Pending')->index();
            $t->enum('payment_status', ['Unpaid', 'Paid', 'Refunded'])->default('Unpaid')->index();
            $t->string('payment_method', 255)->nullable();
            $t->enum('gcash_type', ['Corporate', 'Personal'])->nullable();
            $t->string('payment_reference', 2048)->nullable();
            $t->string('payment_reference_2', 2048)->nullable();
            $t->decimal('subtotal', 15, 2)->default(0);
            $t->decimal('discount', 15, 2)->default(0);
            $t->string('discount_type', 255)->nullable();
            $t->string('discount_reason', 255)->nullable();
            $t->string('discount_id_url', 2048)->nullable();
            $t->decimal('delivery_fee', 15, 2)->default(0);
            $t->decimal('tax', 15, 2)->default(0);
            $t->decimal('total', 15, 2)->default(0);
            $t->enum('source', ['Online', 'Manual'])->default('Online');
            $t->string('created_by_name', 255)->nullable();
            $t->string('cook_name', 255)->nullable();
            $t->boolean('inventory_deducted')->default(false);
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignUuid('payment_method_id')->nullable()->constrained()->restrictOnDelete();
            $t->uuid('tracking_token')->unique();
            $t->uuid('request_key')->nullable()->unique();
            $t->softDeletes();
            $t->index(['branch', 'created_at', 'status']);
            $t->timestamps();
        });
        Schema::create('stock_ledgers', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('item_id', 255)->index();
            $t->enum('item_type', ['Production', 'Raw'])->default('Production');
            $t->string('item_name', 255)->nullable();
            $t->enum('branch', ['NAR Commi', 'NAR Greenwoods'])->index();
            $t->decimal('current_stock', 15, 3)->default(0);
            $t->string('unit', 255)->default('kg');
            $t->decimal('min_stock', 15, 3)->default(0);
            $t->foreignUuid('production_id')->nullable()->constrained('ingredients')->restrictOnDelete();
            $t->foreignUuid('raw_material_id')->nullable()->constrained()->restrictOnDelete();
            $t->unique(['item_id', 'item_type', 'branch']);
            $t->timestamps();
        });
        Schema::create('inventory_transactions', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('ingredient_id', 255)->index();
            $t->string('ingredient_name', 255)->nullable();
            $t->enum('ingredient_type', ['Production', 'Raw'])->default('Production');
            $t->enum('branch', ['NAR Commi', 'NAR Greenwoods'])->nullable()->index();
            $t->enum('type', ['Stock In', 'Sales Consumption', 'Waste', 'Adjustment', 'Return', 'Correction', 'Transfer In', 'Transfer Out'])->default('Stock In');
            $t->decimal('quantity', 15, 3);
            $t->string('unit', 255)->nullable();
            $t->string('reference', 2048)->nullable();
            $t->string('user_name', 255)->nullable();
            $t->text('notes')->nullable();
            $t->foreignUuid('production_id')->nullable()->constrained('ingredients')->restrictOnDelete();
            $t->foreignUuid('raw_material_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignUuid('order_id')->nullable()->constrained()->restrictOnDelete();
            $t->uuid('reversal_of')->nullable()->unique();
            $t->index(['branch', 'created_at', 'type']);
            $t->timestamps();
        });
        Schema::create('stock_transfers', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('item_id', 255)->index();
            $t->enum('item_type', ['Production', 'Raw'])->default('Production');
            $t->string('item_name', 255)->nullable();
            $t->enum('from_branch', ['NAR Commi', 'NAR Greenwoods']);
            $t->enum('to_branch', ['NAR Commi', 'NAR Greenwoods']);
            $t->decimal('quantity', 15, 3);
            $t->string('unit', 255)->nullable();
            $t->string('user_name', 255)->nullable();
            $t->text('notes')->nullable();
            $t->enum('status', ['Pending', 'Completed', 'Cancelled'])->default('Completed')->index();
            $t->foreignUuid('production_id')->nullable()->constrained('ingredients')->restrictOnDelete();
            $t->foreignUuid('raw_material_id')->nullable()->constrained()->restrictOnDelete();
            $t->timestamps();
        });
        Schema::create('audit_logs', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('user_name', 255)->nullable();
            $t->string('action', 255);
            $t->string('module', 255);
            $t->string('record_id', 255)->nullable();
            $t->text('previous_value')->nullable();
            $t->text('new_value')->nullable();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->timestamps();
        });
        Schema::create('product_variants', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $t->string('name');
            $t->decimal('price', 15, 2);
            $t->string('sku')->nullable();
            $t->boolean('is_available')->default(true);
            $t->unique(['product_id', 'name']);
            $t->timestamps();
        });
        Schema::create('product_modifiers', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $t->string('name');
            $t->decimal('price', 15, 2)->default(0);
            $t->unique(['product_id', 'name']);
            $t->timestamps();
        });
        Schema::create('recipe_items', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('recipe_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('ingredient_id')->constrained()->restrictOnDelete();
            $t->string('ingredient_name')->nullable();
            $t->decimal('quantity', 15, 3);
            $t->string('unit');
            $t->timestamps();
        });
        Schema::create('role_permissions', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('role_id')->constrained()->cascadeOnDelete();
            $t->string('module');
            $t->string('action');
            $t->unique(['role_id', 'module', 'action']);
            $t->timestamps();
        });
        Schema::create('order_items', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('order_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('product_id')->constrained()->restrictOnDelete();
            $t->string('product_name');
            $t->string('variant_name');
            $t->unsignedInteger('quantity');
            $t->decimal('unit_price', 15, 2);
            $t->decimal('subtotal', 15, 2);
            $t->text('notes')->nullable();
            $t->timestamps();
        });
        Schema::create('order_item_modifiers', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('order_item_id')->constrained()->cascadeOnDelete();
            $t->string('name');
            $t->decimal('price', 15, 2);
            $t->timestamps();
        });
        Schema::create('order_status_histories', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('order_id')->constrained()->cascadeOnDelete();
            $t->string('status');
            $t->timestamp('at');
            $t->string('by');
            $t->text('reason')->nullable();
            $t->timestamps();
        });
        Schema::table('users', function (Blueprint $t) {
            $t->string('role')->default('user');
            $t->string('google_id')->nullable()->unique();
            $t->boolean('is_active')->default(true);
        });
        Schema::create('order_sequences', function (Blueprint $t) {
            $t->string('date')->primary();
            $t->unsignedInteger('value')->default(0);
        });
        Schema::create('email_codes', function (Blueprint $t) {
            $t->string('email')->primary();
            $t->string('code');
            $t->timestamp('expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->dropUnique(['google_id']);
            $t->dropColumn(['role', 'google_id', 'is_active']);
        });
        Schema::dropIfExists('email_codes');
        Schema::dropIfExists('order_sequences');
        Schema::dropIfExists('order_status_histories');
        Schema::dropIfExists('order_item_modifiers');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('recipe_items');
        Schema::dropIfExists('product_modifiers');
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('stock_transfers');
        Schema::dropIfExists('inventory_transactions');
        Schema::dropIfExists('stock_ledgers');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('settings');
        Schema::dropIfExists('payment_methods');
        Schema::dropIfExists('recipes');
        Schema::dropIfExists('raw_materials');
        Schema::dropIfExists('ingredients');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('app_users');
        Schema::dropIfExists('roles');
    }
};
