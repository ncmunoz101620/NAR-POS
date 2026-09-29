<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Services\DailySalesReportService;
use Illuminate\Console\Command;

class SendDailySalesReport extends Command
{
    protected $signature = 'reports:daily-sales {--date= : Manila date to report, default yesterday} {--force : Send even when the setting is disabled}';

    protected $description = "Email yesterday's sales and performance report to configured recipients";

    public function handle(DailySalesReportService $reports): int
    {
        $settings = Setting::first();
        if (! $this->option('force') && ! $settings?->daily_sales_report_enabled) {
            $this->info('Daily sales report is disabled.');
            return self::SUCCESS;
        }

        $date = $this->option('date')
            ? \Carbon\CarbonImmutable::parse($this->option('date'), 'Asia/Manila')->startOfDay()
            : $reports->previousBusinessDate();

        $sent = $reports->sendForDate($date);
        $this->info("Daily sales report sent to {$sent} recipient(s) for ".$date->toDateString().'.');

        return self::SUCCESS;
    }
}
