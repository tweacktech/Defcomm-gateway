<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EventForm extends Model
{
    protected $fillable = [
        'organization_id',
        'created_by',
        'group_id',
        'meet_room_id',
        'title',
        'form_type',
        'description',
        'message',
        'starts_at',
        'ends_at',
        'location',
        'latitude',
        'longitude',
        'timezone',
        'is_active',
        'signup',
        'attendance',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(OrganizationGroup::class, 'group_id');
    }

    public function meetRoom(): BelongsTo
    {
        return $this->belongsTo(MeetRoom::class, 'meet_room_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(EventRegistration::class);
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(EventAttendance::class);
    }

    public function certificates(): HasMany
    {
        return $this->hasMany(Certificate::class);
    }

    public function souvenirs(): HasMany
    {
        return $this->hasMany(Souvenir::class);
    }

    public function isAttendanceEnabled(): bool
    {
        return $this->attendance === 'enabled';
    }

    public function isSignupEnabled(): bool
    {
        return $this->signup === 'enabled';
    }

    public function payload(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'form_type' => $this->form_type,
            'description' => $this->description,
            'message' => $this->message,
            'starts_at' => $this->starts_at?->format('Y-m-d\TH:i'),
            'ends_at' => $this->ends_at?->format('Y-m-d\TH:i'),
            'location' => $this->location,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'timezone' => $this->timezone,
            'is_active' => (bool) $this->is_active,
            'signup' => $this->signup ?: 'disabled',
            'attendance' => $this->attendance ?: 'disabled',
            'status' => $this->status ?: ($this->is_active ? 'active' : 'block'),
            'group_id' => $this->group_id,
            'meet_room_id' => $this->meet_room_id,
            'group' => $this->group ? ['id' => $this->group->id, 'name' => $this->group->name] : null,
            'meet_room' => $this->meetRoom ? ['id' => $this->meetRoom->id, 'name' => $this->meetRoom->name] : null,
            'registrations_count' => $this->registrations_count ?? $this->registrations()->count(),
        ];
    }
}
