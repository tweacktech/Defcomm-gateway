<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BountyCategory;
use App\Models\BountyProgram;
use App\Models\BountyReport;
use App\Models\BountyUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class BountyApiController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'firstName' => 'required|string|max:120',
            'lastName' => 'required|string|max:120',
            'username' => 'required|string|max:120|unique:bounty_users,username',
            'email' => 'required|email|unique:bounty_users,email',
            'password' => ['required', Password::defaults()],
            'phone' => 'nullable|string|max:40',
            'group_company' => 'nullable|string|max:120',
            'country' => 'nullable|string|max:120',
            'user_type' => 'nullable|in:user,group,company',
        ]);

        $otp = (string) random_int(100000, 999999);
        $user = BountyUser::create([
            'first_name' => $data['firstName'],
            'last_name' => $data['lastName'],
            'username' => $data['username'],
            'email' => $data['email'],
            'password' => $data['password'],
            'phone' => $data['phone'] ?? null,
            'group_company' => $data['group_company'] ?? null,
            'country' => $data['country'] ?? null,
            'user_type' => $data['user_type'] ?? 'user',
            'otp' => $otp,
            'status' => 'pending',
            'email_verified' => false,
        ]);

        return response()->json([
            'status' => '200',
            'message' => 'Registration successful. Verify OTP.',
            'data' => [
                'id' => $user->id,
                'username' => $user->username,
                'email' => $user->email,
                'otp' => app()->environment('production') ? null : $otp,
            ],
        ], 201);
    }

    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'userlogin' => 'required|string',
            'otp' => 'required|string',
        ]);

        $user = $this->findBountyUser($data['userlogin']);
        if (! $user || $user->otp !== $data['otp']) {
            return response()->json(['status' => '400', 'message' => 'Invalid OTP.', 'data' => null], 400);
        }

        $user->update(['email_verified' => true, 'status' => 'active', 'otp' => null]);

        return response()->json(['status' => '200', 'message' => 'Account verified.', 'data' => null]);
    }

    public function requestOtp(Request $request): JsonResponse
    {
        $data = $request->validate(['userlogin' => 'required|string']);
        $user = $this->findBountyUser($data['userlogin']);
        abort_unless($user, 404, 'User not found.');

        $otp = (string) random_int(100000, 999999);
        $user->update(['otp' => $otp]);

        return response()->json([
            'status' => '200',
            'message' => 'OTP sent.',
            'otp' => app()->environment('production') ? null : $otp,
        ]);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'userlogin' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = $this->findBountyUser($data['userlogin']);
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['status' => '401', 'message' => 'Invalid credentials.'], 401);
        }

        $otp = (string) random_int(100000, 999999);
        $user->update(['otp' => $otp]);

        return response()->json([
            'status' => '200',
            'message' => 'OTP required to complete login.',
            'otp' => app()->environment('production') ? null : $otp,
        ]);
    }

    public function loginVerify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'userlogin' => 'required|string',
            'otp' => 'required|string',
        ]);

        $user = $this->findBountyUser($data['userlogin']);
        if (! $user || $user->otp !== $data['otp']) {
            return response()->json(['status' => '400', 'message' => 'Invalid OTP.'], 400);
        }

        $user->update(['otp' => null, 'status' => 'active', 'email_verified' => true]);
        $token = $user->createToken('bounty_token')->plainTextToken;

        return response()->json([
            'status' => '200',
            'message' => 'Login successful',
            'token' => $token,
            'user' => $this->userDto($user),
        ]);
    }

    public function leaderboard(): JsonResponse
    {
        $rows = BountyUser::query()
            ->where('status', 'active')
            ->orderByDesc('balance')
            ->limit(50)
            ->get()
            ->map(fn (BountyUser $u) => [
                'id' => $u->id,
                'username' => $u->username,
                'balance' => $u->balance,
            ]);

        return response()->json(['status' => '200', 'message' => 'OK', 'data' => $rows]);
    }

    public function profile(Request $request): JsonResponse
    {
        $user = $this->bountyUser($request);

        return response()->json(['status' => '200', 'message' => 'OK', 'data' => $this->userDto($user)]);
    }

    public function programs(): JsonResponse
    {
        $rows = BountyProgram::query()
            ->where('is_active', true)
            ->get()
            ->map(fn (BountyProgram $p) => [
                'id' => $p->id,
                'title' => $p->title,
                'detail' => $p->detail,
            ]);

        return response()->json(['status' => '200', 'message' => 'OK', 'data' => $rows]);
    }

    public function categories(): JsonResponse
    {
        $rows = BountyCategory::query()
            ->with('subs')
            ->get()
            ->map(fn (BountyCategory $c) => [
                'id' => $c->id,
                'label' => $c->label,
                'description' => $c->description,
                'sub' => $c->subs->map(fn ($s) => ['id' => $s->id, 'label' => $s->label]),
            ]);

        return response()->json(['status' => '200', 'message' => 'OK', 'data' => $rows]);
    }

    public function report(Request $request): JsonResponse
    {
        $user = $this->bountyUser($request);
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'detail' => 'nullable|string',
            'category' => 'nullable|integer|exists:bounty_categories,id',
            'category_sub' => 'nullable|integer|exists:bounty_category_subs,id',
            'severity' => 'nullable|string|max:255',
            'program_id' => 'nullable|integer|exists:bounty_programs,id',
            'attachment' => 'nullable|array',
        ]);

        $report = BountyReport::create([
            'ref' => 'BR-'.Str::upper(Str::random(10)),
            'bounty_user_id' => $user->id,
            'program_id' => $data['program_id'] ?? null,
            'category_id' => $data['category'] ?? null,
            'category_sub_id' => $data['category_sub'] ?? null,
            'title' => $data['title'],
            'detail' => $data['detail'] ?? null,
            'severity' => $data['severity'] ?? null,
            'attachments' => $data['attachment'] ?? [],
            'status' => 'open',
        ]);

        return response()->json([
            'status' => '200',
            'message' => 'Report submitted.',
            'data' => ['id' => $report->id, 'ref' => $report->ref],
        ], 201);
    }

    public function reportLog(Request $request): JsonResponse
    {
        $user = $this->bountyUser($request);
        $rows = BountyReport::query()
            ->where('bounty_user_id', $user->id)
            ->latest()
            ->get(['id', 'ref', 'title', 'status', 'created_at']);

        return response()->json(['status' => '200', 'message' => 'OK', 'data' => $rows]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    protected function findBountyUser(string $login): ?BountyUser
    {
        return BountyUser::query()
            ->where('email', $login)
            ->orWhere('username', $login)
            ->first();
    }

    protected function bountyUser(Request $request): BountyUser
    {
        $user = $request->user();
        abort_unless($user instanceof BountyUser, 401, 'Bounty token required.');

        return $user;
    }

    protected function userDto(BountyUser $user): array
    {
        return [
            'id' => $user->id,
            'firstName' => $user->first_name,
            'lastName' => $user->last_name,
            'username' => $user->username,
            'email' => $user->email,
            'phone' => $user->phone,
            'country' => $user->country,
            'balance' => $user->balance,
            'status' => $user->status,
            'user_type' => $user->user_type,
        ];
    }
}
