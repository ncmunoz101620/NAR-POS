<?php

namespace App\Models;

class Role extends DomainModel
{
    protected $table = 'roles';

    protected $fillable = ['name', 'description', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    protected $appends = ['created_date', 'permissions'];

    protected $with = ['grants'];

    protected $hidden = ['grants'];

    public function grants()
    {
        return $this->hasMany(RolePermission::class);
    }

    public function getPermissionsAttribute()
    {
        return $this->grants->groupBy('module')->map(fn ($g, $module) => ['module' => $module, 'actions' => $g->pluck('action')->all()])->values()->all();
    }
}
