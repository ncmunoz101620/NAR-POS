<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gmail_report_connections', function (Blueprint $table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->string('sender');
            $table->text('refresh_token');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gmail_report_connections');
    }
};
