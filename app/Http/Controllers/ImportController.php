<?php

namespace App\Http\Controllers;

use App\Services\Access;
use App\Services\EntityService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ImportController extends Controller
{
    public function store(Request $request, string $entity, EntityService $service)
    {
        abort_unless($entity === 'Ingredient', 404);
        Access::require('ingredients', 'create');
        $data = $request->validate(['rows' => 'required|array|min:1|max:500', 'rows.*.name' => 'required|string|max:255', 'rows.*.sku' => 'nullable|string|max:255|distinct', 'rows.*.unit' => 'required|string|max:40', 'rows.*.current_stock' => 'nullable|numeric|min:0|max:1000000', 'rows.*.min_stock' => 'nullable|numeric|min:0|max:1000000', 'rows.*.reorder_level' => 'nullable|numeric|min:0|max:1000000', 'rows.*.cost_per_unit' => 'nullable|numeric|min:0|max:1000000', 'rows.*.supplier' => 'nullable|string|max:255', 'rows.*.storage_location' => 'nullable|string|max:255', 'rows.*.expiration_date' => 'nullable|date', 'rows.*.notes' => 'nullable|string|max:4000', 'rows.*.is_active' => 'sometimes|boolean']);

        return DB::transaction(fn () => array_map(fn ($row) => $service->save($entity, $row), $data['rows']));
    }
}
