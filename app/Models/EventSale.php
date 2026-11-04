<?php

namespace App\Models;

class EventSale extends DomainModel
{
    protected $fillable = ['event_name', 'event_date', 'amount', 'recorded_by'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('Event sales are immutable.'));
        static::deleting(fn () => throw new \LogicException('Event sales are immutable.'));
    }
}
