<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CompanyGroupUser extends Model
{
    use HasFactory;

    protected $guarded = [];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id')->withDefault();
    }
    
    public function companyGroup()
    {
        return $this->belongsTo(CompanyGroup::class, 'group_id')->withDefault();
    }
    
    public function companyUser()
    {
        return $this->belongsTo(CompanyUser::class, 'company_id')->withDefault();
    }
}
