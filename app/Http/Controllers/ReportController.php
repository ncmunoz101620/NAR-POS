<?php

namespace App\Http\Controllers;

use App\Services\Access;
use App\Services\DailySalesReportService;
use App\Services\ReportService;
use App\Services\OrderService;
use App\Services\InventoryService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReportController extends Controller
{
    public function ingredientLedger(Request $request, string $id, ReportService $service)
    {
        Access::require('ingredients', 'view');
        $data = $request->validate([
            'branch' => ['required', Rule::in(InventoryService::BRANCHES)],
            'from' => 'nullable|date_format:Y-m-d',
            'to' => 'nullable|date_format:Y-m-d|after_or_equal:from',
            'page' => 'sometimes|integer|min:1',
            'per_page' => 'sometimes|integer|min:1|max:100',
        ]);
        Access::branch($data['branch']);

        return $service->ingredientLedger($id, $data['branch'], $data['from'] ?? null, $data['to'] ?? null, (int) ($data['page'] ?? 1), (int) ($data['per_page'] ?? 50));
    }

    public function storeEventSale(Request $request, OrderService $orders)
    {
        Access::require('reports', 'create');
        abort_unless(Access::profile($request->user())?->branch === 'All', 403, 'Event sales are available to all-branch staff only.');
        $data = $request->validate([
            'event_name' => 'required|string|max:255',
            'event_date' => 'required|date_format:Y-m-d',
            'gross_sales' => ['required', 'regex:/^\d{1,13}(\.\d{1,2})?$/', 'numeric', 'gt:0'],
            'discount' => ['required', 'regex:/^\d{1,13}(\.\d{1,2})?$/', 'numeric', 'gte:0'],
        ]);

        $sale = $orders->recordEventSale($data['event_name'], $data['event_date'], (string) $data['gross_sales'], (string) $data['discount']);

        return response()->json([
            'id' => $sale->id,
            'event_name' => $sale->event_name,
            'event_date' => $sale->event_date,
            'gross_sales' => $sale->gross_sales,
            'discount' => $sale->discount,
            'net_sales' => number_format((\App\Services\Money::cents($sale->gross_sales) - \App\Services\Money::cents($sale->discount)) / 100, 2, '.', ''),
        ], 201);
    }

    public function show(Request $request, string $type, ReportService $service)
    {
        abort_unless(in_array($type, ['dashboard', 'reports', 'inventorySummary']), 404);
        Access::require($type === 'inventorySummary' ? 'ingredients' : $type);
        $filters = $request->validate(['from' => 'nullable|date_format:Y-m-d', 'to' => 'nullable|date_format:Y-m-d|after_or_equal:from', 'branch' => 'nullable|in:all,NAR Commi,NAR Greenwoods', 'method' => 'nullable|string|max:255']);

        return $service->$type($filters);
    }

    public function sendDailySalesTest(Request $request, DailySalesReportService $service)
    {
        Access::require('settings', 'edit');
        $data = $request->validate([
            'date' => 'nullable|date_format:Y-m-d',
            'recipients' => 'sometimes|array|max:50',
            'recipients.*' => 'required|email|max:255|distinct:ignore_case',
        ]);
        $date = ! empty($data['date'])
            ? CarbonImmutable::parse($data['date'], 'Asia/Manila')->startOfDay()
            : $service->previousBusinessDate();

        $sent = $service->sendForDate($date, $data['recipients'] ?? null);
        abort_if($sent === 0, 422, 'Add at least one report recipient email before sending a test report.');

        return ['sent' => $sent, 'date' => $date->toDateString()];
    }
}
