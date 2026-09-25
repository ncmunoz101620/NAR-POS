<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('uploaded_assets', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->foreignId('user_id')->constrained()->restrictOnDelete();
            $t->string('purpose');
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('uploaded_assets');
    }
};
