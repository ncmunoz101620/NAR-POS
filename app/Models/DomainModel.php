<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

abstract class DomainModel extends Model
{
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->mergeCasts(['deleted_at' => 'datetime']);
    }

    use HasUuids;

    protected $appends = ['created_date'];

    public function getCreatedDateAttribute()
    {
        return $this->created_at?->toISOString();
    }
}
