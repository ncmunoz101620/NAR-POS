<?php

namespace App\Models;

class AppUser extends DomainModel
{
    protected $table = 'app_users';

    protected $fillable = ['name', 'email', 'mobile', 'role_name', 'branch', 'is_active', 'last_login'];

    protected $casts = ['is_active' => 'boolean'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function staffRole()
    {
        return $this->belongsTo(Role::class, 'role_id');
    }
}
