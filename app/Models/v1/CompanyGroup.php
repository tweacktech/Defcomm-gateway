<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CompanyGroup extends Model
{
    use HasFactory;

    protected $guarded = [];

    public function company()
    {
        return $this->belongsTo(CompanyUser::class, 'company_id')->withDefault();
    }

    public function user()
    {
        return $this->hasMany(User::class, 'user_id');
    }
    
    public function filesShares()
    {
        return $this->hasMany(FilesShares::class, 'group_id');
    }

    public function chatMessage()
    {
        return $this->hasMany(ChatMessage::class, 'group_to');
    }

    public function chatLastLog()
    {
        return $this->hasMany(ChatLastLog::class, 'group_to');
    }

    public function event()
    {
        return $this->hasMany(EventForm::class, 'group_id');
    }
}
