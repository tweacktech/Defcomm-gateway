<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContactList extends Model
{
    protected $fillable = ['user_id', 'user_link', 'status'];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_link');
    }
}
