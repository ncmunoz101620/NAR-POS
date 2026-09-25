<?php

namespace App\Console\Commands;

use App\Models\AppUser;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class CreateAdministrator extends Command
{
    protected $signature = 'app:create-admin {email} {--name=Administrator}';

    protected $description = 'Create an administrator with a password entered securely at the terminal';

    public function handle(): int
    {
        $email = strtolower($this->argument('email'));
        $password = $this->secret('Password (at least 12 characters)');
        $data = ['email' => $email, 'password' => $password];
        $validator = Validator::make($data, ['email' => 'required|email|unique:users,email', 'password' => 'required|string|min:12|max:128']);
        if ($validator->fails()) {
            $this->error($validator->errors()->first());

            return self::FAILURE;
        }
        DB::transaction(function () use ($data) {
            $role = Role::where('name', 'ADMIN')->firstOrFail();
            $user = User::create($data + ['name' => $this->option('name')]);
            $user->role = 'admin';
            $user->email_verified_at = now();
            $user->save();
            $profile = new AppUser(['name' => $user->name, 'email' => $user->email, 'role_name' => 'ADMIN', 'branch' => 'All', 'is_active' => true]);
            $profile->user_id = $user->id;
            $profile->role_id = $role->id;
            $profile->save();
            AuditService::record('Bootstrap administrator', 'users', (string) $user->id);
        });
        $this->info('Administrator created.');

        return self::SUCCESS;
    }
}
