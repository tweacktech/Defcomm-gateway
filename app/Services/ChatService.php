<?php

namespace App\Http\Services;

use App\Models\User;
use App\Mail\CallMail;
use App\Models\Meeting;
use App\Models\MeetingLog;
use App\Events\MessageSent;
use App\Models\ChatCallLog;
use App\Models\ChatLastLog;
use App\Models\ChatMessage;
use App\Models\CompanyGroup;
use App\Mail\MeetingInvitation;
use App\Events\GroupMessageSent;
use App\Models\CompanyGroupUser;
use App\Events\PrivateMessageSent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use App\Events\PrivateGroupMessageSent;

class ChatService
{
    public $authId;
    public $userTo;

    public function submitChat($current_chat_user_type, $current_chat_user, $userLastLog, $message, $is_file, $mss_type = 'text', $tag_user = null, $tag_mess = null)
    {
        $user = User::find(auth()->user()->id);
        $userLog = $userLastLog ?? uniqid();

        $altuser = "";
        if ($current_chat_user_type == 'user') {
            $altuser = User::find($current_chat_user);
        }

        // if ($userLastLog) {
        //     $userLog = $userLastLog;
        // } else {
        //     $userLog = $current_chat_user_type == 'user' ? uniqid() : $current_chat_user->id;
        // }

        $chatmss = ChatMessage::create([
            'user_id' => auth()->user()->id,
            'user_to' => $current_chat_user,
            'group_to' => $userLog,
            'reference_chat' => null,
            'user_group' => $current_chat_user_type,
            'is_file' => $is_file,
            'mss_type' => $mss_type,
            'file_type' => 'other',
            'is_read' => 'no',
            'is_important' => 'no',
            'is_forward' => 'no',
            'is_star' => 'no',
            'view_once' => 'no',
            'expire_time' => null,
            'message' => encrypt($message),
            'tag_user' => $tag_user,
            'tag_mess' => $tag_mess,
            'source_language' => $user->chatSettings->chat_language
        ]);

        ChatLastLog::updateOrCreate([
            'user_id' => auth()->user()->id,
            'user_to' => $current_chat_user,
            'group_to' => $userLog,
        ], [
            'chat_id' => $chatmss->id,
            'user_group' => $current_chat_user_type,
            'is_file' => $is_file,
        ]);

        if ($current_chat_user_type == 'user') {
            ChatLastLog::updateOrCreate([
                'user_id' => $current_chat_user,
                'user_to' => auth()->user()->id,
                'group_to' => $userLog,
            ], [
                'chat_id' => $chatmss->id,
                'user_group' => $current_chat_user_type,
                'is_file' => $is_file,
            ]);
        }

        if ($mss_type == 'call') {
            ChatCallLog::create([
                'send_user_id' => auth()->user()->id,
                'recieve_user_id' => $current_chat_user,
                'chatbtw' => $current_chat_user_type,
                'mss_id' => $chatmss->id,
            ]);
            if ($altuser) {
                Mail::to($altuser->email)->send(new CallMail(auth()->user()->name, $altuser->name));
            }
        }

        $chat_meta = [
            'chat_user_id' => encryptHelper($chatmss->userTo->id),
            'chat_id' => $userLog,
            'chat_user_type' => $chatmss->user_group
        ];

        $data = [
            'id' => encryptHelper($chatmss->id),
            'is_my_chat' => $chatmss->user_id == auth()->user()->id ? 'yes' : 'no',
            'user_id' => encryptHelper($chatmss->user_id),
            'user_to' => encryptHelper($chatmss->user_to),
            'user_to_name' => $chatmss->userTo->name,
            'group_to' => $chatmss->group_to,
            'chat_user_type' => $chatmss->user_group,
            'is_file' => $chatmss->is_file,
            'file_type' => $chatmss->file_type,
            'is_read' => $chatmss->is_read,
            'is_important' => $chatmss->is_important,
            'is_forward' => $chatmss->is_forward,
            'is_star' => $chatmss->is_star,
            'view_once' => $chatmss->view_once,
            'mss_type' => $chatmss->mss_type,
            'call_duration' => $chatmss->mss_type == "call" ? $chatmss->chatCall->call_duration : null,
            'call_state' => $chatmss->mss_type == "call" ? $chatmss->chatCall->call_state : null,
            'chatbtw' => $chatmss->mss_type == "call" ? $chatmss->chatCall->chatbtw : null,
            'expire_time' => $chatmss->expire_time,
            'message' => $message,
            // 'message' => $current_chat_user_type == 'group' ? $message : googleAiTransHelper(decrypt($chatmss->message), $user->chatSettings->chat_language, $altuser->chatSettings->chat_language),
            'tag_user' => convertBackToenHelper($chatmss->tag_user),
            'tag_mess_id' => encryptHelper($chatmss->tag_mess),
            'tag_mess_user' => $chatmss->tag_mess ? encryptHelper($chatmss->parent->user_id) : null,
            'tag_mess_is_my_chat' => $chatmss->tag_mess ? ($chatmss->parent->user_id == auth()->id() ? 'yes' : 'no') : null,
            'tag_mess' => $chatmss->tag_mess ? googleAiTransHelper(decrypt($chatmss->parent->message), $chatmss->parent->source_language, $user->chatSettings->chat_language) : null,
            'deleted_at' => $chatmss->deleted_at,
            'created_at' => $chatmss->created_at,
            'updated_at' => $chatmss->updated_at,
        ];

        $sendData = [
            'state' => $mss_type,
            'user_type' => $current_chat_user_type,
            'sender' => [
                'id' => encryptHelper($chatmss->user_id),
                'name' => $chatmss->user->name,
                'phone' => $chatmss->user->phone,
                'email' => $chatmss->user->email,
            ],
            'receiver' => [
                'id' => encryptHelper($chatmss->user_to),
                'name' => $current_chat_user_type == 'group' ? $chatmss->companyGroup->name : $chatmss->userTo->name,
                'phone' => $current_chat_user_type == 'group' ? '' : $chatmss->userTo->phone,
                'email' => $current_chat_user_type == 'group' ? '' : $chatmss->userTo->email,
            ],
            'message' => $message,
            'data' => $data,
            'mss_chat' => [
                "id" => encryptHelper($chatmss->id),
                "user_id" => encryptHelper($chatmss->user_id),
                "user_to" => encryptHelper($chatmss->user_to),
                "group_to" => $chatmss->group_to,
                "reference_chat" => $chatmss->reference_chat,
                "user_group" => $chatmss->user_group,
                "is_file" => $chatmss->is_file,
                "file_type" => $chatmss->file_type,
                "is_read" => $chatmss->is_read,
                'tag_user' => convertBackToenHelper($chatmss->tag_user),
                'tag_mess_id' => encryptHelper($chatmss->tag_mess),
                'tag_mess_user' => $chatmss->tag_mess ? encryptHelper($chatmss->parent->user_id) : null,
                'tag_mess_is_my_chat' => $chatmss->tag_mess ? ($chatmss->parent->user_id == auth()->id() ? 'yes' : 'no') : null,
                'tag_mess' => $chatmss->tag_mess ? googleAiTransHelper(decrypt($chatmss->parent->message), $chatmss->parent->source_language, $user->chatSettings->chat_language) : null,
            ]
        ];

        if ($current_chat_user_type == 'group') {
            broadcast(new PrivateGroupMessageSent(encryptHelper(auth()->user()->id), encryptHelper($current_chat_user), $sendData))->toOthers();
        } else {
            broadcast(new PrivateMessageSent(encryptHelper(auth()->user()->id), encryptHelper($current_chat_user), $sendData))->toOthers();
        }
        $lastMessage = [
            "state" => "last_message",
            "data" => $this->lastMessage($current_chat_user)
        ];
        if ($current_chat_user_type == 'group') {
            broadcast(new PrivateGroupMessageSent(encryptHelper(auth()->user()->id), encryptHelper(auth()->user()->id), $lastMessage))->toOthers();
        } else {
            broadcast(new PrivateMessageSent(encryptHelper($current_chat_user), encryptHelper($current_chat_user), $lastMessage))->toOthers();
        }



        return [
            'chat_meta' => $chat_meta,
            'data' => $data
        ];
    }


