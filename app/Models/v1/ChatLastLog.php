<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ChatLastLog extends Model
{
    use HasFactory;

    protected $guarded = [];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id')->withDefault();
    }
    
    public function userTo()
    {
        return $this->belongsTo(User::class, 'user_to')->withDefault();
    }

    public function companyGroup()
    {
        return $this->belongsTo(CompanyGroup::class, 'group_to')->withDefault();
    }

    public function chat()
    {
        return $this->belongsTo(ChatMessage::class, 'chat_id')->withDefault();
    }
}
