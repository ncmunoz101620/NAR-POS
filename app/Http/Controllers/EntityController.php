<?php

namespace App\Http\Controllers;

use App\Http\Requests\EntityRequest;
use App\Models\StockLedger;
use App\Services\Access;
use App\Services\EntityService;
use Illuminate\Http\Request;

class EntityController extends Controller
{
    public function index(Request $request, string $entity, ?string $id = null)
    {
        $class = EntityService::model($entity);
        $query = $class::query();
        $module = EntityService::MODULE[$entity];
        $public = in_array($entity, ['Product', 'Category', 'PaymentMethod', 'Setting']);
        $viewModules = match ($entity) {
            'Ingredient' => ['ingredients', 'inventory', 'recipes', 'stock_transfers', 'reports', 'dashboard'],
            'RawMaterial' => ['raw_materials', 'raw_material_reports', 'inventory', 'stock_transfers'],
            'StockLedger' => ['inventory', 'raw_materials', 'raw_material_reports', 'stock_transfers'],
            'InventoryTransaction' => ['inventory', 'ingredients', 'reports'],
            'Recipe' => ['recipes', 'reports'],
            'Order' => ['orders'],
            default => [$module],
        };
        if ($entity === 'AppUser' && ! Access::allows($request->user(), 'users')) {
            abort_unless($request->user(), 401);
            $query->where('user_id', $request->user()->id);
        } elseif ($entity === 'Role' && ! Access::any(['roles', 'role_menu', 'users'])) {
            abort_unless($request->user(), 401);
            $query->where('id', Access::profile($request->user())?->role_id);
        } elseif (! $public) {
            abort_unless(Access::any($viewModules), 403);
        }
        if ($public && ! Access::any([$module, 'manual_order', 'recipes', 'reports', 'dashboard'])) {
            if (in_array($entity, ['Product', 'Category', 'PaymentMethod'])) {
                $query->where('is_active', true);
            }
            if ($entity === 'Product') {
                $query->where('show_on_landing', true);
            }
        }
        if (isset(config('entities.'.$entity.'.properties')['deleted_at']) || $entity === 'Order') {
            $query->whereNull('deleted_at');
        }
        if (in_array($entity, ['Order', 'StockLedger', 'InventoryTransaction'])) {
            Access::scope($query);
        }
        if ($entity === 'StockTransfer') {
            $branch = Access::profile($request->user())?->branch;
            if ($branch && $branch !== 'All') {
                $query->where(fn ($q) => $q->where('from_branch', $branch)->orWhere('to_branch', $branch));
            }
        }
        $fields = array_keys(config('entities.'.$entity.'.properties'));
        $fields = array_merge($fields, ['id', 'created_date']);
        $filters = json_decode($request->query('filter', '{}'), true);
        abort_unless(is_array($filters), 422);
        foreach ($filters as $key => $value) {
            abort_unless(in_array($key, $fields) && ! is_array($value), 422);
            $query->where($key === 'created_date' ? 'created_at' : $key, $value);
        }
        if ($id) {
            return $query->findOrFail($id);
        }
        $sort = $request->query('sort', '-created_date');
        $field = ltrim($sort, '-');
        abort_unless(in_array($field, $fields), 422);
        $query->orderBy($field === 'created_date' ? 'created_at' : $field, str_starts_with($sort, '-') ? 'desc' : 'asc');
        $rows = $query->limit(min(max((int) $request->query('limit', 2000), 1), 5000))->get();
        if (in_array($entity, ['Ingredient', 'RawMaterial'])) {
            $branch = Access::profile($request->user())?->branch;
            if ($branch && $branch !== 'All') {
                $stocks = StockLedger::where('branch', $branch)->where('item_type', $entity === 'Ingredient' ? 'Production' : 'Raw')->pluck('current_stock', 'item_id');
                foreach ($rows as $row) {
                    $row->current_stock = (float) ($stocks[$row->id] ?? 0);
                }
            }
        }

        return $rows;
    }

    public function store(EntityRequest $request, string $entity, EntityService $service)
    {
        return $service->save($entity, $request->validated());
    }

    public function update(EntityRequest $request, string $entity, string $id, EntityService $service)
    {
        return $service->save($entity, $request->validated(), $id);
    }

    public function destroy(string $entity, string $id, EntityService $service)
    {
        $service->delete($entity, $id);

        return response()->noContent();
    }
}