    public function meetingInvitationGroup($meetings_id, $group_id)
    {
        $meet = Meeting::find(decryptHelper($meetings_id));
        $group = CompanyGroupUser::where('group_id', decryptHelper($group_id))->get();
        foreach ($group as $value) {
            MeetingLog::updateOrCreate([
                'meetings_id' => $meet->id,
                'user_id' => $value->user_id,
            ], [
                'join_status' => 'invite',
                'user_type' => $value->user_id == auth()->user()->id ? 'creator' : 'participant'
            ]);

            $usr = User::find($value->user_id);
            if ($usr) {
                Mail::to($usr->email)->send(new MeetingInvitation($usr->name, $usr->email, $meet));
            }
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $meet
            ],
            201
        );
    }

    public function meetingInvitation($meetings_id, $users)
    {
        $meet = Meeting::find(decryptHelper($meetings_id));
        $json = str_replace("'", '"', $users);
        $array = json_decode($json, true);
        foreach ($array as $value) {
            MeetingLog::updateOrCreate([
                'meetings_id' => $meet->id,
                'user_id' => decryptHelper($value),
            ], [
                'join_status' => 'invite'
            ]);

            $usr = User::find(decryptHelper($value));
            if ($usr) {
                Mail::to($usr->email)->send(new MeetingInvitation($usr->name, $usr->email, $meet));
            }
        }

        return $meet;
    }


    public function lastMessage($authId = null)
    {
        if (is_null($authId)) { 
            $authId = auth()->id();
        }

        $this->authId = $authId;

        $record = ChatLastLog::select(DB::raw('
                CASE 
                    WHEN user_id = ' . $authId . ' THEN user_to 
                    ELSE user_id 
                END as other_user_id
            '))
            ->addSelect('chat_last_logs.*')
            ->where(function ($query) use ($authId) {
                $query->where('user_id', $authId)
                    ->orWhere('user_to', $authId);
            })
            ->orderBy('created_at', 'DESC')
            ->get()
            ->unique('other_user_id')
            ->values(); // reset array keys

        $data = $record->filter(function ($dt) {
            $authId = auth()->id();
            // Skip records where both user_id and user_to are the same as auth user
            return !($authId === $dt->user_id && $authId === $dt->user_to);
        })->map(function ($dt) {
            $authId = auth()->id();

            // Determine who the "other user" is
            if ($authId === $dt->user_to) {
                $userTo = $dt->user->id ?? null;
                $userToName = $dt->user->name ?? null;
            } else {
                $userTo = $dt->userTo->id ?? null;
                $userToName = $dt->userTo->name ?? null;
            }

            // Skip this record if no valid other user found
            if (is_null($userTo)) {
                return null;
            }

            $this->userTo = $userTo;

            // if ($chat_user_type == 'group') {
            //     $record = ChatMessage::where('user_to', $this->current_chat_user)->orderBy('created_at', 'DESC')->paginate(10);
            // } else {
                $record = ChatMessage::where(function ($query) {
                    $query->where('user_id', $this->userTo)
                        ->orWhere('group_to', $this->userTo)
                        ->orWhere('user_to', $this->userTo);
                })->where(function ($query) {
                    $query->where('user_id', $this->authId)
                        ->orWhere('group_to', $this->authId)
                        ->orWhere('user_to', $this->authId);
                })->orderBy('created_at', 'DESC')->paginate(10);
            // }

            $unreadCount = $record->where('is_read', 'no')->count();

            return [
                'id' => encryptHelper($dt->id),
                'chat_id' => encryptHelper($dt->group_to),
                'chat_user_to_id' => encryptHelper($userTo),
                'chat_user_to_name' => $userToName,
                'is_file' => $dt->is_file,
                'unread' => $unreadCount,
                'last_message' => $dt->chat->message ? decrypt($dt->chat->message) : null,
                'chat_user_type' => $dt->user_group,
            ];
        })->filter()->values(); // Reset array indexes

        return $data;
    }
}
