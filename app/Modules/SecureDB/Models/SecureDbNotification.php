<?php

namespace App\Modules\SecureDB\Models;

use App\Models\User;
use App\Modules\SecureDB\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SecureDbNotification extends Model
{
    use HasUuid;

    protected $table = 'secure_db_notifications';

    protected $fillable = [
        'project_id', 'user_id', 'channel', 'type', 'title', 'message',
        'metadata', 'is_read', 'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'is_read' => 'boolean',
            'sent_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
