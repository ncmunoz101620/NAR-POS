<?php

namespace App\Models;

class AuditLog extends DomainModel
{
    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('Audit records are immutable.'));
        static::deleting(fn () => throw new \LogicException('Audit records are immutable.'));
    }

    protected $table = 'audit_logs';

    protected $fillable = ['user_name', 'action', 'module', 'record_id', 'previous_value', 'new_value'];

    protected $casts = [];
}
