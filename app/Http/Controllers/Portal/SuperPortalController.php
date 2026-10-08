<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Models\AppStore;
use App\Models\BountyCategory;
use App\Models\BountyProgram;
use App\Models\BountyReport;
use App\Models\BountyUser;
use App\Models\ContactBooking;
use App\Models\ContactSubmission;
use App\Models\Language;
use App\Models\Plan;
use App\Models\PortalNotification;
use App\Models\StatementAgreement;
use App\Models\SystemMail;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SuperPortalController extends Controller
{
    public function accounts(Request $request, string $type = 'admin'): Response
    {
        if ($type === 'super' && ! $request->user()?->isGeneralAdmin()) {
            abort(403, 'Only general admins can manage super accounts.');
        }

        $role = $type === 'super' ? 'super' : 'admin';

        $users = User::query()
            ->when($role === 'super', fn ($q) => $q->where('role', 'super'))
            ->when($role === 'admin', fn ($q) => $q->where('role', 'admin'))
            ->when($request->filled('search'), function ($q) use ($request) {
                $q->where(function ($q) use ($request) {
                    $q->where('name', 'like', '%'.$request->search.'%')
                        ->orWhere('email', 'like', '%'.$request->search.'%');
                });
            })
            ->with('organization:id,name')
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('portal/super/accounts', [
            'type' => $type,
            'users' => $users,
            'filters' => ['search' => $request->input('search', '')],
        ]);
    }

    public function storeAccount(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => ['required', Rule::in(['super', 'admin', 'user'])],
            'platform_role' => ['nullable', Rule::in(['general_admin', 'billing', 'support', 'developer'])],
            'organization_id' => 'nullable|integer|exists:organizations,id',
            'status' => ['nullable', Rule::in(['pending', 'active', 'block'])],
        ]);

        if ($data['role'] === 'super' && ! $request->user()->isGeneralAdmin()) {
            return back()->withErrors(['role' => 'Only general admins can create super accounts.']);
        }

        if ($data['role'] === 'super') {
            $data['platform_role'] = $data['platform_role'] ?? 'general_admin';
            $data['organization_id'] = null;
        } else {
            $data['platform_role'] = null;
        }

        User::create([
            ...$data,
            'password' => Hash::make($data['password']),
            'status' => $data['status'] ?? 'active',
        ]);

        return back()->with('success', 'Account created.');
    }

    public function updateAccount(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['required', Rule::in(['super', 'admin', 'user'])],
            'platform_role' => ['nullable', Rule::in(['general_admin', 'billing', 'support', 'developer'])],
            'status' => ['required', Rule::in(['pending', 'active', 'block'])],
            'organization_id' => 'nullable|integer|exists:organizations,id',
            'password' => 'nullable|string|min:8',
        ]);

        if ($data['role'] === 'super' && ! $request->user()->isGeneralAdmin()) {
            return back()->withErrors(['role' => 'Only general admins can manage super accounts.']);
        }

        if ($data['role'] === 'super') {
            $data['platform_role'] = $data['platform_role'] ?? 'general_admin';
            $data['organization_id'] = null;
        } else {
            $data['platform_role'] = null;
        }

        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $user->update($data);

        return back()->with('success', 'Account updated.');
    }

    public function deleteAccount(User $user): RedirectResponse
    {
        abort_if((int) $user->id === (int) auth()->id(), 422, 'Cannot delete yourself.');
        $user->tokens()->delete();
        $user->delete();

        return back()->with('success', 'Account deleted.');
    }

    public function notifications(): Response
    {
        return Inertia::render('portal/super/notifications', [
            'items' => PortalNotification::query()->latest()->paginate(20),
        ]);
    }

    public function storeNotification(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'nullable|string',
            'audience' => ['required', Rule::in(['all', 'super', 'company', 'user'])],
            'is_active' => 'boolean',
        ]);

        PortalNotification::create([
            ...$data,
            'created_by' => $request->user()->id,
            'is_active' => $request->boolean('is_active', true),
        ]);

        return back()->with('success', 'Notification created.');
    }

    public function updateNotification(Request $request, PortalNotification $notification): RedirectResponse
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'nullable|string',
            'audience' => ['required', Rule::in(['all', 'super', 'company', 'user'])],
            'is_active' => 'boolean',
        ]);
        $notification->update([...$data, 'is_active' => $request->boolean('is_active', true)]);

        return back()->with('success', 'Notification updated.');
    }

    public function deleteNotification(PortalNotification $notification): RedirectResponse
    {
        $notification->delete();

        return back()->with('success', 'Notification deleted.');
    }

    public function languages(): Response
    {
        return Inertia::render('portal/super/languages', [
            'items' => Language::query()->orderBy('name')->paginate(50),
        ]);
    }

    public function storeLanguage(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'code' => 'required|string|max:20|unique:languages,code',
            'is_active' => 'boolean',
        ]);
        Language::create([...$data, 'is_active' => $request->boolean('is_active', true)]);

        return back()->with('success', 'Language added.');
    }

    public function updateLanguage(Request $request, Language $language): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'code' => ['required', 'string', 'max:20', Rule::unique('languages', 'code')->ignore($language->id)],
            'is_active' => 'boolean',
        ]);
        $language->update([...$data, 'is_active' => $request->boolean('is_active', true)]);

        return back()->with('success', 'Language updated.');
    }

    public function agreements(): Response
    {
        return Inertia::render('portal/super/agreements', [
            'items' => StatementAgreement::query()->latest()->paginate(20),
        ]);
    }

    public function storeAgreement(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'content' => 'nullable|string',
            'is_active' => 'boolean',
        ]);
        StatementAgreement::create([...$data, 'is_active' => $request->boolean('is_active', true)]);

        return back()->with('success', 'Agreement created.');
    }

    public function updateAgreement(Request $request, StatementAgreement $agreement): RedirectResponse
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'content' => 'nullable|string',
            'is_active' => 'boolean',
        ]);
        $agreement->update([...$data, 'is_active' => $request->boolean('is_active', true)]);

        return back()->with('success', 'Agreement updated.');
    }

    public function systemMails(): Response
    {
        if (SystemMail::query()->count() === 0) {
            foreach ([
                ['key' => 'welcome', 'subject' => 'Welcome to Defcomm', 'body' => 'Welcome aboard.'],
                ['key' => 'password_reset', 'subject' => 'Password Reset', 'body' => 'Use the link to reset your password.'],
                ['key' => 'invite', 'subject' => 'You are invited', 'body' => 'You have been invited to join.'],
            ] as $row) {
                SystemMail::create([...$row, 'is_active' => true]);
            }
        }

        return Inertia::render('portal/super/system-mails', [
            'items' => SystemMail::query()->orderBy('key')->paginate(50),
        ]);
    }

    public function updateSystemMail(Request $request, SystemMail $systemMail): RedirectResponse
    {
        $data = $request->validate([
            'subject' => 'required|string|max:255',
            'body' => 'nullable|string',
            'is_active' => 'boolean',
        ]);
        $systemMail->update([...$data, 'is_active' => $request->boolean('is_active', true)]);

        return back()->with('success', 'System mail updated.');
    }

    public function plans(): Response
    {
        return Inertia::render('portal/super/plans', [
            'items' => Plan::query()->latest()->paginate(20),
        ]);
    }

    public function storePlan(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'is_active' => 'boolean',
        ]);

        $payload = array_filter($data, fn ($k) => in_array($k, (new Plan)->getFillable(), true), ARRAY_FILTER_USE_KEY);
        if ($request->has('is_active') && in_array('is_active', (new Plan)->getFillable(), true)) {
            $payload['is_active'] = $request->boolean('is_active', true);
        }
        Plan::create($payload ?: ['name' => $data['name']]);

        return back()->with('success', 'Plan created.');
    }

    public function storeApps(): Response
    {
        return Inertia::render('portal/super/store-apps', [
            'items' => AppStore::query()->with('user:id,name,email')->latest()->paginate(20),
        ]);
    }

    public function storeUsers(): Response
    {
        return Inertia::render('portal/super/store-users', [
            'items' => User::query()->where('role', 'user')->latest()->paginate(20),
        ]);
    }

    public function updateStoreApp(Request $request, AppStore $appStore): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['pending', 'approved', 'rejected'])],
        ]);
        $appStore->update($data);

        return back()->with('success', 'App status updated.');
    }

    public function bountyUsers(): Response
    {
        return Inertia::render('portal/super/bounty-users', [
            'items' => BountyUser::query()->latest()->paginate(20),
        ]);
    }

    public function bountyUserStatus(Request $request, BountyUser $bountyUser): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['active', 'pending', 'block'])]]);
        $bountyUser->update($data);

        return back()->with('success', 'Bounty user status updated.');
    }

    public function bountyReports(): Response
    {
        return Inertia::render('portal/super/bounty-reports', [
            'items' => BountyReport::query()->with('user')->latest()->paginate(20),
        ]);
    }

    public function bountyReportStatus(Request $request, BountyReport $bountyReport): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['open', 'approved', 'fixed', 'rejected'])]]);
        $bountyReport->update($data);

        return back()->with('success', 'Report status updated.');
    }

    public function bountyPrograms(): Response
    {
        return Inertia::render('portal/super/bounty-programs', [
            'items' => BountyProgram::query()->latest()->paginate(20),
        ]);
    }

    public function storeBountyProgram(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'detail' => 'nullable|string',
            'is_active' => 'boolean',
        ]);
        BountyProgram::create([...$data, 'is_active' => $request->boolean('is_active', true)]);

        return back()->with('success', 'Program created.');
    }

    public function updateBountyProgram(Request $request, BountyProgram $bountyProgram): RedirectResponse
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'detail' => 'nullable|string',
            'is_active' => 'boolean',
        ]);
        $bountyProgram->update([...$data, 'is_active' => $request->boolean('is_active', true)]);

        return back()->with('success', 'Program updated.');
    }

    public function bountyCategories(): Response
    {
        return Inertia::render('portal/super/bounty-categories', [
            'items' => BountyCategory::query()->with('subs')->latest()->paginate(50),
        ]);
    }

    public function storeBountyCategory(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'label' => 'required|string|max:255',
            'description' => 'nullable|string',
            'sub_labels' => 'nullable|array',
            'sub_labels.*' => 'string|max:255',
        ]);
        $cat = BountyCategory::create([
            'label' => $data['label'],
            'description' => $data['description'] ?? null,
        ]);
        foreach ($data['sub_labels'] ?? [] as $label) {
            if (trim($label) !== '') {
                $cat->subs()->create(['label' => $label]);
            }
        }

        return back()->with('success', 'Category created.');
    }

    public function contacts(): Response
    {
        return Inertia::render('portal/super/web-contacts', [
            'items' => ContactSubmission::query()->latest()->paginate(20),
        ]);
    }

    public function bookings(): Response
    {
        return Inertia::render('portal/super/web-bookings', [
            'items' => ContactBooking::query()->latest()->paginate(20),
        ]);
    }

    public function updateContactStatus(Request $request, ContactSubmission $contactSubmission): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['new', 'read', 'closed'])]]);
        $contactSubmission->update($data);

        return back()->with('success', 'Contact updated.');
    }

    public function updateBookingStatus(Request $request, ContactBooking $contactBooking): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['new', 'scheduled', 'closed'])]]);
        $contactBooking->update($data);

        return back()->with('success', 'Booking updated.');
    }
}
