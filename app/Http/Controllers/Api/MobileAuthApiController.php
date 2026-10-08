<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\QrLoginRequest;
use App\Models\User;
use App\Models\UserLoginDevice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class MobileAuthApiController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => ['required', 'confirmed', Password::defaults()],
            'phone' => 'nullable|string|max:40',
            'organization_id' => 'nullable|integer|exists:organizations,id',
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'phone' => $data['phone'] ?? null,
            'organization_id' => $data['organization_id'] ?? null,
            'role' => 'user',
            'status' => 'active',
        ]);

        return response()->json([
            'status' => '200',
            'message' => 'Registered successfully.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'device_id' => 'nullable|string|max:120',
            'device_type' => 'nullable|string|max:40',
            'fcm_token' => 'nullable|string|max:512',
        ]);

        $user = User::query()->where('email', $data['email'])->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['status' => '401', 'message' => 'Invalid credentials.', 'data' => null], 401);
        }

        if ($user->status !== 'active') {
            return response()->json(['status' => '403', 'message' => 'Account is not active.', 'data' => null], 403);
        }

        if (! empty($data['device_id'])) {
            $device = UserLoginDevice::query()
                ->where('user_id', $user->id)
                ->where('device_id', $data['device_id'])
                ->first();

            if ($device && $device->status === 'block') {
                return response()->json(['status' => '401', 'message' => 'Device is blocked.', 'data' => null], 401);
            }

            UserLoginDevice::updateOrCreate(
                ['user_id' => $user->id, 'device_id' => $data['device_id']],
                [
                    'device_type' => $data['device_type'] ?? null,
                    'fcm_token' => $data['fcm_token'] ?? null,
                    'status' => 'active',
                    'last_heartbeat_at' => now(),
                ],
            );
        }

        if (! empty($data['fcm_token'])) {
            $user->forceFill([
                'fcm_token' => $data['fcm_token'],
                'device_token' => $data['fcm_token'],
                'device_type' => $data['device_type'] ?? $user->device_type,
            ])->save();
        }

        $token = $user->createToken('mobile_auth')->plainTextToken;

        return response()->json([
            'status' => '200',
            'message' => 'Login successful.',
            'data' => [
                'access_token' => $token,
                'token_type' => 'Bearer',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'organization_id' => $user->organization_id,
                ],
                'device_id' => $data['device_id'] ?? null,
            ],
        ]);
    }

    public function requestOtp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        $otp = (string) random_int(100000, 999999);
        cache()->put('mobile_otp:'.$data['email'], $otp, now()->addMinutes(10));

        return response()->json([
            'status' => '200',
            'message' => 'OTP sent.',
            'data' => [
                // Exposed for local/dev parity with socket; production should email/SMS only.
                'otp' => app()->environment('production') ? null : $otp,
            ],
        ]);
    }

    public function verifyOtp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required|email|exists:users,email',
            'otp' => 'required|string',
        ]);

        $cached = cache()->get('mobile_otp:'.$data['email']);
        if (! $cached || $cached !== $data['otp']) {
            return response()->json(['status' => '400', 'message' => 'Invalid OTP.', 'data' => null], 400);
        }

        cache()->forget('mobile_otp:'.$data['email']);
        $user = User::query()->where('email', $data['email'])->firstOrFail();
        $token = $user->createToken('mobile_auth')->plainTextToken;

        return response()->json([
            'status' => '200',
            'message' => 'OTP verified.',
            'data' => [
                'access_token' => $token,
                'token_type' => 'Bearer',
                'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email],
            ],
        ]);
    }

    public function qrCreate(): JsonResponse
    {
        $code = (string) Str::uuid();
        $expires = now()->addMinutes(5);

        QrLoginRequest::create([
            'code' => $code,
            'status' => 'pending',
            'expires_at' => $expires,
        ]);

        return response()->json([
            'code' => $code,
            'expires_at' => $expires->toIso8601String(),
            'qr_payload' => $code,
        ], 201);
    }

    public function qrStatus(string $code): JsonResponse
    {
        $qr = QrLoginRequest::query()->where('code', $code)->first();
        if (! $qr) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if ($qr->status === 'pending' && $qr->expires_at->isPast()) {
            $qr->update(['status' => 'expired']);
        }

        return response()->json([
            'status' => $qr->status,
            'approved_user_id' => $qr->approved_user_id,
        ]);
    }

    public function qrApprove(Request $request, string $code): JsonResponse
    {
        $request->validate(['confirm' => 'required|boolean']);
        abort_unless($request->boolean('confirm'), 422, 'Confirmation required.');

        $qr = QrLoginRequest::query()->where('code', $code)->firstOrFail();
        if ($qr->expires_at->isPast()) {
            $qr->update(['status' => 'expired']);

            return response()->json(['message' => 'QR code expired.'], 422);
        }

        $qr->update([
            'status' => 'approved',
            'approved_user_id' => $request->user()->id,
            'approved_at' => now(),
        ]);

        return response()->json(['message' => 'QR login approved.']);
    }

    public function qrExchange(string $code): JsonResponse
    {
        $qr = QrLoginRequest::query()->where('code', $code)->firstOrFail();
        if ($qr->status !== 'approved' || ! $qr->approved_user_id) {
            return response()->json(['status' => '400', 'message' => 'QR not approved.', 'data' => null], 400);
        }

        if ($qr->expires_at->isPast()) {
            $qr->update(['status' => 'expired']);

            return response()->json(['status' => '400', 'message' => 'QR expired.', 'data' => null], 400);
        }

        $user = User::query()->findOrFail($qr->approved_user_id);
        $token = $user->createToken('browser')->plainTextToken;
        $qr->update(['status' => 'redeemed', 'redeemed_at' => now()]);

        return response()->json([
            'status' => '200',
            'message' => 'Login successful.',
            'data' => [
                'access_token' => $token,
                'token_type' => 'Bearer',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ],
            ],
        ]);
    }

    public function heartbeat(Request $request): JsonResponse
    {
        $data = $request->validate([
            'device_id' => 'nullable|string|max:120',
        ]);

        $user = $request->user();
        $user->forceFill([
            'is_online' => true,
            'last_heartbeat_at' => now(),
        ])->save();

        if (! empty($data['device_id'])) {
            UserLoginDevice::query()
                ->where('user_id', $user->id)
                ->where('device_id', $data['device_id'])
                ->update(['last_heartbeat_at' => now(), 'status' => 'active']);
        }

        return response()->json(['status' => '200', 'message' => 'Heartbeat updated.', 'data' => null]);
    }

    public function devices(Request $request): JsonResponse
    {
        $devices = UserLoginDevice::query()
            ->where('user_id', $request->user()->id)
            ->latest()
            ->get(['id', 'device_id', 'device_type', 'device_name', 'status', 'last_heartbeat_at', 'created_at']);

        return response()->json(['status' => '200', 'message' => 'OK', 'data' => $devices]);
    }

    public function deviceStatus(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['status' => 'required|in:active,block']);
        $device = UserLoginDevice::query()
            ->where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();
        $device->update(['status' => $data['status']]);

        return response()->json(['status' => '200', 'message' => 'Device status updated.', 'data' => null]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['status' => '200', 'message' => 'Logged out.', 'data' => null]);
    }
}
