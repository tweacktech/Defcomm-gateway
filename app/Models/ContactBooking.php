<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContactBooking extends Model
{
    protected $fillable = ['name', 'email', 'phone', 'company', 'preferred_at', 'notes', 'status'];

    protected function casts(): array
    {
        return ['preferred_at' => 'datetime'];
    }
}
