<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserPlan extends Model
{
    protected $table = 'user_plans';

    protected $fillable = [
        'name',
        'file_size',
        'no_user',
        'no_group',
        'enable_chat',
        'enable_meeting',
        'enable_walkie',
        'enable_call',
        'description',
        'status',
    ];
}
