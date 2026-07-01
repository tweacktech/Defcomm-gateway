<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CompanyUser extends Model
{
    use HasFactory;

    protected $guarded = [];

    public function users()
    {
        return $this->hasMany(user::class, 'company_id');
    }
    
    public function user()
    {
        return $this->hasOne(user::class, 'user_id')->withDefault();
    }

    public function companyGroup()
    {
        return $this->hasMany(CompanyGroup::class, 'group_id');
    }
    
    public function companyGroupUser()
    {
        return $this->hasMany(CompanyGroupUser::class, 'company_id');
    }
    
    public function files()
    {
        return $this->hasMany(Files::class, 'company_id');
    }

    public function fileShareLog()
    {
        return $this->hasMany(FileShareLog::class, 'company_id');
    }
    
    public function notification()
    {
        return $this->hasMany(Notification::class, 'company_id');
    }
}
