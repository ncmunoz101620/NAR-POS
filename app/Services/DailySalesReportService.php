<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Setting;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class DailySalesReportService
{
    public function previousBusinessDate(): CarbonImmutable
    {
        return CarbonImmutable::now('Asia/Manila')->subDay()->startOfDay();
    }

    public function recipients(?Setting $settings = null): array
    {
        $settings ??= Setting::first();
        $recipients = $settings?->daily_sales_report_recipients ?? [];
        if (is_string($recipients)) {
            $decoded = json_decode($recipients, true);
            $recipients = is_array($decoded) ? $decoded : preg_split('/[,;\s]+/', $recipients);
        }

        return collect($recipients)
            ->map(fn ($email) => strtolower(trim((string) $email)))
            ->filter(fn ($email) => filter_var($email, FILTER_VALIDATE_EMAIL))
            ->unique()
            ->values()
            ->all();
    }

    public function dataForDate(CarbonImmutable $date): array
    {
        $start = $date->setTimezone('Asia/Manila')->startOfDay();
        $end = $start->addDay();
        $orders = Order::query()
            ->without(['items', 'status_history'])
            ->whereNull('deleted_at')
            ->where('created_at', '>=', $start->utc())
            ->where('created_at', '<', $end->utc());
        $valid = (clone $orders)->whereNotIn('status', ['Cancelled', 'Refunded']);
        $validIds = (clone $valid)->select('id');
        $totalSales = (float) (clone $valid)->sum('total');
        $orderCount = (clone $valid)->count();
        $itemsSold = (int) DB::table('order_items')->whereIn('order_id', $validIds)->sum('quantity');

        return [
            'date' => $start,
            'restaurant' => Setting::first()?->restaurant_name ?: 'Nanay Asa Restaurant',
            'totalSales' => $totalSales,
            'orderCount' => $orderCount,
            'itemsSold' => $itemsSold,
            'averageOrder' => $orderCount ? $totalSales / $orderCount : 0,
            'cancelledCount' => (clone $orders)->where('status', 'Cancelled')->count(),
            'cancelledAmount' => (float) (clone $orders)->where('status', 'Cancelled')->sum('total'),
            'salesByBranch' => $this->groupOrders((clone $valid), 'branch'),
            'salesByOrderType' => $this->groupOrders((clone $valid), 'order_type'),
            'salesByPaymentMethod' => $this->paymentRows((clone $valid)),
            'topProducts' => DB::table('order_items')
                ->whereIn('order_id', $validIds)
                ->select('product_name', 'variant_name')
                ->selectRaw('SUM(quantity) as qty, SUM(subtotal) as revenue')
                ->groupBy('product_name', 'variant_name')
                ->orderByDesc('revenue')
                ->limit(10)
                ->get()
                ->map(fn ($row) => [
                    'label' => trim($row->product_name.' · '.$row->variant_name, ' ·'),
                    'count' => (int) $row->qty,
                    'amount' => (float) $row->revenue,
                ])
                ->all(),
        ];
    }

    public function sendForDate(CarbonImmutable $date, ?array $to = null): int
    {
        $settings = Setting::first();
        $recipients = $to ?: $this->recipients($settings);
        if ($recipients === []) {
            return 0;
        }

        $this->assertDeliveryMailer((string) config('mail.default'));
        $data = $this->dataForDate($date);
        $subject = 'Nanay Asa Daily Sales Report - '.$data['date']->format('F j, Y');
        $html = $this->html($data, $settings);

        try {
            $sent = Mail::html($html, function ($message) use ($recipients, $subject) {
                $message->to($recipients)->subject($subject);
            });
        } catch (TransportExceptionInterface $exception) {
            throw ValidationException::withMessages(['mail' => 'The mail provider could not accept the report. Check the outgoing mail settings and provider delivery logs before retrying.']);
        }
        if ($sent === null) {
            throw ValidationException::withMessages(['mail' => 'The report was not submitted to the mail provider.']);
        }

        return count($recipients);
    }

    private function assertDeliveryMailer(string $name, array $visited = []): void
    {
        $mailer = config('mail.mailers.'.$name);
        $transport = $mailer['transport'] ?? null;
        if (! $transport || in_array($transport, ['log', 'array'], true) || in_array($name, $visited, true)) {
            throw ValidationException::withMessages(['mail' => 'Email delivery is not configured. Ask the administrator to configure a delivery mailer (such as SMTP) and refresh the cached configuration. Log and array mailers do not deliver email.']);
        }
        if (in_array($transport, ['failover', 'roundrobin'], true)) {
            $children = $mailer['mailers'] ?? [];
            if ($children === []) {
                throw ValidationException::withMessages(['mail' => 'No delivery mailer is configured for reports.']);
            }
            foreach ($children as $child) {
                $this->assertDeliveryMailer($child, [...$visited, $name]);
            }
        }
    }

    public function html(array $data, ?Setting $settings = null): string
    {
        $currency = $settings?->currency_symbol ?: '₱';
        $date = $data['date']->format('F j, Y');
        $restaurant = e($data['restaurant']);
        $money = fn ($amount) => e($currency.number_format((float) $amount, 2));
        $number = fn ($amount) => e(number_format((float) $amount, 0));
        $rows = fn (array $items, string $empty = 'No sales recorded.') => count($items)
            ? collect($items)->map(fn ($row) => '<tr><td>'.e($row['label']).'</td><td style="text-align:right"><strong>'.e($row['count']).'</strong> &middot; '.$money($row['amount']).'</td></tr>')->implode('')
            : '<tr><td colspan="2" style="color:#9b6a57">'.e($empty).'</td></tr>';
        $productRows = count($data['topProducts'])
            ? collect($data['topProducts'])->map(fn ($row) => '<tr><td>'.e($row['label']).'</td><td style="text-align:right"><strong>'.e($row['count']).' sold</strong> &middot; '.$money($row['amount']).'</td></tr>')->implode('')
            : '<tr><td colspan="2" style="color:#9b6a57">No product sales recorded.</td></tr>';

        return <<<HTML
<!doctype html>
<html>
<body style="margin:0;background:#fbf6ef;font-family:Arial,Helvetica,sans-serif;color:#581e12">
  <div style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #f0dfd0">
    <div style="background:#682116;color:#fff;padding:26px 30px">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">{$restaurant}</div>
      <h1 style="margin:8px 0 4px;font-size:28px;line-height:1.15">Daily Sales Report</h1>
      <div style="font-size:14px;opacity:.9">{$date}</div>
    </div>
    <div style="padding:26px 30px">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px">
        <div style="border:1px solid #f0dfd0;border-radius:12px;padding:16px;text-align:center"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#9b6a57">Total Sales</div><strong style="display:block;margin-top:8px;font-size:20px;color:#ee8720">{$money($data['totalSales'])}</strong></div>
        <div style="border:1px solid #f0dfd0;border-radius:12px;padding:16px;text-align:center"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#9b6a57">Orders</div><strong style="display:block;margin-top:8px;font-size:20px">{$number($data['orderCount'])}</strong></div>
        <div style="border:1px solid #f0dfd0;border-radius:12px;padding:16px;text-align:center"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#9b6a57">Items Sold</div><strong style="display:block;margin-top:8px;font-size:20px;color:#ee8720">{$number($data['itemsSold'])}</strong></div>
        <div style="border:1px solid #f0dfd0;border-radius:12px;padding:16px;text-align:center"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#9b6a57">Avg. Order</div><strong style="display:block;margin-top:8px;font-size:20px">{$money($data['averageOrder'])}</strong></div>
      </div>
      <h2 style="font-size:16px;margin:24px 0 8px">Sales by Branch</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">{$rows($data['salesByBranch'])}<tr><td style="border-top:2px solid #f0dfd0;padding:10px 8px">Total</td><td style="border-top:2px solid #f0dfd0;padding:10px 8px;text-align:right"><strong>{$money($data['totalSales'])}</strong></td></tr></table>
      <h2 style="font-size:16px;margin:28px 0 8px">Sales by Order Type</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">{$rows($data['salesByOrderType'])}<tr><td style="border-top:2px solid #f0dfd0;padding:10px 8px">Total</td><td style="border-top:2px solid #f0dfd0;padding:10px 8px;text-align:right"><strong>{$money($data['totalSales'])}</strong></td></tr></table>
      <h2 style="font-size:16px;margin:28px 0 8px">Sales by Payment Method</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">{$rows($data['salesByPaymentMethod'])}<tr><td style="border-top:2px solid #f0dfd0;padding:10px 8px">Total</td><td style="border-top:2px solid #f0dfd0;padding:10px 8px;text-align:right"><strong>{$money($data['totalSales'])}</strong></td></tr></table>
      <h2 style="font-size:16px;margin:28px 0 8px">Top Products</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">{$productRows}</table>
      <p style="margin:28px 0 0;text-align:center;color:#9b6a57;font-size:12px;font-style:italic">Generated automatically by Nanay Asa Restaurant · Nanay Asa POS</p>
    </div>
  </div>
</body>
</html>
HTML;
    }

    private function groupOrders($query, string $column): array
    {
        return $query
            ->selectRaw("COALESCE({$column}, 'Unspecified') as label")
            ->selectRaw('COUNT(*) as count, SUM(total) as amount')
            ->groupBy($column)
            ->orderByDesc('amount')
            ->get()
            ->map(fn ($row) => ['label' => $row->label ?: 'Unspecified', 'count' => (int) $row->count, 'amount' => (float) $row->amount])
            ->all();
    }

    private function paymentRows($query): array
    {
        return $query
            ->select('payment_method', 'gcash_type')
            ->selectRaw('COUNT(*) as count, SUM(total) as amount')
            ->groupBy('payment_method', 'gcash_type')
            ->orderByDesc('amount')
            ->get()
            ->map(function ($row) {
                $label = $row->payment_method ?: 'Unspecified';
                if (strtolower($label) === 'gcash' && $row->gcash_type) {
                    $label .= ' · '.$row->gcash_type;
                }

                return ['label' => $label, 'count' => (int) $row->count, 'amount' => (float) $row->amount];
            })
            ->all();
    }
}

