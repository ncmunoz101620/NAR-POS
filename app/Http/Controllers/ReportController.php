<?php

namespace App\Http\Controllers;

use App\Services\Access;
use App\Services\ReportService;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function show(Request $request, string $type, ReportService $service)
    {
        abort_unless(in_array($type, ['dashboard', 'reports', 'inventorySummary']), 404);
        Access::require($type === 'inventorySummary' ? 'ingredients' : $type);
        $filters = $request->validate(['from' => 'nullable|date_format:Y-m-d', 'to' => 'nullable|date_format:Y-m-d|after_or_equal:from', 'branch' => 'nullable|in:all,NAR Commi,NAR Greenwoods', 'method' => 'nullable|string|max:255']);

        return $service->$type($filters);
    }
}
