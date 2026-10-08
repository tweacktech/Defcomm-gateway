<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BountyCategory extends Model
{
    protected $fillable = ['label', 'description'];

    public function subs(): HasMany
    {
        return $this->hasMany(BountyCategorySub::class, 'category_id');
    }
}
