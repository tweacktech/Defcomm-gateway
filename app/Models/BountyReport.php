<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BountyReport extends Model
{
    protected $fillable = [
        'ref', 'bounty_user_id', 'program_id', 'category_id', 'category_sub_id',
        'title', 'detail', 'severity', 'attachments', 'status',
    ];

    protected function casts(): array
    {
        return ['attachments' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(BountyUser::class, 'bounty_user_id');
    }
}
