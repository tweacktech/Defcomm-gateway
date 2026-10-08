<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Models\EventAttendance;
use App\Models\EventForm;
use App\Models\EventRegistration;
use App\Models\Souvenir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventsApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $orgId = $request->user()->organization_id;

        $events = EventForm::query()
            ->where('is_active', true)
            ->when(
                $orgId,
                fn ($q) => $q->where('organization_id', $orgId),
                fn ($q) => $q->whereNull('organization_id'),
            )
            ->latest()
            ->get(['id', 'title', 'description', 'starts_at', 'ends_at', 'organization_id']);

        return $this->ok($events);
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'event_form_id' => 'required|integer|exists:event_forms,id',
            'data' => 'nullable|array',
        ]);

        $form = EventForm::query()->findOrFail($data['event_form_id']);
        $user = $request->user();
        $orgId = $user->organization_id;

        abort_unless(
            $user->isSuperAdmin()
            || ($orgId && (int) $form->organization_id === (int) $orgId),
            403,
            'Event does not belong to your organization.'
        );

        $registration = EventRegistration::updateOrCreate(
            [
                'event_form_id' => $data['event_form_id'],
                'user_id' => $user->id,
            ],
            [
                'status' => 'registered',
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'data' => $data['data'] ?? null,
            ],
        );

        return $this->ok([
            'id' => $registration->id,
            'event_form_id' => $registration->event_form_id,
            'status' => $registration->status,
        ], 'Registered.', 201);
    }

    public function attendance(Request $request): JsonResponse
    {
        $rows = EventAttendance::query()
            ->where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return $this->ok($rows);
    }

    public function clock(Request $request): JsonResponse
    {
        $data = $request->validate([
            'event_form_id' => 'required|integer|exists:event_forms,id',
            'type' => 'required|in:in,out',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
        ]);

        $form = EventForm::query()->findOrFail($data['event_form_id']);
        $orgId = $request->user()->organization_id;
        abort_unless(
            $request->user()->isSuperAdmin()
            || ($orgId && (int) $form->organization_id === (int) $orgId),
            403,
            'Event does not belong to your organization.'
        );

        $attendance = EventAttendance::query()
            ->where('event_form_id', $data['event_form_id'])
            ->where('user_id', $request->user()->id)
            ->whereNull('clock_out_at')
            ->latest()
            ->first();

        if ($data['type'] === 'in') {
            $attendance = EventAttendance::create([
                'event_form_id' => $data['event_form_id'],
                'user_id' => $request->user()->id,
                'clock_in_at' => now(),
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
            ]);
        } else {
            abort_unless($attendance, 422, 'No open attendance to clock out.');
            $attendance->update([
                'clock_out_at' => now(),
                'latitude' => $data['latitude'] ?? $attendance->latitude,
                'longitude' => $data['longitude'] ?? $attendance->longitude,
            ]);
        }

        return $this->ok($attendance, 'Attendance recorded.');
    }

    public function certificates(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $rows = Certificate::query()
            ->where(function ($q) use ($userId) {
                $q->where('user_id', $userId)
                    ->orWhereHas('registrationLinks.registration', fn ($q) => $q->where('user_id', $userId));
            })
            ->latest()
            ->get(['id', 'event_form_id', 'title', 'code', 'file_path', 'template', 'created_at']);

        return $this->ok($rows);
    }

    public function souvenirs(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $rows = Souvenir::query()
            ->where(function ($q) use ($userId) {
                $q->where('user_id', $userId)
                    ->orWhereHas('registrationLinks.registration', fn ($q) => $q->where('user_id', $userId));
            })
            ->latest()
            ->get(['id', 'event_form_id', 'title', 'status', 'image', 'created_at']);

        return $this->ok($rows);
    }

    protected function ok(mixed $data, string $message = 'OK', int $status = 200): JsonResponse
    {
        return response()->json([
            'status' => (string) $status,
            'message' => $message,
            'data' => $data,
        ], $status === 201 ? 201 : 200);
    }
}
