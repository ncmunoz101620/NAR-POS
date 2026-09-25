<?php

namespace App\Providers;

use App\Services\Access;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::define('module', fn ($user, $module, $action = 'view') => Access::allows($user, $module, $action));
        ResetPassword::createUrlUsing(fn ($user, $token) => url('/reset-password').'?token='.urlencode($token).'&email='.urlencode($user->email));
    }
}
