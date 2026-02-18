<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApiClient extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'name',
        'client_id',
        'client_secret',
        'ip_address',
        'user_agent',
        'active',
    ];

    protected $hidden = [
        'client_secret',
    ];

    /**
     * Get the user that owns this API client.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
