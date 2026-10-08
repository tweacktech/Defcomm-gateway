<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrganizationGroupUser extends Model
{
    protected $fillable = [
        'organization_id', 'group_id', 'user_id', 'join_date', 'status', 'hide',
    ];

    protected function casts(): array
    {
        return [
            'join_date' => 'datetime',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(OrganizationGroup::class, 'group_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
