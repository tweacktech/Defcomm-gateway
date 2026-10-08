<?php

namespace App\Modules\SecureDB\Models;

use App\Modules\SecureDB\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SecureDbWidgetAppKey extends Model
{
    use HasUuid;
    use SoftDeletes;

    protected $table = 'secure_db_widget_app_keys';

    protected $fillable = [
        'widget_id', 'project_id', 'name', 'key_prefix', 'key_lookup',
        'is_active', 'last_used_at', 'revoked_at',
    ];

    protected $hidden = ['key_lookup'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'last_used_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function widget(): BelongsTo
    {
        return $this->belongsTo(SecureDbWidget::class, 'widget_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(SecureDbProject::class, 'project_id');
    }

    public function isUsable(): bool
    {
        return $this->is_active && $this->revoked_at === null;
    }
}
