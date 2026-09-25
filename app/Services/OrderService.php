<?php

namespace App\Services;

use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function __construct(private InventoryService $inventory) {}

    private function fail(string $key, string $message): never
    {
        throw ValidationException::withMessages([$key => $message]);
    }

    private function cents($value): int
    {
        return Money::cents($value);
    }

    private function priceItems(array $items, bool $manual): array
    {
        $products = Product::with(['variants', 'modifiers'])->whereIn('id', array_column($items, 'product_id'))->lockForUpdate()->get()->keyBy('id');
        $lines = [];
        foreach ($items as $item) {
            $p = $products->get($item['product_id']);
            if (! $p || ! $p->is_active || $p->deleted_at || (! $manual && ! $p->show_on_landing)) {
                $this->fail('items', 'A product is no longer available.');
            }
            $v = $p->variants->firstWhere('name', $item['variant_name']);
            if (! $v || ! $v->is_available) {
                $this->fail('items', 'A variant is no longer available.');
            }
            $price = $this->cents($v->price);
            $mods = [];
            foreach (array_unique($item['modifiers'] ?? []) as $name) {
                $mod = $p->modifiers->firstWhere('name', $name);
                if (! $mod) {
                    $this->fail('items', 'Unknown product modifier.');
                }
                $price += $this->cents($mod->price);
                $mods[] = ['name' => $name, 'price' => $mod->price];
            }
            $lines[] = ['product_id' => $p->id, 'product_name' => $p->name, 'variant_name' => $v->name, 'quantity' => $item['quantity'], 'unit_price' => $price / 100, 'subtotal' => ($price * $item['quantity']) / 100, 'notes' => $item['notes'] ?? null, 'modifiers' => $mods];
        }

        return $lines;
    }

    private function totals(array $lines, array $data, bool $manual): array
    {
        $settings = Setting::first();
        $subtotal = array_sum(array_map(fn ($l) => $this->cents($l['subtotal']), $lines));
        $discount = 0;
        if ($manual) {
            $kind = $data['discount_type'] ?? 'none';
            $percent = ['none' => 0, 'senior' => 20, 'pwd' => 20, 'solo_parent' => 10];
            if ($kind === 'custom') {
                if (empty($data['discount_reason'])) {
                    $this->fail('discount_reason', 'A custom discount needs a reason.');
                }
                $discount = $this->cents($data['discount'] ?? 0);
            } elseif (array_key_exists($kind, $percent)) {
                $discount = (int) round($subtotal * $percent[$kind] / 100);
                if ($discount && empty($data['discount_id_url'])) {
                    $this->fail('discount_id_url', 'Discount ID is required.');
                }
            } else {
                $this->fail('discount_type', 'Invalid discount type.');
            }
        }
        if ($discount > $subtotal) {
            $this->fail('discount', 'Discount exceeds subtotal.');
        }
        $delivery = $manual ? $this->cents($data['delivery_fee'] ?? 0) : (($data['order_type'] ?? '') === 'Delivery' ? $this->cents($settings?->delivery_fee ?? 0) : 0);
        $tax = (int) round(($subtotal - $discount) * ($settings?->tax_rate ?? 0) / 100);
        if (! $manual && $subtotal < $this->cents($settings?->min_order ?? 0)) {
            $this->fail('items', 'Minimum order not met.');
        }

        return ['subtotal' => $subtotal / 100, 'discount' => $discount / 100, 'delivery_fee' => $delivery / 100, 'tax' => $tax / 100, 'total' => ($subtotal - $discount + $delivery + $tax) / 100];
    }

    private function payment(array $data): PaymentMethod
    {
        $method = PaymentMethod::where('name', $data['payment_method'] ?? '')->where('is_active', true)->first();
        if (! $method) {
            $this->fail('payment_method', 'Choose an active payment method.');
        }
        if ($method->requires_reference && empty($data['payment_reference'])) {
            $this->fail('payment_reference', 'Payment reference is required.');
        }
        if (($data['source'] ?? '') === 'Manual' && strtolower($method->name) === 'gcash' && ! in_array($data['gcash_type'] ?? '', ['Corporate', 'Personal'])) {
            $this->fail('gcash_type', 'Choose the GCash account type.');
        }

        return $method;
    }

    public function create(array $data, bool $manual): Order
    {
        return DB::transaction(function () use ($data, $manual) {
            if (! empty($data['request_key']) && ($existing = Order::where('request_key', $data['request_key'])->first())) {
                abort_unless(in_array($existing->id, session('order_ids', [])) || (auth()->id() && $existing->user_id === auth()->id()), 403);

                return $existing;
            }
            $branch = $manual ? ($data['branch'] ?? 'NAR Commi') : 'NAR Commi';
            if ($manual) {
                Access::branch($branch);
            }
            $settings = Setting::first();
            $type = $data['order_type'] ?? 'Delivery';
            $enabled = ['Delivery' => 'enable_delivery', 'Pick-up' => 'enable_takeout', 'Walk-in' => 'enable_takeout', 'Dine-In' => 'enable_dinein'];
            if (! $manual && ($settings?->{$enabled[$type]} === false || $settings?->coming_soon_enabled)) {
                $this->fail('order_type', 'Ordering is unavailable.');
            }
            if (! $manual && empty($data['customer_phone'])) {
                $this->fail('customer_phone', 'Phone is required.');
            }
            if ($type === 'Delivery') {
                foreach (['address', 'province', 'city', 'barangay'] as $key) {
                    if (empty($data[$key])) {
                        $this->fail($key, 'Delivery address is required.');
                    }
                }
            }
            $method = $this->payment($data);
            $lines = $this->priceItems($data['items'], $manual);
            $this->inventory->validateAvailability($lines, $branch);
            $totals = $this->totals($lines, $data, $manual);
            $date = now('Asia/Manila')->format('Ymd');
            DB::table('order_sequences')->insertOrIgnore(['date' => $date, 'value' => 0]);
            $seq = DB::table('order_sequences')->where('date', $date)->lockForUpdate()->first()->value + 1;
            if (! empty($data['request_key']) && ($existing = Order::where('request_key', $data['request_key'])->lockForUpdate()->first())) {
                abort_unless(in_array($existing->id, session('order_ids', [])) || (auth()->id() && $existing->user_id === auth()->id()), 403);

                return $existing;
            }
            DB::table('order_sequences')->where('date', $date)->update(['value' => $seq]);
            $status = $manual ? ((! empty($data['preferred_date']) && $data['preferred_date'] > now('Asia/Manila')->toDateString()) ? 'For Reservation' : 'Confirmed') : 'Pending';
            $order = new Order($data);
            $order->fill($totals);
            $order->forceFill(['order_number' => 'NAR-'.$date.'-'.str_pad((string) $seq, 4, '0', STR_PAD_LEFT), 'branch' => $branch, 'status' => $status, 'source' => $manual ? 'Manual' : 'Online', 'payment_status' => $manual && ($data['payment_status'] ?? '') === 'Paid' ? 'Paid' : 'Unpaid', 'inventory_deducted' => false, 'created_by_name' => auth()->user()?->name ?? 'Guest', 'user_id' => auth()->id(), 'payment_method_id' => $method->id, 'tracking_token' => (string) Str::uuid(), 'request_key' => $data['request_key'] ?? null]);
            if (! $manual) {
                $order->fill(['discount_type' => 'none', 'discount_reason' => null, 'discount_id_url' => null]);
            }
            $order->save();
            foreach ($lines as $line) {
                $mods = $line['modifiers'];
                unset($line['modifiers']);
                $created = $order->items()->create($line);
                $created->modifierRows()->createMany($mods);
            }
            $order->status_history()->create(['status' => $status, 'at' => now(), 'by' => $order->created_by_name]);
            session()->push('order_ids', $order->id);
            AuditService::record('Create order', $manual ? 'manual_order' : 'orders', $order->id, [], $order->toArray());

            return $order->fresh();
        }, 3);
    }

    public function update(string $id, array $data): Order
    {
        return DB::transaction(function () use ($id, $data) {
            $order = Order::whereNull('deleted_at')->lockForUpdate()->findOrFail($id);
            Access::branch($order->branch);
            $before = $order->toArray();
            $status = $data['status'] ?? $order->status;
            $action = match ($status) {
                'Cancelled' => 'cancel','Refunded' => 'refund',default => 'edit'
            };
            $nextKitchenStatus = match ($order->status) {
                'Pending','Confirmed' => 'Preparing', 'Preparing' => 'Ready', 'Ready' => 'Out for Delivery', default => null,
            };
            $kitchen = Access::allows(auth()->user(), 'kitchen', 'edit') && ($status === $nextKitchenStatus || $status === $order->status) && ! array_diff(array_keys($data), ['status', 'cook_name', 'reason']);
            if (! $kitchen) {
                Access::require('orders', $action);
            }
            if (! $kitchen && array_diff(array_keys($data), ['status', 'reason'])) {
                Access::require('orders', 'edit');
            }
            if (isset($data['payment_status']) && $data['payment_status'] === 'Refunded') {
                Access::require('orders', 'refund');
            }
            if ($order->status === 'Refunded' && $status !== 'Refunded') {
                $this->fail('status', 'Refunded orders are final.');
            }
            if ($order->inventory_deducted && ! in_array($status, ['Completed', 'Cancelled', 'Refunded'])) {
                $this->fail('status', 'A completed order must be cancelled or refunded before reopening.');
            }
            if ($status === 'Cancelled' && $order->status !== 'Cancelled' && empty($data['reason'])) {
                $this->fail('reason', 'Cancellation reason is required.');
            }
            if (isset($data['branch']) && $data['branch'] !== $order->branch) {
                $this->fail('branch', 'Order branch cannot be changed.');
            }
            if (isset($data['items'])) {
                $this->fail('items', 'Existing order lines cannot be replaced.');
            }
            if ($status === 'Refunded') {
                $data['payment_status'] = 'Refunded';
            }
            // Only explicit editable metadata; totals, identity and stock flags never come from requests.
            $allowed = ['customer_name', 'customer_phone', 'customer_email', 'order_type', 'table_number', 'address', 'province', 'city', 'barangay', 'postcode', 'landmark', 'preferred_date', 'preferred_time', 'payment_method', 'payment_status', 'payment_reference', 'payment_reference_2', 'gcash_type', 'delivery_fee', 'discount', 'discount_type', 'discount_reason', 'discount_id_url', 'notes', 'cook_name'];
            $order->fill(array_intersect_key($data, array_flip($allowed)));
            if (array_intersect(array_keys($data), ['payment_method', 'payment_reference', 'gcash_type'])) {
                $order->payment_method_id = $this->payment($order->toArray())->id;
            }
            if (array_intersect(array_keys($data), ['discount', 'discount_type', 'delivery_fee'])) {
                if (isset($data['discount']) && ! isset($data['discount_type']) && $this->cents($data['discount']) !== $this->cents($before['discount'])) {
                    $order->discount_type = 'custom';
                    $order->discount_reason = $data['discount_reason'] ?? 'Staff order adjustment';
                }
                $order->fill($this->totals($order->items->toArray(), $order->toArray(), true));
            }
            if ($status !== $order->status) {
                if ($status === 'Completed') {
                    $this->inventory->deductStock($order);
                }
                if (in_array($status, ['Cancelled', 'Refunded'])) {
                    $this->inventory->restoreStock($order);
                }
                $order->status_history()->create(['status' => $status, 'at' => now(), 'by' => auth()->user()->name, 'reason' => $data['reason'] ?? null]);
                $order->status = $status;
            }
            $order->save();
            AuditService::record('Update order', 'orders', $id, $before, $order->fresh()->toArray());

            return $order->fresh();
        }, 3);
    }

    public function delete(string $id): void
    {
        Access::require('orders', 'delete');
        DB::transaction(function () use ($id) {
            $order = Order::lockForUpdate()->findOrFail($id);
            Access::branch($order->branch);
            $this->inventory->restoreStock($order);
            $order->deleted_at = now();
            $order->save();
            AuditService::record('Delete order', 'orders', $id);
        });
    }
}
