<?php

namespace App\Http\Controllers;

use App\Services\Access;
use App\Services\DailySalesReportService;
use App\Services\ReportService;
use App\Services\OrderService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function storeEventSale(Request $request, OrderService $orders)
    {
        Access::require('reports', 'create');
        abort_unless(Access::profile($request->user())?->branch === 'All', 403, 'Event sales are available to all-branch staff only.');
        $data = $request->validate([
            'event_name' => 'required|string|max:255',
            'event_date' => 'required|date_format:Y-m-d',
            'amount' => ['required', 'regex:/^\d{1,13}(\.\d{1,2})?$/', 'numeric', 'gt:0'],
        ]);

        return response()->json($orders->recordEventSale($data['event_name'], $data['event_date'], (string) $data['amount']), 201);
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
