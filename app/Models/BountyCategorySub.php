<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BountyCategorySub extends Model
{
    protected $fillable = ['category_id', 'label'];

    public function category(): BelongsTo
    {
        return $this->belongsTo(BountyCategory::class, 'category_id');
    }
}
