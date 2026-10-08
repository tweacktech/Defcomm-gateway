<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StatementAgreement extends Model
{
    protected $fillable = ['title', 'slug', 'content', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
