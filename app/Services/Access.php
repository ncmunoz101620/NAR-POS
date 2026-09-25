<?php

namespace App\Services;

use App\Models\AppUser;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

class Access
{
    public const MODULES = ['dashboard', 'reports', 'raw_material_reports', 'orders', 'manual_order', 'kitchen', 'products', 'categories', 'ingredients', 'raw_materials', 'inventory', 'stock_transfers', 'recipes', 'payment_methods', 'users', 'roles', 'role_menu', 'audit_logs', 'settings'];

    public const ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'print', 'approve', 'cancel', 'refund'];

    public static function profile(?User $user): ?AppUser
    {
        return $user ? AppUser::with('staffRole.grants')->where('user_id', $user->id)->first() : null;
    }

    public static function allows(?User $user, string $module, string $action = 'view'): bool
    {
        if (! $user || ! $user->is_active || ! $user->email_verified_at) {
            return false;
        }
        $profile = self::profile($user);
        if (! $profile?->is_active || ! $profile->staffRole?->is_active) {
            return false;
        }

        return $profile->staffRole->grants->contains(fn ($g) => $g->module === $module && $g->action === $action);
    }

    public static function require(string $module, string $action = 'view'): void
    {
        Gate::authorize('module', [$module, $action]);
    }

    public static function any(array $modules, string $action = 'view'): bool
    {
        foreach ($modules as $module) {
            if (self::allows(auth()->user(), $module, $action)) {
                return true;
            }
        }

        return false;
    }

    public static function branch(?string $branch): void
    {
        $assigned = self::profile(auth()->user())?->branch;
        abort_if($assigned && $assigned !== 'All' && $assigned !== $branch, 403, 'This branch is outside your access.');
    }

    public static function scope($query, string $column = 'branch')
    {
        $assigned = self::profile(auth()->user())?->branch;

        return $assigned && $assigned !== 'All' ? $query->where($column, $assigned) : $query;
    }
}
