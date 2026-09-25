<?php

namespace App\Http\Controllers;

use App\Http\Requests\OrderRequest;
use App\Models\Order;
use App\Services\Access;
use App\Services\OrderService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        Access::require('orders');
        $data = $request->validate(['from' => 'nullable|date_format:Y-m-d', 'to' => 'nullable|date_format:Y-m-d', 'date_type' => 'nullable|in:created,preferred', 'branch' => 'nullable|in:all,NAR Commi,NAR Greenwoods', 'status' => 'nullable|string|max:255', 'q' => 'nullable|string|max:255', 'page' => 'nullable|integer|min:1', 'export' => 'nullable|boolean']);
        $q = Access::scope(Order::whereNull('deleted_at'));
        if (! empty($data['branch']) && $data['branch'] !== 'all') {
            $q->where('branch', $data['branch']);
        }
        if (! empty($data['status']) && $data['status'] !== 'all') {
            $q->where('status', $data['status']);
        }
        $scheduled = ($data['date_type'] ?? '') === 'preferred';
        $column = $scheduled ? 'preferred_date' : 'created_at';
        if (! empty($data['from'])) {
            $q->where($column, '>=', $scheduled ? $data['from'] : CarbonImmutable::parse($data['from'], 'Asia/Manila')->startOfDay()->utc());
        }
        if (! empty($data['to'])) {
            $q->where($column, $scheduled ? '<=' : '<', $scheduled ? $data['to'] : CarbonImmutable::parse($data['to'], 'Asia/Manila')->addDay()->startOfDay()->utc());
        }
        if (! empty($data['q'])) {
            $q->where(fn ($q) => $q->where('order_number', 'like', '%'.$data['q'].'%')->orWhere('customer_name', 'like', '%'.$data['q'].'%')->orWhere('customer_phone', 'like', '%'.$data['q'].'%')->orWhere('payment_reference', 'like', '%'.$data['q'].'%'));
        }
        if ($request->boolean('export')) {
            Access::require('orders', 'export');

            return $q->orderByDesc('created_at')->get();
        }
        $active = (clone $q)->where('status', '!=', 'Cancelled');
        $cancelled = (clone $q)->where('status', 'Cancelled');
        $summary = ['totalOrders' => (clone $active)->count(), 'totalAmount' => (float) (clone $active)->sum('total'), 'cancelledCount' => (clone $cancelled)->count(), 'cancelledAmount' => (float) (clone $cancelled)->sum('total'), 'byMethod' => (clone $active)->select('payment_method')->selectRaw('SUM(total) as amount')->groupBy('payment_method')->pluck('amount', 'payment_method')];
        $page = $q->orderByDesc('created_at')->paginate(12);

        return ['data' => $page->items(), 'total' => $page->total(), 'last_page' => $page->lastPage(), 'summary' => $summary];
    }

    public function store(OrderRequest $request, OrderService $service)
    {
        $manual = $request->input('source') === 'Manual';
        if ($manual) {
            Access::require('manual_order', 'create');
        }

        return $service->create($request->validated(), $manual);
    }

    public function update(OrderRequest $request, string $id, OrderService $service)
    {
        $order = $service->update($id, $request->validated());

        return Access::allows($request->user(), 'orders') ? $order : $order->only(['id', 'order_number', 'customer_name', 'order_type', 'table_number', 'branch', 'status', 'cook_name', 'notes', 'created_date', 'preferred_date', 'preferred_time', 'items', 'status_history']);
    }

    public function destroy(string $id, OrderService $service)
    {
        $service->delete($id);

        return response()->noContent();
    }

    public function track(Request $request)
    {
        $data = $request->validate(['number' => 'required|string|max:255', 'token' => 'nullable|uuid', 'phone' => 'nullable|string|max:40']);
        $order = Order::where('order_number', $data['number'])->whereNull('deleted_at')->first();
        if (! $order) {
            return [];
        }
        $owned = in_array($order->id, session('order_ids', [])) || (auth()->id() && $order->user_id === auth()->id());
        $token = ! empty($data['token']) && hash_equals($order->tracking_token, $data['token']);
        $staff = Access::any(['orders']);
        if ($staff) {
            Access::branch($order->branch);
        }
        abort_unless($owned || $token || $staff, 404);
        $result = $order->toArray();
        unset($result['discount_id_url'],$result['payment_reference'],$result['payment_reference_2'],$result['tracking_token']);

        return [$result];
    }
}
