<?php

use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('event_sales', function (Blueprint $table) {
            $table->date('event_date')->nullable()->index();
        });

        DB::table('event_sales')->select('id', 'created_at')->orderBy('id')->chunk(500, function ($sales) {
            foreach ($sales as $sale) {
                DB::table('event_sales')->where('id', $sale->id)->update([
                    'event_date' => CarbonImmutable::parse($sale->created_at, 'UTC')->setTimezone('Asia/Manila')->toDateString(),
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('event_sales', function (Blueprint $table) {
            $table->dropIndex(['event_date']);
            $table->dropColumn('event_date');
        });
    }
};
