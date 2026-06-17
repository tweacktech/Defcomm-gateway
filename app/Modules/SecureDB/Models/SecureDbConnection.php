<?php

namespace App\Modules\SecureDB\Models;

use App\Models\User;
use App\Modules\SecureDB\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SecureDbConnection extends Model
{
    use HasUuid;
    use SoftDeletes;

    protected $table = 'secure_db_connections';

    protected $fillable = [
        'project_id', 'created_by', 'updated_by', 'name', 'database_type',
        'host', 'port', 'database_name', 'username_encrypted', 'password_encrypted',
        'ssl_enabled', 'ssh_tunnel_enabled', 'ssh_config_encrypted', 'health_status',
        'last_health_check_at', 'last_connected_at', 'last_error', 'auto_reconnect',
    ];

    protected $hidden = ['username_encrypted', 'password_encrypted', 'ssh_config_encrypted'];

    protected function casts(): array
    {
        return [
            'ssl_enabled' => 'boolean',
            'ssh_tunnel_enabled' => 'boolean',
            'auto_reconnect' => 'boolean',
            'last_health_check_at' => 'datetime',
            'last_connected_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(SecureDbProject::class, 'project_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
