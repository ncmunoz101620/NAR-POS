<?php

namespace App\Http\Controllers;

use App\Services\Access;
use App\Services\AuditService;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    public function movement(Request $request, InventoryService $service)
    {
        Access::require('inventory', 'create');
        $data = $request->validate(['ingredient_id' => 'required|uuid', 'ingredient_type' => ['required', Rule::in(['Raw', 'Production'])], 'branch' => ['required', Rule::in(InventoryService::BRANCHES)], 'type' => ['required', Rule::in(['Stock In', 'Waste', 'Adjustment', 'Return', 'Correction'])], 'quantity' => 'required|numeric|not_in:0|min:-1000000|max:1000000', 'reference' => 'nullable|string|max:255', 'notes' => 'nullable|string|max:2000']);
        Access::branch($data['branch']);
        $service->item($data['ingredient_id'], $data['ingredient_type']);
        $qty = $data['type'] === 'Waste' ? -abs($data['quantity']) : (in_array($data['type'], ['Stock In', 'Return']) ? abs($data['quantity']) : $data['quantity']);

        return DB::transaction(function () use ($service, $data, $qty) {
            $row = $service->adjustStock($data['ingredient_id'], $data['ingredient_type'], $data['branch'], $qty, $data['type'], $data['reference'] ?? '', $data['notes'] ?? '');
            AuditService::record('Stock movement', 'inventory', $row->id, [], $data);

            return $row;
        });
    }

    public function transfer(Request $request, InventoryService $service)
    {
        Access::require('stock_transfers', 'create');
        $data = $request->validate(['item_id' => 'required|uuid', 'item_type' => ['required', Rule::in(['Raw', 'Production'])], 'from_branch' => ['required', Rule::in(InventoryService::BRANCHES)], 'to_branch' => ['required', 'different:from_branch', Rule::in(InventoryService::BRANCHES)], 'quantity' => 'required|numeric|gt:0|max:1000000', 'notes' => 'nullable|string|max:2000']);
        Access::branch($data['from_branch']);

        return $service->transferStock($data);
    }
}
