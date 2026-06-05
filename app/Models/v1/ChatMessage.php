<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

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

    public function companyGroup()
    {
        return $this->belongsTo(CompanyGroup::class, 'group_to')->withDefault();
    }

    public function chatCall()
    {
        return $this->hasOne(ChatCallLog::class, 'mss_id')->withDefault();
    }

    public function chatLast()
    {
        return $this->hasOne(ChatLastLog::class, 'chat_id')->withDefault();
    }

    public function parent()
    {
        return $this->belongsTo(ChatMessage::class, 'tag_mess')->withDefault();
    }

    public function children()
    {
        return $this->hasMany(ChatMessage::class, 'tag_mess');
    }
}
