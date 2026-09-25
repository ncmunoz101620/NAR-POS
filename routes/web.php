<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\EntityController;
use App\Http\Controllers\ImportController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\UploadController;
use App\Models\Order;
use App\Services\Access;
use Illuminate\Support\Facades\Route;

Route::get('/auth/google', [AuthController::class, 'google']);
Route::get('/auth/google/callback', [AuthController::class, 'googleCallback']);
Route::prefix('api')->group(function () {
    Route::get('/csrf', fn () => ['token' => csrf_token()]);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::middleware('throttle:6,1')->group(function () {
        foreach (['login', 'register', 'verify', 'resend', 'forgot', 'reset'] as $action) {
            Route::post('/auth/'.$action, [AuthController::class, $action]);
        }
    });
    Route::get('/track', [OrderController::class, 'track'])->middleware('throttle:30,1');
    Route::post('/orders', [OrderController::class, 'store'])->middleware('throttle:30,1');
    Route::middleware('auth')->group(function () {
        Route::get('/kitchen', function () {
            Access::require('kitchen');

            return Access::scope(Order::whereNull('deleted_at')->whereIn('status', ['Pending', 'Confirmed', 'Preparing', 'Ready']))->orderBy('created_at')->get()->map(fn ($order) => $order->only(['id', 'order_number', 'customer_name', 'order_type', 'table_number', 'branch', 'status', 'cook_name', 'notes', 'created_date', 'preferred_date', 'preferred_time', 'items', 'status_history']));
        });
        Route::get('/orders', [OrderController::class, 'index']);
        Route::post('/imports/{entity}', [ImportController::class, 'store']);
        Route::patch('/orders/{id}', [OrderController::class, 'update']);
        Route::delete('/orders/{id}', [OrderController::class, 'destroy']);
        Route::post('/inventory/movements', [InventoryController::class, 'movement']);
        Route::post('/inventory/transfers', [InventoryController::class, 'transfer']);
        Route::post('/uploads', [UploadController::class, 'store']);
        Route::get('/uploads/{name}', [UploadController::class, 'show']);
        Route::get('/reports/{type}', [ReportController::class, 'show']);
        Route::post('/entities/{entity}', [EntityController::class, 'store']);
        Route::patch('/entities/{entity}/{id}', [EntityController::class, 'update']);
        Route::delete('/entities/{entity}/{id}', [EntityController::class, 'destroy']);
    });
    Route::get('/entities/{entity}/{id?}', [EntityController::class, 'index']);
    Route::any('/{path}', fn () => abort(404))->where('path', '.*');
});
Route::get('/login', fn () => view('app'))->name('login');
Route::get('/{path?}', fn () => view('app'))->where('path', '.*');
