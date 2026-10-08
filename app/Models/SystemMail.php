<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemMail extends Model
{
    protected $fillable = ['key', 'subject', 'body', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
