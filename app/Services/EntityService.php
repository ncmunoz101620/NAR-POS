<?php

namespace App\Services;

use App\Models\AppUser;
use App\Models\Ingredient;
use App\Models\Product;
use App\Models\RecipeItem;
use App\Models\Role;
use App\Models\StockLedger;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class EntityService
{
    public const MODULE = ['Product' => 'products', 'Category' => 'categories', 'Ingredient' => 'ingredients', 'RawMaterial' => 'raw_materials', 'Recipe' => 'recipes', 'PaymentMethod' => 'payment_methods', 'Setting' => 'settings', 'AppUser' => 'users', 'Role' => 'roles', 'AuditLog' => 'audit_logs', 'InventoryTransaction' => 'inventory', 'StockLedger' => 'inventory', 'StockTransfer' => 'stock_transfers', 'Order' => 'orders'];

    public static function model(string $entity): string
    {
        abort_unless(isset(self::MODULE[$entity]), 404);

        return 'App\\Models\\'.$entity;
    }

    public function save(string $entity, array $data, ?string $id = null)
    {
        $module = self::MODULE[$entity];
        $action = isset($data['deleted_at']) ? 'delete' : ($id ? 'edit' : 'create');
        if ($entity === 'Role' && $id && array_keys($data) === ['permissions']) {
            Access::require('role_menu', 'edit');
        } else {
            Access::require($module, $action);
        }
        abort_if(in_array($entity, ['Order', 'StockLedger', 'InventoryTransaction', 'StockTransfer', 'AuditLog']), 405);

        return DB::transaction(function () use ($entity, $data, $id, $module, $action) {
            $class = self::model($entity);
            $row = $id ? $class::lockForUpdate()->findOrFail($id) : new $class;
            $before = $row->toArray();
            if (isset($data['deleted_at'])) {
                if ($entity === 'Category' && Product::where('category_id', $id)->whereNull('deleted_at')->exists()) {
                    throw ValidationException::withMessages(['category' => 'Move active products before deleting their category.']);
                }
                if ($entity === 'Ingredient' && RecipeItem::where('ingredient_id', $id)->exists()) {
                    throw ValidationException::withMessages(['ingredient' => 'Remove recipe references before deleting this ingredient.']);
                }
            }
            foreach (['sku', 'expiration_date', 'category_id'] as $key) {
                if (array_key_exists($key, $data) && $data[$key] === '') {
                    $data[$key] = null;
                }
            }
            if ($entity === 'Setting' && ! $id && $class::exists()) {
                throw ValidationException::withMessages(['settings' => 'Settings already exist.']);
            }
            if ($entity === 'Role' && $row->name === 'ADMIN' && auth()->user()?->role !== 'admin') {
                abort(403);
            }
            if ($entity === 'AppUser' && $row->user_id === auth()->id() && (($data['is_active'] ?? true) === false || ($data['role_name'] ?? '') !== $row->role_name)) {
                throw ValidationException::withMessages(['role_name' => 'Use another administrator to change your own access.']);
            }
            if ($entity === 'AppUser') {
                $role = Role::where('name', $data['role_name'])->where('is_active', true)->firstOrFail();
                $user = User::firstOrNew(['email' => strtolower($data['email'])]);
                if (! $user->exists) {
                    $user->password = Hash::make(Str::random(64));
                }
                $user->name = $data['name'];
                $user->is_active = $data['is_active'] ?? true;
                $user->role = $role->name === 'ADMIN' ? 'admin' : 'user';
                $user->save();
                $row->user_id = $user->id;
                $row->role_id = $role->id;
            }
            $stock = $data['current_stock'] ?? null;
            if (in_array($entity, ['Ingredient', 'RawMaterial'])) {
                unset($data['current_stock']);
            }
            $row->fill($data);
            $row->save();
            $row->refresh();
            if ($entity === 'Role' && isset($data['permissions'])) {
                $row->grants()->delete();
                foreach ($data['permissions'] as $grant) {
                    foreach (array_unique($grant['actions'] ?? []) as $act) {
                        $row->grants()->firstOrCreate(['module' => $grant['module'], 'action' => $act]);
                    }
                }
                AppUser::where('role_id', $row->id)->update(['role_name' => $row->name]);
            }
            if ($entity === 'Product') {
                foreach (['variants', 'modifiers'] as $rel) {
                    if (isset($data[$rel])) {
                        $row->$rel()->delete();
                        $row->$rel()->createMany(array_map(fn ($v) => array_intersect_key($v, array_flip($rel === 'variants' ? ['name', 'price', 'sku', 'is_available'] : ['name', 'price'])), $data[$rel]));
                    }
                }
            }
            if ($entity === 'Recipe') {
                if (! Product::findOrFail($row->product_id)->variants->contains('name', $row->variant_name)) {
                    throw ValidationException::withMessages(['variant_name' => 'Unknown product variant.']);
                }
                if (isset($data['items'])) {
                    $row->items()->delete();
                    foreach ($data['items'] as $item) {
                        $ing = Ingredient::whereNull('deleted_at')->findOrFail($item['ingredient_id']);
                        $row->items()->create(['ingredient_id' => $ing->id, 'ingredient_name' => $ing->name, 'quantity' => $item['quantity'], 'unit' => $ing->unit]);
                    }
                }
            }
            if (in_array($entity, ['Ingredient', 'RawMaterial'])) {
                $inventory = app(InventoryService::class);
                $type = $entity === 'Ingredient' ? 'Production' : 'Raw';
                $inventory->ensureRows($row, $type);
                StockLedger::where(['item_id' => $row->id, 'item_type' => $type])->update(['item_name' => $row->name, 'unit' => $row->unit, 'min_stock' => $row->min_stock]);
                if ($stock !== null) {
                    $branch = Access::profile(auth()->user())?->branch;
                    $branch = (! $branch || $branch === 'All') ? 'NAR Commi' : $branch;
                    $stockQuery = StockLedger::where(['item_id' => $row->id, 'item_type' => $type]);
                    if (Access::profile(auth()->user())?->branch && Access::profile(auth()->user())?->branch !== 'All') {
                        $stockQuery->where('branch', $branch);
                    }
                    $current = (float) $stockQuery->sum('current_stock');
                    if (round($stock - $current, 3) !== 0.0) {
                        $inventory->adjustStock($row->id, $type, $branch, round($stock - $current, 3), $id ? 'Adjustment' : 'Stock In', $id ? 'Item edit' : 'Opening stock');
                    }
                }
            }
            AuditService::record(ucfirst($action), $module, $row->id, $before, $row->fresh()->toArray());

            return $row->fresh();
        }, 3);
    }

    public function delete(string $entity, string $id): void
    {
        $class = self::model($entity);
        Access::require(self::MODULE[$entity], 'delete');
        abort_if(in_array($entity, ['StockLedger', 'InventoryTransaction', 'StockTransfer', 'AuditLog', 'Setting']), 405);
        DB::transaction(function () use ($entity, $id, $class) {
            $row = $class::lockForUpdate()->findOrFail($id);
            if ($entity === 'Role' && AppUser::where('role_id', $id)->exists()) {
                throw ValidationException::withMessages(['role' => 'Role is assigned to staff.']);
            }
            if ($entity === 'AppUser') {
                $user = $row->user;
                $user->is_active = false;
                $user->save();
            }
            AuditService::record('Delete', self::MODULE[$entity], $id, $row->toArray());
            $row->delete();
        });
    }
}
