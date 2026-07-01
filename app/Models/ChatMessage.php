<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ChatMessage extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $guarded = [];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id')->withDefault();
    }

    public function userTo()
    {
        return $this->belongsTo(User::class, 'user_to')->withDefault();
    }

    public function chatLast()
    {
        return $this->hasOne(ChatLastLog::class, 'chat_id')->withDefault();
    }
}
