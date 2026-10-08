<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BountyProgram extends Model
{
    protected $fillable = ['title', 'detail', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
