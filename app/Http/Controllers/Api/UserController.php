<?php

namespace App\Http\Controllers\API;

use App\Events\PrivateGroupMessageSent;
use App\Events\PrivateMessageSent;
use App\Http\Controllers\Controller;
use App\Http\Services\ChatService;
use App\Http\Services\FileEncryptorService;
use App\Http\Services\FileUploadService;
use App\Mail\MeetingInvitation;
use App\Mail\MissCallMail;
use App\Models\AppStore;
use App\Models\Certificate;
use App\Models\CertificateRegistrations;
use App\Models\ChatCallLog;
use App\Models\ChatLastLog;
use App\Models\ChatMessage;
use App\Models\ChatSettings;
use App\Models\CompanyGroup;
use App\Models\CompanyGroupUser;
use App\Models\ContactList;
use App\Models\EventForm;
use App\Models\EventRegistration;
use App\Models\EventRegistrationsAttendances;
use App\Models\FileFolder;
use App\Models\Files;
use App\Models\FileShareLog;
use App\Models\FilesShares;
use App\Models\FolderFile;
use App\Models\Folders;
use App\Models\LanguageCode;
use App\Models\Meeting;
use App\Models\MeetingLog;
use App\Models\Notification;
use App\Models\Program;
use App\Models\SouvenirRegistrations;
use App\Models\User;
use Carbon\Carbon;
use Firebase\JWT\JWT;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Stevebauman\Location\Facades\Location;

class UserController extends Controller
{
    public $current_chat_user, $FileUploadService, $ChatService;

    public function __construct()
    {
        $this->FileUploadService = new FileUploadService();
        $this->ChatService = new ChatService();
    }

    public function file()
    {
        $file = Files::where('uploaded_by', auth()->user()->id)->orderBy('id', 'DESC')->get();

        $data = [];
        foreach ($file as $key => $dt) {
            $data[$key] = [
                'id' => encryptHelper($dt->id),
                'name' => $dt->name,
                'file' => $dt->file,
                'file_size' => $dt->file_size,
                'file_ext' => $dt->file_ext,
                'uploaded_by' => $dt->user->name,
                'description' => $dt->description,
                'created_at' => $dt->created_at,
                'updated_at' => $dt->updated_at,
                'status' => $dt->status,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record List',
                'data' => $data
            ],
            201
        );
    }

    public function fileOther()
    {
        $file = FilesShares::where('user_id', auth()->user()->id)->where('status', 'access')->orderBy('id', 'DESC')->get();

        $data = [];
        foreach ($file as $key => $dt) {
            $data[$key] = [
                'id' => encryptHelper($dt->id),
                'file_id' => encryptHelper($dt->file->id),
                'file_name' => $dt->file->name,
                'file_size' => $dt->file->file_size,
                'file_ext' => $dt->file->file_ext,
                'uploaded_by' => $dt->user->name,
                'shared_by' => $dt->userFrom->name,
                'description' => $dt->file->description,
                'shared_date' => $dt->created_at,
                'file_upload_date' => $dt->file->updated_at,
                'status' => $dt->status,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record List',
                'data' => $data
            ],
            201
        );
    }

    public function fileOtherPending()
    {
        $file = FilesShares::where('user_id', auth()->user()->id)->where('status', 'pending')->orderBy('id', 'DESC')->get();

        $data = [];
        foreach ($file as $key => $dt) {
            $data[$key] = [
                'id' => encryptHelper($dt->id),
                'file_id' => encryptHelper($dt->file->id),
                'file_name' => $dt->file->name,
                'file_size' => $dt->file->file_size,
                'file_ext' => $dt->file->file_ext,
                'uploaded_by' => $dt->user->name,
                'shared_by' => $dt->userFrom->name,
                'description' => $dt->file->description,
                'shared_date' => $dt->created_at,
                'file_upload_date' => $dt->file->updated_at,
                'status' => $dt->status,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record List',
                'data' => $data
            ],
            201
        );
    }

    public function fileRequest()
    {
        $file = FilesShares::where('user_id', auth()->user()->id)->where('status', 'block')->orderBy('id', 'DESC')->get();

        $data = [];
        foreach ($file as $key => $dt) {
            $data[$key] = [
                'id' => encryptHelper($dt->id),
                'file_id' => encryptHelper($dt->file->id),
                'file_name' => $dt->file->name,
                'file_size' => $dt->file->file_size,
                'file_ext' => $dt->file->file_ext,
                'uploaded_by' => $dt->user->name,
                'shared_by' => $dt->userFrom->name,
                'description' => $dt->file->description,
                'shared_date' => $dt->created_at,
                'file_upload_date' => $dt->file->updated_at,
                'status' => $dt->status,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record List',
                'data' => $data
            ],
            201
        );
    }

