<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Models\ChatLastLog;
use App\Models\ChatMessage;
use App\Models\ContactList;
use App\Models\File;
use App\Models\OrganizationGroupUser;
use App\Models\PortalNotification;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UserPortalController extends Controller
{
    public function contacts(Request $request): Response
    {
        $user = $request->user();

        $orgUsers = $user->organization_id
            ? User::query()
                ->where('organization_id', $user->organization_id)
                ->where('id', '!=', $user->id)
                ->where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'phone'])
            : collect();

        $contacts = ContactList::query()
            ->with('contact:id,name,email,phone,organization_id')
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->get()
            ->filter(fn (ContactList $c) => ! $user->organization_id
                || (int) ($c->contact?->organization_id) === (int) $user->organization_id
                || $user->isSuperAdmin());

        return Inertia::render('portal/user/contacts', [
            'contacts' => $contacts->values(),
            'directory' => $orgUsers,
        ]);
    }

    public function addContact(Request $request, int $userId): RedirectResponse
    {
        abort_if($userId === (int) $request->user()->id, 422);
        $target = User::query()->findOrFail($userId);
        abort_unless((int) $target->organization_id === (int) $request->user()->organization_id
            || $request->user()->isSuperAdmin(), 403);

        ContactList::firstOrCreate(
            ['user_id' => $request->user()->id, 'user_link' => $userId],
            ['status' => 'active'],
        );

        return back()->with('success', 'Contact added.');
    }

    public function removeContact(Request $request, int $id): RedirectResponse
    {
        ContactList::query()
            ->where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail()
            ->delete();

        return back()->with('success', 'Contact removed.');
    }

    public function files(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('portal/user/files', [
            'items' => File::query()
                ->where('user_id', $user->id)
                ->latest()
                ->paginate(20),
        ]);
    }

    public function groups(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('portal/user/groups', [
            'joined' => OrganizationGroupUser::query()
                ->with('group')
                ->where('user_id', $user->id)
                ->where('status', 'joined')
                ->get(),
            'pending' => OrganizationGroupUser::query()
                ->with('group')
                ->where('user_id', $user->id)
                ->where('status', 'pending')
                ->get(),
        ]);
    }

    public function acceptGroup(Request $request, int $id): RedirectResponse
    {
        OrganizationGroupUser::query()
            ->where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail()
            ->update(['status' => 'joined', 'join_date' => now()]);

        return back()->with('success', 'Joined group.');
    }

    public function declineGroup(Request $request, int $id): RedirectResponse
    {
        OrganizationGroupUser::query()
            ->where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail()
            ->delete();

        return back()->with('success', 'Invitation declined.');
    }

    public function profile(Request $request): Response
    {
        return Inertia::render('portal/user/profile', [
            'user' => $request->user()->only(['id', 'name', 'email', 'phone', 'role', 'status']),
        ]);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => 'nullable|string|max:40',
            'password' => 'nullable|string|min:8|confirmed',
        ]);

        $payload = [
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
        ];
        if (! empty($data['password'])) {
            $payload['password'] = Hash::make($data['password']);
        }
        $user->update($payload);

        return back()->with('success', 'Profile updated.');
    }

    public function chat(Request $request): Response
    {
        $user = $request->user();

        $conversations = ChatLastLog::query()
            ->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)->orWhere('user_to', $user->id);
            })
            ->where('user_group', 'user')
            ->latest('updated_at')
            ->limit(50)
            ->get();

        $peerId = $request->integer('peer');
        $messages = [];
        if ($peerId) {
            $messages = ChatMessage::query()
                ->where('user_group', 'user')
                ->where(function ($q) use ($user, $peerId) {
                    $q->where(function ($q) use ($user, $peerId) {
                        $q->where('user_id', $user->id)->where('user_to', $peerId);
                    })->orWhere(function ($q) use ($user, $peerId) {
                        $q->where('user_id', $peerId)->where('user_to', $user->id);
                    });
                })
                ->latest()
                ->limit(100)
                ->get()
                ->reverse()
                ->values();
        }

        $contacts = ContactList::query()
            ->with('contact:id,name,email')
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->get();

        return Inertia::render('portal/user/chat', [
            'conversations' => $conversations,
            'messages' => $messages,
            'peer_id' => $peerId ?: null,
            'contacts' => $contacts,
            'notifications' => PortalNotification::query()
                ->where('is_active', true)
                ->whereIn('audience', ['all', 'user'])
                ->where(function ($q) use ($user) {
                    if ($user->organization_id) {
                        $q->where('organization_id', $user->organization_id);
                    } else {
                        $q->whereNull('organization_id');
                    }
                })
                ->latest()
                ->limit(10)
                ->get(['id', 'title', 'body', 'created_at']),
        ]);
    }

    public function sendChat(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'peer_id' => 'required|integer|exists:users,id',
            'message' => 'required|string|max:5000',
        ]);

        $user = $request->user();
        $message = ChatMessage::create([
            'user_id' => $user->id,
            'user_to' => $data['peer_id'],
            'group_to' => '0',
            'message' => $data['message'],
            'mss_type' => 'text',
            'user_group' => 'user',
            'is_read' => 'no',
        ]);

        ChatLastLog::updateOrCreate(
            [
                'user_id' => $user->id,
                'user_to' => $data['peer_id'],
                'group_to' => '0',
                'user_group' => 'user',
            ],
            [
                'chat_id' => $message->id,
                'last_message' => $data['message'],
                'mss_type' => 'text',
                'updated_at' => now(),
            ],
        );

        return redirect()->to('/app/chat?peer='.$data['peer_id'])->with('success', 'Message sent.');
    }

    public function walkie(Request $request): Response
    {
        return Inertia::render('portal/user/walkie', [
            'channels' => \App\Models\WalkieChannel::query()
                ->where('user_id', $request->user()->id)
                ->orWhereHas('subscribers', fn ($q) => $q->where('user_id', $request->user()->id)->where('status', 'active'))
                ->latest()
                ->get(['id', 'name', 'frequency', 'status']),
        ]);
    }
}
