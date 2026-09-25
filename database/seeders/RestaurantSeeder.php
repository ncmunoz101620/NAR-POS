<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Ingredient;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\RawMaterial;
use App\Models\Recipe;
use App\Models\Role;
use App\Models\Setting;
use App\Models\StockLedger;
use App\Services\Access;
use App\Services\InventoryService;
use Illuminate\Database\Seeder;

class RestaurantSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            'ADMIN' => array_fill_keys(Access::MODULES, Access::ACTIONS),
            'CSR' => ['dashboard' => ['view'], 'orders' => ['view', 'create', 'edit', 'print', 'export', 'cancel'], 'manual_order' => ['view', 'create'], 'settings' => ['view']],
            'RND COOK' => ['kitchen' => ['view', 'edit', 'print'], 'settings' => ['view']],
            'INVENTORY STAFF' => ['raw_material_reports' => ['view', 'export', 'print'], 'raw_materials' => ['view', 'create', 'edit'], 'ingredients' => ['view', 'create', 'edit'], 'inventory' => ['view', 'create'], 'stock_transfers' => ['view', 'create']],
        ];
        foreach ($roles as $name => $permissions) {
            $role = Role::firstOrCreate(['name' => $name], ['is_active' => true]);
            foreach ($permissions as $module => $actions) {
                foreach ($actions as $action) {
                    $role->grants()->firstOrCreate(['module' => $module, 'action' => $action]);
                }
            }
        }
        Setting::firstOrCreate([], ['restaurant_name' => 'Nanay Asa Restaurant', 'logo_url' => '/images/logo.png', 'banner_image_url' => '/images/hero.png', 'currency_symbol' => '₱', 'tax_rate' => 0, 'delivery_fee' => 0, 'deduct_on_status' => 'Completed']);
        foreach (['Cash', 'GCash', 'Bank Transfer'] as $name) {
            PaymentMethod::firstOrCreate(['name' => $name], ['is_active' => true, 'requires_reference' => $name !== 'Cash']);
        }
        // Demo catalog only in development/testing. Production seeds contain no sales or stock.
        if (! app()->environment(['local', 'testing'])) {
            return;
        }
        $category = Category::firstOrCreate(['name' => 'Demo menu'], ['description' => 'Replace these development examples before launch.']);
        $product = Product::firstOrCreate(['sku' => 'DEMO-MEAL'], ['name' => 'Sample restaurant meal', 'category_id' => $category->id, 'is_active' => true, 'show_on_landing' => true, 'is_sample' => true]);
        $product->variants()->firstOrCreate(['name' => 'Regular'], ['price' => 150, 'is_available' => true]);
        $ingredient = Ingredient::firstOrCreate(['sku' => 'DEMO-ING'], ['name' => 'Sample prepared ingredient', 'unit' => 'kg', 'cost_per_unit' => 100]);
        $raw = RawMaterial::firstOrCreate(['sku' => 'DEMO-RAW'], ['name' => 'Sample raw material', 'unit' => 'kg', 'cost_per_unit' => 80]);
        $inventory = app(InventoryService::class);
        foreach ([[$ingredient, 'Production'], [$raw, 'Raw']] as [$item,$type]) {
            if (! StockLedger::where('item_id', $item->id)->exists()) {
                $inventory->receiveStock($item->id, $type, 'NAR Commi', 20);
            }
        }
        $recipe = Recipe::firstOrCreate(['product_id' => $product->id, 'variant_name' => 'Regular'], ['product_name' => $product->name]);
        $recipe->items()->firstOrCreate(['ingredient_id' => $ingredient->id], ['ingredient_name' => $ingredient->name, 'quantity' => 0.25, 'unit' => 'kg']);
    }
}
