<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrganizationGroup extends Model
{
    protected $fillable = ['organization_id', 'name', 'description', 'avatar'];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(OrganizationGroupUser::class, 'group_id');
    }
}
