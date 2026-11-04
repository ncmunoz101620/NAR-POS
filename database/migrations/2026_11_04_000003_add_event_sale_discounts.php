<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('event_sales', function (Blueprint $table) {
            $table->renameColumn('amount', 'gross_sales');
        });
        Schema::table('event_sales', function (Blueprint $table) {
            $table->decimal('discount', 15, 2)->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('event_sales', function (Blueprint $table) {
            $table->dropColumn('discount');
        });
        Schema::table('event_sales', function (Blueprint $table) {
            $table->renameColumn('gross_sales', 'amount');
        });
    }
};