    public function fileUpload(Request $request)
    {
        $user = User::find(auth()->user()->id);

        if ($user->plan_id === null) {
            return response()->json(
                [
                    'status' => '400',
                    'message' => 'You do not have an active plan. Please subscribe',
                    'data' => null
                ],
                401
            );
        }

        $userfile = Files::where('uploaded_by', auth()->user()->id)->sum('fileSize_num');
        if (($user->plan->file_size * 1073741824) < $userfile) {
            return response()->json(
                [
                    'status' => '400',
                    'message' => 'You have reach your plan limit. Please subscribe',
                    'data' => null
                ],
                401
            );
        }

        $file = $request->file('file');
        $file_ext = $file->getClientOriginalExtension();

        // return dd($file_ext != "pdf" || $file_ext != "PDF");

        if ($file_ext != "pdf") {
            return response()->json(
                [
                    'status' => '400',
                    'message' => 'Ensure the file is PDF',
                    'data' => null
                ],
                401
            );
        }

        $file_size = $fileSize = $file->getSize();
        $file_time = time();
        $file_name = $file_time . $file->hashName() . '.enc';

        $originalPath = $file->storeAs('secure/uploads', $file_time . $file->getClientOriginalName());
        $encryptHelperedPath = $file->storeAs('secure/encryptHelpered',  $file_name);

        $encryptor = new FileEncryptorService();
        $encryptor->processAndencrypt(
            public_path('storage/' . $originalPath),
            public_path('storage/' . $encryptHelperedPath),
            [
                'watermark_text' => 'Confidential',
                // 'watermark_image' => public_path('logo.png')
            ]
        );

        if ($file_size >= 1073741824) {
            $file_size = number_format($file_size / 1073741824, 2) . ' GB';
        } elseif ($file_size >= 1048576) {
            $file_size = number_format($file_size / 1048576, 2) . ' MB';
        } elseif ($file_size >= 1024) {
            $file_size = number_format($file_size / 1024, 2) . ' KB';
        } else {
            $file_size = $file_size . ' bytes';
        }

        $file = Files::create([
            'name' => $request->name,
            'description' => $request->description,
            'file' => encrypt("storage/secure/encryptHelpered/" . $file_name),
            'file_size' => $file_size,
            'file_ext' => $file_ext,
            'fileSize_num' => $fileSize,
            'company_id' => auth()->user()->company_id,
            'uploaded_by' => auth()->user()->id,
            'user_type' => 'user'
        ]);

        if ($request->folder_id) {
            FileFolder::create([
                'user_id' => auth()->user()->id,
                'file_id' => $file->id,
                'folder_id' => decryptHelper($request->folder_id)
            ]);
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'File Securely uploaded',
                'data' => $file
            ],
            201
        );
    }

    public function fileShare(Request $request)
    {
        $id = decryptHelper($request->id);
        $user = json_decode($request->users, true);
        if (!empty($user)) {
            foreach ($user as $dt) {
                FilesShares::firstOrCreate([
                    'user_id' => $dt,
                    'file_id' => $id,
                ], [
                    'company_id' => auth()->user()->company_id,
                    'user_from' => auth()->user()->id,
                    'is_who' => 'user',
                    'status' => 'block'
                ]);
                // $usr = User::find($dt);
                // Mail::to($usr->email)->send(new FileShare($usr->name, $usr->email, auth()->user()->name));
            }

            return response()->json(
                [
                    'status' => '200',
                    'message' => 'File successfully shared',
                    'data' => null
                ],
                201
            );
        }

        return response()->json(
            [
                'status' => '400',
                'message' => 'Please ensure to select a user',
                'data' => null
            ],
            401
        );
    }

    public function fileDownload($id)
    {
        $file = Files::find(decryptHelper($id));
        FileShareLog::create(['user_id' => auth()->user()->id, 'file_id' => $file->id, 'company_id' => auth()->user()->company_id]);

        $pathToencryptHelpered = public_path(decrypt($file->file));
        $fileExtension = $file->file_ext;
        $pathTodecryptHelperedWatermarked = public_path('storage/secure/decryptHelpered_' . uniqid() . '.' . $fileExtension);
        File::put($pathTodecryptHelperedWatermarked, "");

        $encryptor = new FileEncryptorService();
        $encryptor->decryptAndWatermark(
            $pathToencryptHelpered,
            $pathTodecryptHelperedWatermarked,
            $fileExtension,
            [
                'watermark_text' => 'Downloaded by: ' . auth()->user()->name,
                // 'watermark_image' => public_path('logo.png')
            ]
        );

        return response()->download($pathTodecryptHelperedWatermarked)->deleteFileAfterSend(true);
    }

    public function fileView($id)
    {
        $file = Files::find(decryptHelper($id));
        FileShareLog::create(['user_id' => auth()->user()->id, 'file_id' => $file->id, 'company_id' => auth()->user()->company_id]);
        return view('admin.fileView', [
            'file' => $file,
            'user' => auth()->user()
        ]);
    }

    public function fileViewUrl($id)
    {
        $file = Files::find(decryptHelper($id));
        FileShareLog::create(['user_id' => auth()->user()->id, 'file_id' => $file->id, 'company_id' => auth()->user()->company_id]);
        return response()->json(
            [
                'status' => '200',
                'url' => route('user.com.file.view', ['id' => encryptHelper($file->id), 'user' => encryptHelper(auth()->user()->id)]),
                'data' => null
            ],
            201
        );
    }

    public function fileAccept($id)
    {
        $idUser = decryptHelper($id);
        FilesShares::find($idUser)->update(['status' => 'access']);
        return response()->json(
            [
                'status' => '200',
                'message' => 'File accepted successfully',
                'data' => null
            ],
            201
        );
    }

    public function fileDecline($id)
    {
        $idUser = decryptHelper($id);
        FilesShares::find($idUser)->delete();
        return response()->json(
            [
                'status' => '200',
                'message' => 'File decline successfully',
                'data' => null
            ],
            201
        );
    }

    public function group()
    {
        $group = CompanyGroupUser::where('user_id', auth()->user()->id)->where('status', 'joined')->orderBy('id', 'DESC')->get();

        $data = [];
        foreach ($group as $key => $dt) {
            $data[$key] = [
                'id' => encryptHelper($dt->id),
                'company_name' => $dt->companyUser->name,
                'group_id' => encryptHelper($dt->companyGroup->id),
                'group_name' => $dt->companyGroup->name,
                'join_date' => $dt->join_date,
                'invitation_date' => $dt->created_at,
                'hide_my_detail' => $dt->hide,
                'status' => $dt->status,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record List',
                'data' => $data
            ],
            201
        );
    }

    public function groupPendig()
    {
        $group = CompanyGroupUser::where('user_id', auth()->user()->id)->where('status', 'pending')->orderBy('id', 'DESC')->get();

        $data = [];
        foreach ($group as $key => $dt) {
            $data[$key] = [
                'id' => encryptHelper($dt->id),
                'company_name' => $dt->companyUser->name,
                'group_name' => $dt->companyGroup->name,
                'join_date' => $dt->join_date,
                'invitation_date' => $dt->created_at,
                'hide_my_detail' => $dt->hide,
                'status' => $dt->status,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record List',
                'data' => $data
            ],
            201
        );
    }

    public function groupAccept($id)
    {
        $idUser = decryptHelper($id);
        CompanyGroupUser::find($idUser)->update(['status' => 'joined']);
        return response()->json(
            [
                'status' => '200',
                'message' => 'Group accepted successfully',
                'data' => null
            ],
            201
        );
    }

    public function groupDecline($id)
    {
        $idUser = decryptHelper($id);
        CompanyGroupUser::find($idUser)->delete();
        return response()->json(
            [
                'status' => '200',
                'message' => 'Group decline successfully',
                'data' => null
            ],
            201
        );
    }

    public function profile()
    {
        $user = User::find(auth()->user()->id);
        $data = [
            "id" => encryptHelper($user->id),
            "encrypt_id" => encrypt($user->id),
            "name" => $user->name,
            "email" => $user->email,
            "email_verified_at" => $user->email_verified_at,
            "created_at" => $user->created_at,
            "updated_at" => $user->updated_at,
            "otp" => $user->otp,
            "otp_expire" => $user->otp_expire,
            "phone" => $user->phone,
            "role" => $user->role,
            "company_id" => $user->company_id,
            "status" => $user->status,
            "avatar" => $user->avatar,
            "address" => $user->address,
            "enable_2fa" => $user->enable_2fa,
            "is_online" => $user->is_online,
            "username" => $user->username,
            "recover_mail" => $user->recover_mail,
            "device_type" => $user->device_type,
            "device_token" => $user->device_token,
            "pin" => $user->pin,
            "onboarding_stage" => $user->onboarding_stage,
            "deleted_at" => $user->deleted_at,
            "access_token" => $user->access_token,
            "device" => $user->device,
            "signal_blocking" => $user->signal_blocking,
            "remote_management" => $user->remote_management,
            "encrypted_storage" => $user->encrypted_storage,
            "self_wipe" => $user->self_wipe,
            "imei" => $user->imei,
            "app_role" => $user->app_role,
            "number_app" => $user->number_app,
            "number_user" => $user->number_user,
            "statusNdpc" => $user->statusNdpc,
            "ndpcCode" => $user->ndpcCode,
            "rc_number" => $user->rc_number,
            "rc_doc" => $user->rc_doc,
            "tin" => $user->tin,
            "tin_doc" => $user->tin_doc,
            "country" => $user->country,
            "dob" => $user->dob,
            "gender" => $user->gender,
            "developer_display_name" => $user->developer_display_name,
            "website" => $user->website,
            "selfie" => $user->selfie,
            "statusApp" => $user->statusApp,
            "id_card_front" => $user->id_card_front,
            "id_card_back" => $user->id_card_back,
            "commentApp" => $user->commentApp,
            "encryptorkey" => $user->encryptorkey,
            "plan_id" => $user->plan_id,
        ];
        return response()->json(
            [
                'status' => '200',
                'message' => 'Record List',
                'data' => $data
            ],
            201
        );
    }

    // i added some validation rules to the profile upload function,
    //  and also wrapped the code in a try catch block to handle any unexpected errors that
    //  may occur during the profile update process. This will help ensure
    // that the API responds with appropriate error messages
    // and status codes in case of validation failures or other exceptions.
    public function profileUpload(Request $request)
    {
        try{

        $validate = validator($request->all(), [
            'avatar' => 'nullable|image|mimes:jpeg,png,jpg,gif,pdf|max:2048',
            'encryptorkey' => 'nullable|string',
            'name' => 'nullable|string|max:255',
            'recover_mail' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:500',
            'enable_2fa' => 'nullable|boolean',
            'device_token' => 'nullable|string|max:255',
            'device_type' => 'nullable|string|max:50',
            'pin' => 'nullable|string|max:10',
            'onboarding_stage' => 'nullable|string|max:50',
            'username' => 'nullable|string|max:255',
            // 'username' => 'nullable|string|max:255|unique:users,username,' . auth()->user()->id,
        ]);
        if ($validate->fails()) {
            return response()->json(
                [
                    'status' => '400',
                    'message' => 'Validation error',
                    'errors' => $validate->errors(),
                    'data' => null
                ],
                400
            );
        }

        $user = User::find(auth()->user()->id);

        if ($request->avatar) {
            $file = $request->file('avatar');
            $file_name = time() . "avatar." . $file->getClientOriginalExtension();
            $file->move(public_path('avatar'), $file_name);

            if ($user->avatar) {
                try {
                    unlink(public_path($user->avatar));
                } catch (\Exception $e) {
                    // Optionally log the error
                }
            }

            $user->update([
                'avatar' => 'avatar/' . $file_name,
            ]);
        }

        if ($request->encryptorkey) {
            $user->update(['encryptorkey' => encryptHelper($request->encryptorkey)]);
        }

        if ($request->name) {
            $user->update(['name' => $request->name]);
        }

        if ($request->recover_mail) {
            $user->update(['recover_mail' => $request->recover_mail]);
        }

        if ($request->phone) {
            $user->update(['phone' => $request->phone]);
        }

        if ($request->address) {
            $user->update(['address' => $request->address]);
        }

        if ($request->enable_2fa) {
            $user->update(['enable_2fa' => $request->enable_2fa]);
        }

        if ($request->device_token) {
            $user->update(['device_token' => $request->device_token]);
        }

        if ($request->device_type) {
            $user->update(['device_type' => $request->device_type]);
        }

        if ($request->pin) {
            $user->update(['pin' => encryptHelper($request->pin)]);
        }

        if ($request->onboarding_stage) {
            $user->update(['onboarding_stage' => $request->onboarding_stage]);
        }

        if ($request->username) {
            $user->update(['username' => $request->username]);
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Profile updated successfully',
                'data' => null
            ],
            201
        );
    }catch(\Exception $e){
        return response()->json(
            [
                'status' => '500',
                'message' => 'An error occurred while updating the profile',
                'error' => $e->getMessage(),
                'data' => null
            ],
            500
        );
        }
    }

    public function contact()
    {
        $record = ContactList::where('user_id', auth()->user()->id)->get();

        $data = [];
        foreach ($record as $key => $dt) {
            $data[$key] = [
                'id' => encryptHelper($dt->id),
                'contact_id_encrypt' => encryptHelper($dt->userLink->id),
                'contact_id' => $dt->userLink->id,
                'contact_name' => $dt->userLink->name,
                'contact_email' => $dt->userLink->email,
                'contact_phone' => $dt->userLink->phone,
                'contact_status' => $dt->userLink->status,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record list',
                'data' => $data
            ],
            201
        );
    }

    public function contactAdd($id)
    {
        $idUser = decryptHelper($id);

        ContactList::firstOrCreate([
            'user_id' => auth()->user()->id,
            'user_link' => $idUser
        ], [
            'status' => 'active'
        ]);

        return response()->json(
            [
                'status' => '200',
                'message' => 'Contact successfully saved',
                'data' => null
            ],
            201
        );
    }

    public function contactRemove($id)
    {
        $idUser = decryptHelper($id);
        ContactList::find($idUser)->delete();

        return response()->json(
            [
                'status' => '200',
                'message' => 'Contact successfully removed',
                'data' => null
            ],
            201
        );
    }

    public function chatCallLog()
    {
        $datas = ChatCallLog::where('send_user_id', auth()->user()->id)->orWhere('recieve_user_id', auth()->user()->id)->orderBy('created_at', 'ASC')->get();

        $data = [];
        foreach ($datas as $dt) {
            $data[] = [
                'send_user_id' => encryptHelper($dt->send_user_id),
                'send_user_name' => $dt->userSender->name,
                'send_user_phone' => $dt->userSender->phone,
                'send_user_email' => $dt->userSender->email,
                'recieve_user_id' => encryptHelper($dt->recieve_user_id),
                'recieve_user_name' => $dt->userReciever->name,
                'recieve_user_phone' => $dt->userReciever->phone,
                'recieve_user_email' => $dt->userReciever->email,
                'call_st' => $dt->call_st,
                'created_at' => $dt->created_at,
                'mss_id' => $dt->mss_id,
                'call_duration' => $dt->call_duration,
                'call_state' => $dt->call_state,
                'chatbtw' => $dt->chatbtw,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function chatHistory()
    {
        $record = ChatLastLog::where('user_id', auth()->user()->id)->join('users', 'users.id', '=', 'chat_last_logs.user_to')->orderBy('users.name', 'ASC')->get();

        $data = [];
        foreach ($record as $key => $dt) {
            $data[$key] = [
                'id' => encryptHelper($dt->id),
                'chat_id' => $dt->group_to,
                'chat_user_to_id' => $dt->userTo->id,
                'chat_user_to_name' => $dt->userTo->name,
                'is_file' => $dt->is_file,
                'last_message' => $dt->last_message,
                'chat_user_type' => $dt->user_group,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function lastMessage()
    {
        $data = $this->ChatService->lastMessage();

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function chatMessages($chat_user_id, $chat_user_type)
    {
        $this->current_chat_user = decryptHelper($chat_user_id);
        // return dd(decryptHelper($chat_user_id));
        $user = User::find(auth()->user()->id);

        $thisuserLastLog = $chat_user_type == 'user' ? ChatLastLog::where('user_id', auth()->user()->id)->where('user_to', $this->current_chat_user)->first() : ChatLastLog::where('user_to', $this->current_chat_user)->first();

        $userLastLog = $thisuserLastLog ? $thisuserLastLog->group_to : null;

        $record = [];
        if ($chat_user_type == 'group') {
            $record = ChatMessage::where('user_to', $this->current_chat_user)->orderBy('created_at', 'DESC')->paginate(10);
        } else {
            $record = ChatMessage::where(function ($query) {
                $query->where('user_id', $this->current_chat_user)
                    ->orWhere('group_to', $this->current_chat_user)
                    ->orWhere('user_to', $this->current_chat_user);
            })->where(function ($query) {
                $query->where('user_id', auth()->user()->id)
                    ->orWhere('group_to', auth()->user()->id)
                    ->orWhere('user_to', auth()->user()->id);
            })->orderBy('created_at', 'DESC')->paginate(10);
        }

        $data = [];
        foreach ($record as $key => $dt) {
            if ($dt->user_id != auth()->user()->id) {
                $dt->update(['is_read' => 'yes']);
            }

            $data[$key] = [
                'id' => encryptHelper($dt->id),
                'is_my_chat' => $dt->user_id == auth()->user()->id ? 'yes' : 'no',
                'user_id' => encryptHelper($dt->user_id),
                'user_name' => $dt->user->name,
                'user_to' => encryptHelper($dt->user_to),
                'user_to_name' => $dt->userTo->name,
                'group_to' => $dt->group_to,
                'chat_user_type' => $dt->user_group,
                'is_file' => $dt->is_file,
                'file_type' => $dt->file_type,
                'is_read' => $dt->is_read,
                'is_important' => $dt->is_important,
                'is_forward' => $dt->is_forward,
                'is_star' => $dt->is_star,
                'view_once' => $dt->view_once,
                'mss_type' => $dt->mss_type,
                'call_duration' => $dt->mss_type == "call" ? $dt->chatCall->call_duration : null,
                'call_state' => $dt->mss_type == "call" ? $dt->chatCall->call_state : null,
                'chatbtw' => $dt->mss_type == "call" ? $dt->chatCall->chatbtw : null,
                'expire_time' => $dt->expire_time,
                'source_language' => $dt->source_language,
                'message' => googleAiTransHelper(decrypt($dt->message), $dt->source_language, $user->chatSettings->chat_language),
                'tag_user' => convertBackToenHelper($dt->tag_user),
                'tag_mess_id' => encryptHelper($dt->tag_mess),
                'tag_mess_user' => $dt->tag_mess ? encryptHelper($dt->parent->user_id) : null,
                'tag_mess_is_my_chat' => $dt->tag_mess ? ($dt->parent->user_id == auth()->id() ? 'yes' : 'no') : null,
                'tag_mess' => $dt->tag_mess ? googleAiTransHelper(decrypt($dt->parent->message), $dt->parent->source_language, $user->chatSettings->chat_language) : null,
                'deleted_at' => $dt->deleted_at,
                'created_at' => $dt->created_at,
                'updated_at' => $dt->updated_at,
            ];
        }

        $chat_meta = [
            'chat_user_id' => decryptHelper($chat_user_id),
            'chat_user_id_en' => $chat_user_id,
            'chat_id' => $userLastLog,
            'chat_user_type' => $chat_user_type,
            "current_page" => $record->currentPage(),
            "last_page" => $record->lastPage(),
            "per_page" => $record->perPage(),
            "total" => $record->total(),
            "urlparams" => "?page=",
        ];

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'chat_meta' => $chat_meta,
                'data' => $data
            ],
            201
        );
    }

    public function getmeeting()
    {
        $datas = Meeting::where('user_id', auth()->user()->id)->get();

        $data = [];
        foreach ($datas as $dt) {
            $data[] = [
                'id' => encryptHelper($dt->id),
                'meeting_link' => $dt->meeting_link,
                'meeting_id' => $dt->meeting_id,
                'creator_id' => encryptHelper($dt->userCreate->id),
                'creator_name' => $dt->userCreate->name,
                'subject' => $dt->subject,
                'title' => $dt->title,
                'agenda' => $dt->agenda,
                'startdatetime' => $dt->startdatetime,
                'duration' => $dt->duration,
                'number_join' => $dt->number_join,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function getmeetingDetail($id)
    {
        $datas = Meeting::where("id", decryptHelper($id))->orWhere("meeting_id", $id)->first();
        if (!$datas) {
            return response()->json(
                [
                    'status' => '404',
                    'message' => 'Record not found',
                    'data' => null
                ],
                404
            );
        }
        $data = [
            'id' => encryptHelper($datas->id),
            'meeting_link' => $datas->meeting_link,
            'meeting_id' => $datas->meeting_id,
            'creator_id' => encryptHelper($datas->userCreate->id),
            'creator_name' => $datas->userCreate->name,
            'subject' => $datas->subject,
            'title' => $datas->title,
            'agenda' => $datas->agenda,
            'startdatetime' => $datas->startdatetime,
            'duration' => $datas->duration,
            'number_join' => $datas->number_join,
        ];

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function getmeetingid($id, $type)
    {
        $datas = Meeting::where('group_user_id', decryptHelper($id))->where('group_user', $type)->get();

        $data = [];
        foreach ($datas as $dt) {
            $data[] = [
                'id' => encryptHelper($dt->id),
                'group_user_id' => encryptHelper($dt->group_user_id),
                'group_user' => $dt->group_user,
                'meeting_link' => $dt->meeting_link,
                'meeting_id' => $dt->meeting_id,
                'creator_id' => encryptHelper($dt->meeting->userCreate->id),
                'creator_name' => $dt->meeting->userCreate->name,
                'subject' => $dt->subject,
                'title' => $dt->title,
                'agenda' => $dt->agenda,
                'startdatetime' => $dt->startdatetime,
                'duration' => $dt->duration,
                'number_join' => $dt->number_join,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function meetingInvitationlist($status = null)
    {
        if ($status) {
            $datas = MeetingLog::where('user_id', auth()->user()->id)->where('user_type', 'participant')->where('join_status', $status)->get();
        } else {
            $datas = MeetingLog::where('user_id', auth()->user()->id)->where('user_type', 'participant')->get();
        }

        $data = [];
        foreach ($datas as $dt) {
            $data[] = [
                'id' => encryptHelper($dt->meeting->id),
                'meeting_id' => encryptHelper($dt->meeting->id),
                'meeting_link' => $dt->meeting->meeting_link,
                'meeting_id' => $dt->meeting->meeting_id,
                'creator_id' => encryptHelper($dt->meeting->userCreate->id),
                'creator_name' => $dt->meeting->userCreate->name,
                'subject' => $dt->meeting->subject,
                'title' => $dt->meeting->title,
                'agenda' => $dt->meeting->agenda,
                'startdatetime' => $dt->meeting->startdatetime,
                'duration' => $dt->meeting->duration,
                'number_join' => $dt->meeting->number_join,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function meetingParticipantlist($id, $status)
    {
        $datas = MeetingLog::where('meetings_id', decryptHelper($id))->where('user_type', 'participant')->where('join_status', $status)->get();

        $data = [];
        foreach ($datas as $dt) {
            $data[] = [
                'id' => encryptHelper($dt->meeting->id),
                'meeting_id' => encryptHelper($dt->meeting->id),
                'meeting_link' => $dt->meeting->meeting_link,
                'meeting_id' => $dt->meeting->meeting_id,
                'creator_id' => encryptHelper($dt->meeting->userCreate->id),
                'creator_name' => $dt->meeting->userCreate->name,
                'subject' => $dt->meeting->subject,
                'title' => $dt->meeting->title,
                'agenda' => $dt->meeting->agenda,
                'startdatetime' => $dt->meeting->startdatetime,
                'duration' => $dt->meeting->duration,
                'number_join' => $dt->meeting->number_join,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function folderFile(Request $request)
    {
        $data = FolderFile::updateOrCreate([
            'user_id' => auth()->user()->id,
            'folder_id' => decryptHelper($request->folder_id),
            'file_id' => decryptHelper($request->file_id),
        ]);

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function folderCreate(Request $request)
    {
        $data = Folders::updateOrCreate([
            'user_id' => auth()->user()->id,
            'name' => $request->name,
            'rel' => $request->rel ? decryptHelper($request->rel) : null,
        ], [
            'description' => $request->description,
        ]);

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function folderUpdate(Request $request)
    {
        $data = Folders::find(decryptHelper($request->id));
        $data->update([
            'name' => $request->name,
            'rel' => $request->rel ? decryptHelper($request->rel) : $data->rel,
            'description' => $request->description,
        ]);

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function folderdelete($id)
    {
        $data = Folders::find(decryptHelper($id))->delete();

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record delete',
                'data' => $data
            ],
            201
        );
    }

    public function folderget()
    {
        $folder = Folders::where('user_id', auth()->user()->id)->whereNull('rel')->get();
        $data = [];

        foreach ($folder as $fl) {
            $data[] = [
                'id' => encryptHelper($fl->id),
                'name' => $fl->name,
                'description' => $fl->description,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function foldergetId($id)
    {
        $folder = Folders::where('user_id', auth()->user()->id)->where('rel', decryptHelper($id))->get();
        $data = [];

        foreach ($folder as $fl) {
            $data['folder'][] = [
                'id' => encryptHelper($fl->id),
                'name' => $fl->name,
                'description' => $fl->description,
            ];
        }

        $file = FileFolder::where('folder_id', decryptHelper($id))->get();
        foreach ($file as $fi) {
            $data['file'][] = [
                'id' => encryptHelper($fi->id),
                'name' => $fi->file->name,
                'file_size' => $fi->file->file_size,
                'file_ext' => $fi->file->file_ext,
                'description' => $fi->file->description
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function messagesTyping(Request $request)
    {
        broadcast(new PrivateMessageSent(auth()->user()->id, $request->current_chat_user, [
            'state' => $request->typing,
            'sender_id' => auth()->user()->id,
            'sender_iden' => encryptHelper(auth()->user()->id),
            'receiver_id' => $request->current_chat_user,
            'receiver_iden' => encryptHelper($request->current_chat_user),
            'message' => '',
            'name' => '',
            'data' => ''
        ]))->toOthers();

        return true;
    }

    public function messagesImportant($id)
    {
        ChatMessage::find(decryptHelper($id))->update(['is_important' => 'yes']);

        return response()->json(
            [
                'status' => '200',
                'message' => 'Message marked as important',
                'data' => null
            ],
            201
        );
    }

    public function messagesIsread($id)
    {
        $chat = ChatMessage::where('id', decryptHelper($id))->where('user_to', auth()->user()->id)->first();
        $data = null;
        if ($chat) {
            $chat->update(['is_read' => 'yes']);

            $data = $this->ChatService->lastMessage();
            $lastMessage = [
                "state" => "last_message",
                "data" => $data
            ];
            if ($chat->user_group == 'group') {
                broadcast(new PrivateGroupMessageSent(encryptHelper(auth()->user()->id), encryptHelper(auth()->user()->id), $lastMessage))->toOthers();
            } else {
                broadcast(new PrivateMessageSent(encryptHelper(auth()->user()->id), encryptHelper(auth()->user()->id), $lastMessage))->toOthers();
            }
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Message marked as read',
                'data' => $data
            ],
            201
        );
    }

    public function meetingCreate(Request $request)
    {
        $user = User::find(auth()->user()->id);

        if ($user->plan_id === null) {
            return response()->json(
                [
                    'status' => '400',
                    'message' => 'You do not have an active plan. Please subscribe',
                    'data' => null
                ],
                401
            );
        }

        if ($user->plan->enable_meeting == "no") {
            return response()->json(
                [
                    'status' => '400',
                    'message' => 'You do not have access to this feature. Please subscribe',
                    'data' => null
                ],
                401
            );
        }

        $data = Meeting::create([
            'user_id' => auth()->user()->id,
            'meeting_link' => $request->meeting_link,
            'meeting_id' => $request->meeting_id,
            'subject' => $request->subject,
            'title' => $request->title,
            'agenda' => $request->agenda,
            'startdatetime' => $request->startdatetime,
        ]);

        if ($request->group_user == "users" && $request->group_user_id) {
            $this->ChatService->meetingInvitation(encryptHelper($data->id), $request->group_user_id);
        }

        if ($request->group_user == "group" && $request->group_user_id) {
            $this->ChatService->meetingInvitationGroup(encryptHelper($data->id), $request->group_user_id);
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => [
                    'id' => encryptHelper($data->id),
                    'meeting_link' => $data->meeting_link . '/' . encryptHelper($data->id),
                    'meeting_id' => $data->meeting_id,
                    'subject' => $data->subject,
                    'title' => $data->title,
                    'agenda' => $data->agenda,
                    'startdatetime' => $data->startdatetime,
                ]
            ],
            201
        );
    }

    public function meetingUpdate(Request $request)
    {
        $data = Meeting::find(decryptHelper($request->id));

        if ($request->meeting_link) {
            $data->update(['meeting_link' => $request->meeting_link]);
        }

        if ($request->meeting_id) {
            $data->update(['meeting_id' => $request->meeting_id]);
        }

        if ($request->subject) {
            $data->update(['subject' => $request->subject]);
        }

        if ($request->title) {
            $data->update(['title' => $request->title]);
        }

        if ($request->agenda) {
            $data->update(['agenda' => $request->agenda]);
        }

        if ($request->startdatetime) {
            $data->update(['startdatetime' => $request->startdatetime]);
        }

        if ($request->duration) {
            $data->update(['duration' => $request->duration]);
        }

        if ($request->number_join) {
            $data->update(['number_join' => $request->number_join]);
        }

        if ($request->status) {
            $data->update(['status' => $request->status]);
        }

        $data = Meeting::find(decryptHelper($request->id));

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function meetingInvitation(Request $request)
    {
        $data = $this->ChatService->meetingInvitation($request->meetings_id, $request->users);

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function meetingInvitationJoin($id)
    {
        $meet = Meeting::find(decryptHelper($id));
        $user = MeetingLog::where('meetings_id', $meet->id)->where('user_id', auth()->user()->id)->first();
        if ($user->join_status == 'invite') {
            if ($meet->status == 'start') {
                $meet->update(['number_join' => $meet->number_join + 1]);
                $user->update(['join_status' => 'joined']);
            }
            if ($meet->status == 'end') {
                $user->update(['join_status' => 'close']);
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

    public function meetingInvitationGroup(Request $request)
    {
        $data = $this->ChatService->meetingInvitationGroup($request->meetings_id, $request->group_id);
        return $data;
    }

    public function sendMessageCall(Request $request)
    {
        $calllog = ChatCallLog::where('mss_id', decryptHelper($request->mss_id))->first();
        $chatmss = ChatMessage::find(decryptHelper($request->mss_id));

        if ($calllog) {
            if ($request->call_duration) {
                $calllog->update(['call_duration' => $request->call_duration]);
            }

            if ($request->call_state) {
                $calllog->update(['call_state' => $request->call_state]);
            }

            if ($request->call_state == "miss") {
                Mail::to($calllog->userReciever->email)->send(new MissCallMail($calllog->userSender->name, $calllog->userReciever->name));
            }

            $data = [
                // 'id' => $chatmss->id,
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
                // 'message' => $current_chat_user_type == 'group' ? $message : googleAiTransHelper(decrypt($chatmss->message), $user->chatSettings->chat_language, $altuser->chatSettings->chat_language),
                'tag_user' => convertBackToenHelper($chatmss->tag_user),
                'tag_mess' => encryptHelper($chatmss->tag_mess),
                'deleted_at' => $chatmss->deleted_at,
                'created_at' => $chatmss->created_at,
                'updated_at' => $chatmss->updated_at,
            ];

            $calllogData = [
                'state' => 'callUpdate',
                'user' => encryptHelper($calllog->userReciever->id),
                'sender' => [
                    // 'id' => $calllog->userSender->id,
                    'id' => encryptHelper($calllog->userSender->id),
                    'name' => $calllog->userSender->name,
                    'phone' => $calllog->userSender->phone,
                    'email' => $calllog->userSender->email,
                ],
                'receiver' => [
                    // 'id' => $calllog->userReciever->id,
                    'id' => encryptHelper($calllog->userReciever->id),
                    'name' => $calllog->userReciever->name,
                    'phone' => $calllog->userReciever->phone,
                    'email' => $calllog->userReciever->email,
                ],
                'call' => [
                    "chat_id" => encryptHelper($calllog->chatMess->id),
                    "call_duration" => $request->call_duration,
                    "call_state" => $request->call_state
                ],
                'mss' => $data
            ];

            broadcast(new PrivateMessageSent(encryptHelper(auth()->user()->id), encryptHelper($calllog->userReciever->id), $calllogData))->toOthers();

            return response()->json(
                [
                    'status' => '200',
                    'message' => 'call log updated',
                    'data' => $calllogData,
                ],
                201
            );
        }

        return response()->json(
            [
                'status' => '400',
                'message' => 'No log found',
                'data' => null
            ],
            401
        );
    }

    public function sendMessage(Request $request)
    {
        $user = User::find(auth()->user()->id);

        if ($user->plan_id === null) {
            return response()->json(
                [
                    'status' => '400',
                    'message' => 'You do not have an active plan. Please subscribe',
                    'data' => null
                ],
                401
            );
        }

        if ($user->plan->enable_chat == "no" && $request->mss_type == 'text') {
            return response()->json(
                [
                    'status' => '400',
                    'message' => 'You do not have access to this feature. Please subscribe',
                    'data' => null
                ],
                401
            );
        }

        if ($user->plan->enable_call == "no" && $request->mss_type == 'call') {
            return response()->json(
                [
                    'status' => '400',
                    'message' => 'You do not have access to this feature. Please subscribe',
                    'data' => null
                ],
                401
            );
        }

        if ($request->message) {

            $message = "";
            if ($request->is_file == "yes") {
                $file = $this->FileUploadService->submitFile($request);

                if ($file['status'] == false) {
                    return response()->json(
                        [
                            'status' => '400',
                            'message' => $file['message'],
                            'data' => null
                        ],
                        401
                    );
                }
                $message = $file['data']['file'];
            } else {
                $message = $request->message;
            }

            $tag_user = null;
            if ($request->tag_user) {
                $decrypted = array_map(function ($item) {
                    return decryptHelper($item);
                }, forceToArray($request->tag_user));

                // convert to string (JSON is common for DB storage)
                $tag_user = json_encode($decrypted);
            }

            $ret = $this->ChatService->submitChat(
                $request->current_chat_user_type,
                decryptHelper($request->current_chat_user),
                decryptHelper($request->chat_id),
                $message,
                $request->is_file,
                $request->mss_type,
                $tag_user,
                $request->tag_mess ? decryptHelper($request->tag_mess) : null
            );
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Message Sent',
                'data' => $ret
            ],
            201
        );
    }

    public function getsetting(Request $request)
    {
        $set = ChatSettings::where('user_id', auth()->user()->id)->first();
        $data = [
            'hide_message' => $set->hide_message,
            'hide_message_style' => $set->hide_message_style,
            'walkie_language' => $set->walkie_language,
            'chat_language' => $set->chat_language,
            'app_language' => $set->app_language,
        ];

        return response()->json(
            [
                'status' => '200',
                'message' => 'Setting updated',
                'data' => $data
            ],
            201
        );
    }

    public function setting(Request $request)
    {
        if ($request->hide_message) {
            ChatSettings::updateOrCreate(['user_id' => auth()->user()->id], [
                'hide_message' => $request->hide_message,
            ]);
        }
        if ($request->hide_message_style) {
            ChatSettings::updateOrCreate(['user_id' => auth()->user()->id], [
                'hide_message_style' => $request->hide_message_style,
            ]);
        }
        if ($request->walkie_language) {
            ChatSettings::updateOrCreate(['user_id' => auth()->user()->id], [
                'walkie_language' => $request->walkie_language,
            ]);
        }
        if ($request->chat_language) {
            ChatSettings::updateOrCreate(['user_id' => auth()->user()->id], [
                'chat_language' => $request->chat_language,
            ]);
        }
        if ($request->app_language) {
            ChatSettings::updateOrCreate(['user_id' => auth()->user()->id], [
                'app_language' => $request->app_language,
            ]);
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Setting updated',
                'data' => null
            ],
            201
        );
    }

    public function languagecode()
    {
        $data = LanguageCode::where('status', 'active')->get();
        return response()->json(
            [
                'status' => '200',
                'message' => 'Setting updated',
                'data' => $data
            ],
            201
        );
    }

    // public function groupMember($id)
    // {
    //     try{
    //     $idUser = decryptHelper($id);
    //     $record = CompanyGroupUser::where('group_id', $idUser)->where('user_id', '!=', auth()->user()->id)->where('status', 'joined')->get();
    //     $group = CompanyGroup::find($idUser);

    //     $data = [];
    //     foreach ($record as $key => $dt) {
    //         $data[$key] = [
    //             'id' => encryptHelper($dt->id),
    //             'join_date' => $dt->join_date,
    //             'hide_member_detail' => $dt->hide,
    //             'member_id_encrpt' => encryptHelper($dt->user_id),
    //             'member_id' => $dt->user_id,
    //             'member_name' => $dt->user->name,
    //         ];
    //     }

    //     return response()->json(
    //         [
    //             'status' => '200',
    //             'message' => 'Record listed',
    //             'group_meta' => [
    //                 "id" => encryptHelper($group->id),
    //                 "company_id" => encryptHelper($group->company_id),
    //                 "name" => $group->name,
    //                 "decription" => $group->decription,
    //                 "created_at" => $group->created_at,
    //                 "updated_at" => $group->updated_at,
    //                 "avatar" => $group->avatar
    //             ],
    //             'data' => $data
    //         ],
    //         201
    //     );
    //     }catch(\Exception $e){
    //         return response()->json(
    //             [
    //                 'status' => '400',
    //                 'message' => 'Invalid group ID',
    //                 'data' => null
    //             ],
    //             400
    //         );
    //     }
    // }


    public function groupMember($id)
{
    try {
        $idUser = decryptHelper($id);
        $authUserId = auth()->user()->id;

        // ── Verify auth user belongs to this group ──────────────────────────
        $isMember = CompanyGroupUser::where('group_id', $idUser)
            ->where('user_id', $authUserId)
            ->where('status', 'joined')
            ->exists();

        if (!$isMember) {
            return response()->json([
                'status'  => '403',
                'message' => 'You are not a member of this group',
                'data'    => null,
            ], 403);
        }

        // ── Fetch all members (excluding self) ──────────────────────────────
        $record = CompanyGroupUser::where('group_id', $idUser)
            ->where('user_id', '!=', $authUserId)
            ->where('status', 'joined')
            ->get();

        $group = CompanyGroup::find($idUser);

        $data = [];
        foreach ($record as $key => $dt) {
            $data[$key] = [
                'id'                 => encryptHelper($dt->id),
                'join_date'          => $dt->join_date,
                'hide_member_detail' => $dt->hide,
                'member_id_encrpt'   => encryptHelper($dt->user_id),
                'member_id'          => $dt->user_id,
                'member_name'        => $dt->user->name,
            ];
        }

        return response()->json([
            'status'     => '200',
            'message'    => 'Record listed',
            'group_meta' => [
                'id'         => encryptHelper($group->id),
                'company_id' => encryptHelper($group->company_id),
                'name'       => $group->name,
                'decription' => $group->decription,
                'created_at' => $group->created_at,
                'updated_at' => $group->updated_at,
                'avatar'     => $group->avatar,
            ],
            'data' => $data,
        ], 200);

    } catch (\Exception $e) {
        return response()->json([
            'status'  => '400',
            'message' => 'Invalid group ID',
            'data'    => null,
        ], 400);
    }
}

    public function notification()
    {
        $data = Notification::where('status', 'active')
            ->where(function ($q) {
                $q->whereNull('expire')
                    ->orWhere('expire', '>=', Carbon::now());
            })
            ->where(function ($q) {
                $q->where('company_id', auth()->user()->company_id)
                    ->orWhere('source', 'super');
            })
            ->orderByDesc('id')
            ->get();



        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function meetingTokenGen()
    {
        $VIDEOSDK_API_KEY = "533374080782aa04f1f129fa3837589694170ccac5a34a7281b8f058c8f0445b";
        $VIDEOSDK_SECRET_KEY = "83f2a350-a7c2-42cf-8447-18dc0b7cbb48";

        $issuedAt = new \DateTimeImmutable();
        $expire = $issuedAt->modify('+2 hours')->getTimestamp();

        $payload = [
            'apikey' => $VIDEOSDK_API_KEY,
            'permissions' => ['allow_join', 'allow_mod'],
            'version' => 2,
            'roomId' => '2kyv-gzay-64pg',
            'participantId' => 'lxvdplwt',
            'roles' => ['crawler'],
            'iat' => $issuedAt->getTimestamp(),
            'exp' => $expire,
        ];

        $jwt = JWT::encode($payload, $VIDEOSDK_SECRET_KEY, 'HS256');

        return response()->json(['token' => $jwt]);
    }

    public function appstatus(Request $request)
    {
        $data = AppStore::where('user', auth()->user()->id)->where('id', decryptHelper($request->id))->first();
        $data->update([
            'status' => $request->status,
            'active_date' => $request->status == "active" ? Carbon::now() : null,
            'disable_date' => $request->status == "disable" ? Carbon::now() : null
        ]);

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function appcreate(Request $request)
    {
        if ($request->id) {
            $app = AppStore::where('user', auth()->user()->id)->where('id', decryptHelper($request->id))->first();
            if (empty($app)) {
                return response()->json(
                    [
                        'status' => '400',
                        'message' => "Wrong app ID. Contact support",
                        'data' => null
                    ],
                    401
                );
            }
        } else {

            $app = AppStore::create([
                'user' => auth()->user()->id,
                'name' => $request->name,
                'app_id' => uniqid()
            ]);
        }

        if ($request->app_id) {
            $appid = AppStore::where('app_id', $request->app_id)->first();
            if (!empty($appid) && $appid != $request->app_id) {
                return response()->json(
                    [
                        'status' => '400',
                        'message' => "App Id already use. Try another one",
                        'data' => null
                    ],
                    401
                );
            }
            $app->update(['app_id' => $request->app_id]);
        }
        if ($request->app_id_name) {
            $app->update(['app_id_name' => $request->app_id_name]);
        }
        if ($request->app_id_prefix) {
            $app->update(['app_id_prefix' => $request->app_id_prefix]);
        }
        if ($request->app_id_surfix) {
            $app->update(['app_id_surfix' => $request->app_id_surfix]);
        }

        if ($request->name) {
            $app->update(['name' => $request->name]);
        }

        if ($request->description) {
            $app->update(['description' => $request->description]);
        }
        if ($request->category) {
            $app->update(['category' => $request->category]);
        }
        if ($request->email) {
            $app->update(['email' => $request->email]);
        }
        if ($request->phone) {
            $app->update(['phone' => $request->phone]);
        }
        if ($request->phone_opt) {
            $app->update(['phone_opt' => $request->phone_opt]);
        }
        if ($request->os) {
            $app->update(['os' => $request->os]);
        }

        if ($request->hasFile('app_icon')) {
            $fileIcon = $request->file('app_icon');
            $fileIcon_name = time() . '_app_icon.' . $fileIcon->getClientOriginalExtension();
            $fileIcon->move(public_path('app/app_icon'), $fileIcon_name);

            // Delete the old file if it exists
            if ($app->app_icon && file_exists(public_path($app->app_icon))) {
                try {
                    unlink(public_path($app->app_icon));
                } catch (\Exception $e) {
                    // Log the error if needed
                    // Log::error("Failed to delete old app_icon: " . $e->getMessage());
                }
            }

            // Update the new file path in the database
            $app->update(['app_icon' => 'app/app_icon/' . $fileIcon_name]);
        }

        if ($request->hasFile('feature_image')) {
            $fileFeatureimage = $request->file('feature_image');
            $fileFeatureimage_name = time() . '_feature_image.' . $fileFeatureimage->getClientOriginalExtension();
            $fileFeatureimage->move(public_path('app/feature_image'), $fileFeatureimage_name);

            // Delete the old feature image if it exists
            if ($app->feature_image && file_exists(public_path($app->feature_image))) {
                try {
                    unlink(public_path($app->feature_image));
                } catch (\Exception $e) {
                    // Optionally log the error
                    // Log::error("Failed to delete old feature image: " . $e->getMessage());
                }
            }

            // Update the new file path in the database
            $app->update(['feature_image' => 'app/feature_image/' . $fileFeatureimage_name]);
        }

        if ($request->hasFile('app_bundle')) {
            $fileBundle = $request->file('app_bundle');
            $fileBundle_name = time() . '_app_bundle.' . $fileBundle->getClientOriginalExtension();
            $fileBundle->move(public_path('app/app_bundle'), $fileBundle_name);

            // Delete the old bundle file if it exists
            if ($app->app_bundle && file_exists(public_path($app->app_bundle))) {
                try {
                    unlink(public_path($app->app_bundle));
                } catch (\Exception $e) {
                    // Optionally log the error
                    // Log::error("Failed to delete old app_bundle: " . $e->getMessage());
                }
            }

            // Update the new file path in the database
            $app->update(['app_bundle' => 'app/app_bundle/' . $fileBundle_name]);
        }

        if ($request->policy) {
            $app->update(['policy' => $request->policy]);
        }
        if ($request->name_release) {
            $app->update(['name_release' => $request->name_release]);
        }
        if ($request->version) {
            $app->update(['version' => $request->version]);
        }
        if ($request->copyright) {
            $app->update(['copyright' => $request->copyright]);
        }
        if ($request->release) {
            $app->update(['release' => $request->release]);
        }
        if ($request->collect_data) {
            $app->update(['collect_data' => $request->collect_data]);
        }
        if ($request->contact_name) {
            $app->update(['contact_name' => $request->contact_name]);
        }
        if ($request->contact_email) {
            $app->update(['contact_email' => $request->contact_email]);
        }
        if ($request->contact_phone) {
            $app->update(['contact_phone' => $request->contact_phone]);
        }
        if ($request->contact_address) {
            $app->update(['contact_address' => $request->contact_address]);
        }
        if ($request->contact_other) {
            $app->update(['contact_other' => $request->contact_other]);
        }
        if ($request->location_precise) {
            $app->update(['location_precise' => $request->location_precise]);
        }
        if ($request->location_coarse) {
            $app->update(['location_coarse' => $request->location_coarse]);
        }
        if ($request->sensitive_info) {
            $app->update(['sensitive_info' => $request->sensitive_info]);
        }
        if ($request->active_date) {
            $app->update(['active_date' => $request->active_date]);
        }
        if ($request->disable_date) {
            $app->update(['disable_date' => $request->disable_date]);
        }
        if ($request->reject_date) {
            $app->update(['reject_date' => $request->reject_date]);
        }
        if ($request->comment) {
            $app->update(['comment' => $request->comment]);
        }

        if ($app->status == 'reject') {
            $app->update(['status' => 'pending', 'resubmit_date' => Carbon::now()]);
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $app
            ],
            201
        );
    }

    public function appList(Request $request)
    {
        $dat = AppStore::where('status', 'active')->get();

        $data = [];
        foreach ($dat as $dt) {
            $data[] = [
                "id" => encryptHelper($dt->id),
                "developer" => $dt->userId->name,
                "app_name" => $dt->name,
                "description" => $dt->description,
                "category" => $dt->category,
                "email" => $dt->email,
                "phone" => $dt->phone,
                "phone_opt" => $dt->phone_opt,
                "os" => $dt->os,
                "app_icon" => $dt->app_icon,
                "feature_image" => $dt->feature_image,
                "policy" => $dt->policy,
                "app_bundle" => $dt->app_bundle,
                "name_release" => $dt->name_release,
                "version" => $dt->version,
                "copyright" => $dt->copyright,
                "release" => $dt->release,
                "collect_data" => $dt->collect_data,
                "contact_name" => $dt->contact_name,
                "contact_email" => $dt->contact_email,
                "contact_phone" => $dt->contact_phone,
                "contact_address" => $dt->contact_address,
                "contact_other" => $dt->contact_other,
                "location_precise" => $dt->location_precise,
                "location_coarse" => $dt->location_coarse,
                "sensitive_info" => $dt->sensitive_info,
                "app_id" => $dt->app_id,
                "app_id_name" => $dt->app_id_name,
                "app_id_prefix" => $dt->app_id_prefix,
                "app_id_surfix" => $dt->app_id_surfix,
                "rc_number" => $dt->rc_number,
                "tin_number" => $dt->tin_number,
                "status" => $dt->status,
                "active_date" => $dt->active_date,
                "disable_date" => $dt->disable_date,
                "reject_date" => $dt->reject_date,
                "resubmit_date" => $dt->resubmit_date,
                "comment" => $dt->comment,
                "created_at" => $dt->created_at,
                "updated_at" => $dt->updated_at,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function appListId($id)
    {
        $dt = AppStore::find(decryptHelper($id));
        $data[] = [
            "id" => encryptHelper($dt->id),
            "developer" => $dt->userId->name,
            "app_name" => $dt->name,
            "description" => $dt->description,
            "category" => $dt->category,
            "email" => $dt->email,
            "phone" => $dt->phone,
            "phone_opt" => $dt->phone_opt,
            "os" => $dt->os,
            "app_icon" => $dt->app_icon,
            "feature_image" => $dt->feature_image,
            "policy" => $dt->policy,
            "app_bundle" => $dt->app_bundle,
            "name_release" => $dt->name_release,
            "version" => $dt->version,
            "copyright" => $dt->copyright,
            "release" => $dt->release,
            "collect_data" => $dt->collect_data,
            "contact_name" => $dt->contact_name,
            "contact_email" => $dt->contact_email,
            "contact_phone" => $dt->contact_phone,
            "contact_address" => $dt->contact_address,
            "contact_other" => $dt->contact_other,
            "location_precise" => $dt->location_precise,
            "location_coarse" => $dt->location_coarse,
            "sensitive_info" => $dt->sensitive_info,
            "app_id" => $dt->app_id,
            "app_id_name" => $dt->app_id_name,
            "app_id_prefix" => $dt->app_id_prefix,
            "app_id_surfix" => $dt->app_id_surfix,
            "rc_number" => $dt->rc_number,
            "tin_number" => $dt->tin_number,
            "status" => $dt->status,
            "active_date" => $dt->active_date,
            "disable_date" => $dt->disable_date,
            "reject_date" => $dt->reject_date,
            "resubmit_date" => $dt->resubmit_date,
            "comment" => $dt->comment,
            "created_at" => $dt->created_at,
            "updated_at" => $dt->updated_at,
        ];

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    function deleteTemporaryAudio(string $publicPath): void
    {
        if (Storage::disk('public')->exists($publicPath)) {
            Storage::disk('public')->delete($publicPath);
        }
    }


    public function appOwnList(Request $request)
    {
        $dat = AppStore::where('user', auth()->user()->id)->get();

        $data = [];
        foreach ($dat as $dt) {
            $data[] = [
                "id" => encryptHelper($dt->id),
                "developer" => $dt->userId->name,
                "app_name" => $dt->name,
                "description" => $dt->description,
                "category" => $dt->category,
                "email" => $dt->email,
                "phone" => $dt->phone,
                "phone_opt" => $dt->phone_opt,
                "os" => $dt->os,
                "app_icon" => $dt->app_icon,
                "feature_image" => $dt->feature_image,
                "policy" => $dt->policy,
                "app_bundle" => $dt->app_bundle,
                "name_release" => $dt->name_release,
                "version" => $dt->version,
                "copyright" => $dt->copyright,
                "release" => $dt->release,
                "collect_data" => $dt->collect_data,
                "contact_name" => $dt->contact_name,
                "contact_email" => $dt->contact_email,
                "contact_phone" => $dt->contact_phone,
                "contact_address" => $dt->contact_address,
                "contact_other" => $dt->contact_other,
                "location_precise" => $dt->location_precise,
                "location_coarse" => $dt->location_coarse,
                "sensitive_info" => $dt->sensitive_info,
                "app_id" => $dt->app_id,
                "app_id_name" => $dt->app_id_name,
                "app_id_prefix" => $dt->app_id_prefix,
                "app_id_surfix" => $dt->app_id_surfix,
                "rc_number" => $dt->rc_number,
                "tin_number" => $dt->tin_number,
                "status" => $dt->status,
                "active_date" => $dt->active_date,
                "disable_date" => $dt->disable_date,
                "reject_date" => $dt->reject_date,
                "resubmit_date" => $dt->resubmit_date,
                "comment" => $dt->comment,
                "created_at" => $dt->created_at,
                "updated_at" => $dt->updated_at,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function eventRegister()
    {
        $datas = EventRegistration::where('user_id', auth()->user()->id)->get();
        $data = [];
        foreach ($datas as $dt) {
            $data[] = [
                "id" => encryptHelper($dt->id),
                "id_enc" => encrypt($dt->id),
                "event_id" => encryptHelper($dt->form->id),
                "event_id_enc" => encrypt($dt->form->id),
                "name" => $dt->form->name,
                "formType" => $dt->form->form_type,
                "group_id" => $dt->form->group->name,
                "group_id_enc" => encrypt($dt->form->group->id),
                "group_id" => encryptHelper($dt->form->group->id),
                "group_name" => $dt->form->group->name,
                "meeting_id" => encryptHelper($dt->form->meeting->id),
                "meeting_id_enc" => encrypt($dt->form->meeting->id),
                "meeting_title" => $dt->form->meeting->title,
                "meeting_link" => $dt->form->meeting->meeting_link,
                "meeting_uid" => $dt->form->meeting->meeting_id,
                "description" => $dt->form->message,
                "submission" => json_decode($dt->data),
                "submission_date" => $dt->created_at,
                "created_at" => $dt->form->created_at,
                "started_at" => $dt->form->started_at,
                "ended_at" => $dt->form->ended_at,
                "location" => $dt->form->location,
                "latitude" => $dt->form->latitude,
                "longitude" => $dt->form->longitude,
                "status" => $dt->form->status,
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }

    public function eventCertificate($eventId = "")
    {
        // fetch registrations for the authenticated user
        $query = EventRegistration::where('user_id', auth()->user()->id);

        // if an encrypted registration id was provided, apply filter
        if ($eventId) {
            $query->where('id', decrypt($eventId));
        }

        $registrations = $query->get();
        $data = [];

        foreach ($registrations as $dt) {
            // load any certificates tied to this registration
            $certs = CertificateRegistrations::where('event_registration_id', $dt->id)->get();

            $certData = [];
            foreach ($certs as $cert) {
                $certData[] = [
                    'id'         => encrypt($cert->id),
                    'name'       => $cert->certificate->name,
                    'is_collected'     => $cert->is_collected,
                    'is_sent'     => $cert->is_sent,
                    'created_at' => $cert->created_at,
                ];
            }

            $data[] = [
                'registration_id' => encrypt($dt->id),
                'event_id'        => encrypt($dt->form->id),
                'event_name'      => $dt->form->name,
                'certificates'    => $certData,
            ];
        }

        return response()->json([
            'status'  => '200',
            'message' => 'Record listed',
            'data'    => $data
        ], 201);
    }

    public function eventSouvenir($eventId = "") 
    {
        // fetch registrations for the authenticated user
        $query = EventRegistration::where('user_id', auth()->user()->id);

        // if an encrypted registration id was provided, apply filter
        if ($eventId) {
            $query->where('id', decrypt($eventId));
        }

        $registrations = $query->get();
        $data = [];

        foreach ($registrations as $dt) {
            // load any certificates tied to this registration
            $souvenir = SouvenirRegistrations::where('event_registration_id', $dt->id)->get();

            $souvData = [];
            foreach ($souvenir as $souv) {
                $souvData[] = [
                    'id'         => encrypt($souv->id),
                    'name'       => $souv->souvenir->name,
                    'image'     => $souv->souvenir->image ? url('/') . '/souvenirs/' . $souv->souvenir->image : null,
                    'is_collected'     => $souv->is_collected,
                    'created_at' => $souv->created_at,
                ];
            }

            $data[] = [
                'registration_id' => encrypt($dt->id),
                'event_id'        => encrypt($dt->form->id),
                'event_name'      => $dt->form->name,
                'souvenir'    => $souvData,
            ];
        }

        return response()->json([
            'status'  => '200',
            'message' => 'Record listed',
            'data'    => $data
        ], 201);
    }

    public function eventClock(Request $request)
    {
        $registrationId = decrypt($request->id);
        $state = $request->state;
        $registration = EventRegistration::find($registrationId);

        if (!$registration) {
            return response()->json(['status' => '404', 'message' => 'Registration not found'], 404);
        }

        $form = $registration->form;
        if (!$form) {
            return response()->json(['status' => '404', 'message' => 'Event form not found'], 404);
        }

        // Time Validation
        $now = now();
        $start = Carbon::parse($form->started_at);
        $end = Carbon::parse($form->ended_at);

        if ($now->lt($start) || $now->gt($end)) {
            return response()->json(['status' => '400', 'message' => 'Event is not active at this time'], 400);
        }

        // Location Validation
        if ($form->latitude && $form->longitude) {
            $userLat = $request->latitude;
            $userLon = $request->longitude;

            // if (!$userLat || !$userLon) {
            //     $locationData = Location::get($request->ip());
            //     // return response()->json(['status' => '400', 'message' => $request->ip()], 400);
            //     if ($locationData) {
            //         $userLat = $locationData->latitude;
            //         $userLon = $locationData->longitude;

            //         return response()->json(['status' => '400', 'message' => ['latitude' => $userLat, 'longitude' => $userLon]], 400);
            //     }
            // }

            if (!$userLat || !$userLon) {
                return response()->json(['status' => '400', 'message' => 'Location data required'], 400);
            }

            $distance = $this->calculateDistance(
                $userLat,
                $userLon,
                $form->latitude,
                $form->longitude
            );

            if ($distance > 500) { // 500 meters
                return response()->json(['status' => '400', 'message' => 'You are too far from the event location'], 400);
            }
        }

        $attendance = EventRegistrationsAttendances::firstOrNew([
            'user_id' => auth()->user()->id,
            'form_id' => $registration->id // Storing EventRegistration ID here as requested
        ]);

        if ($state === 'in') {
            $attendance->clockin = $now->toDateTimeString();
        } elseif ($state === 'out') {
            $attendance->clockout = $now->toDateTimeString();
        }

        $attendance->latitude = $request->latitude;
        $attendance->longitude = $request->longitude;
        $attendance->location = $request->location;
        $attendance->timezone = $request->timezone ?? 'UTC';
        $attendance->save();

        return response()->json([
            'status' => '200',
            'message' => 'Successfully clocked ' . $state,
            'data' => $attendance
        ], 200);
    }

    private function calculateDistance($lat1, $lon1, $lat2, $lon2)
    {
        $earthRadius = 6371000; // meters

        $lat1 = deg2rad($lat1);
        $lon1 = deg2rad($lon1);
        $lat2 = deg2rad($lat2);
        $lon2 = deg2rad($lon2);

        $latDelta = $lat2 - $lat1;
        $lonDelta = $lon2 - $lon1;

        $angle = 2 * asin(sqrt(pow(sin($latDelta / 2), 2) +
            cos($lat1) * cos($lat2) * pow(sin($lonDelta / 2), 2)));

        return $angle * $earthRadius;
    }

    public function programAttendance()
    {
        // $datas = Program::where('status', 'active')->whereDate('started_at', '>=', now()->startOfDay())
        //     ->whereDate('started_at', '<=', now()->addDays(2)->endOfDay())
        //     ->get();
        $datas = Program::where('status', 'active')->get();
        $user = class_basename(auth()->user());
        $data = [];
        foreach ($datas as $dt) {
            $data[] = [
                "id" => encryptHelper($dt->id),
                "qr_code_link" => url('/') . '/program/attendance/' . encrypt($dt->id) . '/' . encrypt(auth()->user()->id) . '/' . encrypt($user),
                "title" => $dt->label,
                "description" => $dt->description,
                "started_at" => $dt->started_at
            ];
        }

        return response()->json(
            [
                'status' => '200',
                'message' => 'Record listed',
                'data' => $data
            ],
            201
        );
    }
}
