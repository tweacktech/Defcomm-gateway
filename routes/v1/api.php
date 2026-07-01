<?php

use App\Http\Controllers\API\AdminController;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\QrLoginController;
use App\Http\Controllers\API\SuperAdminController;
use App\Http\Controllers\API\UserController;
use App\Http\Controllers\API\WalkieTalkieController;
use App\Http\Controllers\API\WebController;
use App\Http\Controllers\BountyController;
use App\Http\Controllers\GoogleAiTransController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::middleware(['api.client.protection', 'auth:sanctum'])->get('/user', function (Request $request) {
    return $request->user();
});

Broadcast::routes(['middleware' => ['api.client.protection', 'auth:sanctum']]);

Route::middleware('api.client.protection')->group(function () {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('emailVerify', [AuthController::class, 'emailVerify']);
    Route::post('userVerify', [AuthController::class, 'userVerify']);
    Route::post('login', [AuthController::class, 'login']);
    Route::post('requestOtpSms', [AuthController::class, 'requestOtpSms']);
    Route::post('loginWithPhone', [AuthController::class, 'loginWithPhone']);
    Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('reset-password', [AuthController::class, 'resetPassword']);
    Route::post('email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])->name('verification.verify');

    Route::post('app/authenticate', [AuthController::class, 'appAuthenticate']);
    Route::get('app/language', [AuthController::class, 'appLanguage']);
    Route::get('app/agreements/{term?}', [AuthController::class, 'appAgreements']);
    Route::get('/app/list', [UserController::class, 'appList']);
    Route::get('/app/listId/{id}', [UserController::class, 'appListId']);
});

// QR Login
Route::post('/qr/create', [QrLoginController::class, 'create']);           // anonymous
Route::get('/qr/{code}/status', [QrLoginController::class, 'status']);     // anonymous poll
Route::post('/qr/{code}/exchange', [QrLoginController::class, 'exchange']); // desktop exchanges

Route::prefix('web')->group(function () {
    Route::post('/contact', [WebController::class, 'contact']); // submit form
    Route::post('/booking', [WebController::class, 'booking']); // submit form
    Route::post('/eventform', [WebController::class, 'eventform']); // submit form

    // Route::get('/', [WebController::class, 'index']); // list all
    // Route::get('/{id}', [WebController::class, 'show']); // single
    // Route::delete('/{id}', [WebController::class, 'destroy']); // delete
});

Route::get('/user/getmeeting/{id}', [UserController::class, 'getmeetingDetail']);

Route::middleware(['api.client.protection', 'auth:sanctum'])->group(function () {
    Route::post('/qr/{code}/approve', [QrLoginController::class, 'approve']); // mobile approves

    Route::post('app/resetPassword', [AuthController::class, 'appresetPassword']);
    Route::post('app/configuration', [AuthController::class, 'appConfiguration']);
    Route::post('app/developermode', [AuthController::class, 'appDevelopermode']);

    Route::get('auth/userplan', [AuthController::class, 'userplan']);
    Route::get('auth/logindevicelog', [AuthController::class, 'logindevicelog']);
    Route::get('auth/logindevice/{status}', [AuthController::class, 'logindevice']);
    Route::get('auth/logindevicestatus/{id}/{status}', [AuthController::class, 'logindevicestatus']);
    Route::post('auth/loginblockip', [AuthController::class, 'loginblockip']);
    Route::get('auth/loginblockip/list', [AuthController::class, 'loginblockipList']);
    Route::post('auth/loginunblockip', [AuthController::class, 'loginunblockip']);
    Route::post('auth/updateHeartBeat', [AuthController::class, 'updateHeartBeat']);
    Route::get('auth/heartBeat', [AuthController::class, 'heartBeat']);
    Route::post('auth/logout', [AuthController::class, 'logout']);

    Route::get('/user/file', [UserController::class, 'file']);
    Route::get('/user/file/pending', [UserController::class, 'fileOtherPending']);
    Route::get('/user/file/other', [UserController::class, 'fileOther']);
    Route::get('/user/file/request', [UserController::class, 'fileRequest']);
    Route::post('/user/file/upload', [UserController::class, 'fileUpload']);
    Route::post('/user/file/share', [UserController::class, 'fileShare']);
    Route::get('/user/file/{id}/download', [UserController::class, 'fileDownload']);
    Route::get('/user/file/{id}/view', [UserController::class, 'fileView']);
    Route::get('/user/file/{id}/url', [UserController::class, 'fileViewUrl']);
    Route::get('/user/file/{id}/accept', [UserController::class, 'fileAccept']);
    Route::get('/user/file/{id}/decline', [UserController::class, 'fileDecline']);
    Route::get('/user/group', [UserController::class, 'group']);
    Route::get('/user/group/pending', [UserController::class, 'groupPendig']);
    Route::get('/user/group/{id}/accept', [UserController::class, 'groupAccept']);
    Route::get('/user/group/{id}/decline', [UserController::class, 'groupDecline']);
    Route::get('/user/profile', [UserController::class, 'profile']);
    Route::post('/user/profile/upload', [UserController::class, 'profileUpload']);

    Route::get('/user/group/member/{id}', [UserController::class, 'groupMember']);
    Route::get('/user/contact', [UserController::class, 'contact']);
    Route::get('/user/contact/add/{id}', [UserController::class, 'contactAdd']);
    Route::get('/user/contact/remove/{id}', [UserController::class, 'contactRemove']);

    Route::get('/user/chat/callLog', [UserController::class, 'chatCallLog']);
    Route::get('/user/chat/history', [UserController::class, 'chatHistory']);
    Route::get('/user/chat/lastMessage', [UserController::class, 'lastMessage']);
    Route::get('/user/chat/messages/{chat_user_id}/{user_group}', [UserController::class, 'chatMessages']);
    Route::post('/user/chat/messages/send', [UserController::class, 'sendMessage']);
    Route::post('/user/chat/messages/call', [UserController::class, 'sendMessageCall']);
    Route::post('/user/messages/{type}', [UserController::class, 'messagesTyping']);
    Route::get('/user/messages/important/{id}', [UserController::class, 'messagesImportant']);
    Route::get('/user/messages/isread/{id}', [UserController::class, 'messagesIsread']);

    Route::get('/user/meetingTokenGen', [UserController::class, 'meetingTokenGen']);
    Route::post('/user/meeting/create', [UserController::class, 'meetingCreate']);
    Route::post('/user/meeting/update', [UserController::class, 'meetingUpdate']);
    Route::get('/user/getmeeting', [UserController::class, 'getmeeting']);
    // Route::get('/user/getmeeting/{id}', [UserController::class, 'getmeetingDetail']);
    Route::get('/user/getmeetingid/{id}/{type}', [UserController::class, 'getmeetingid']);
    Route::post('/user/meetingInvitation', [UserController::class, 'meetingInvitation']);
    Route::post('/user/meetingInvitationGroup', [UserController::class, 'meetingInvitationGroup']);
    Route::get('/user/meetingInvitationJoin/{id}', [UserController::class, 'meetingInvitationJoin']);
    Route::get('/user/meetingInvitationlist/{status?}', [UserController::class, 'meetingInvitationlist']);
    Route::get('/user/meetingParticipantlist/{id}/{status}', [UserController::class, 'meetingParticipantlist']);

    Route::post('/user/folder/create', [UserController::class, 'folderCreate']);
    Route::post('/user/folderUpdate', [UserController::class, 'folderUpdate']);
    Route::get('/user/folder/', [UserController::class, 'folderget']);
    Route::get('/user/folder/{id}', [UserController::class, 'foldergetId']);
    Route::get('/user/folderDel/{id}', [UserController::class, 'folderdelete']);
    Route::post('/user/folderFile', [UserController::class, 'folderFile']);

    Route::post('/user/setting', [UserController::class, 'setting']);
    Route::get('/user/getsetting', [UserController::class, 'getsetting']);
    Route::get('/user/languagecode', [UserController::class, 'languagecode']);

    Route::get('/user/notification', [UserController::class, 'notification']);

    Route::post('/app/create', [UserController::class, 'appcreate']);
    Route::post('/app/status', [UserController::class, 'appstatus']);
    Route::get('/app/ownlist', [UserController::class, 'appOwnList']);
    Route::post('/app/audio/player/delete', [UserController::class, 'deleteTemporaryAudio']);

    Route::post('/walkietalkie/channelcreate', [WalkieTalkieController::class, 'channelcreate']);
    Route::post('/walkietalkie/channelupdate', [WalkieTalkieController::class, 'channelupdate']);
    Route::get('/walkietalkie/channecreatellist', [WalkieTalkieController::class, 'channecreatellist']);
    Route::get('/walkietalkie/channedelete/{id}', [WalkieTalkieController::class, 'channedelete']);
    Route::post('/walkietalkie/channelinvite', [WalkieTalkieController::class, 'channelinvite']);
    Route::get('/walkietalkie/channellistinvited/{status}', [WalkieTalkieController::class, 'channellistinvited']);
    Route::post('/walkietalkie/channelinvitedstatus', [WalkieTalkieController::class, 'channelinvitedstatus']);
    Route::post('/walkietalkie/channelbroadcast', [WalkieTalkieController::class, 'channelbroadcast']);
    Route::post('/walkietalkie/channelisbroadcasting', [WalkieTalkieController::class, 'channelisbroadcasting']);
    Route::get('/walkietalkie/channelbroadcastlist/{id}', [WalkieTalkieController::class, 'channelbroadcastlist']);
    Route::get('/walkietalkie/channelbroadcastdel/{id}', [WalkieTalkieController::class, 'channelbroadcastdel']);
    Route::post('/walkietalkie/subscriberJoin', [WalkieTalkieController::class, 'subscriberJoin']);
    Route::post('/walkietalkie/subscriberLeave', [WalkieTalkieController::class, 'subscriberLeave']);
    Route::get('/walkietalkie/subscriberActive/{id}', [WalkieTalkieController::class, 'subscriberActive']);

    Route::post('/trans/speech-to-text', [GoogleAiTransController::class, 'speechToSpeech']);
    Route::post('/trans/text-to-speech', [GoogleAiTransController::class, 'textToSpeech']);
    Route::post('/trans/translate-text', [GoogleAiTransController::class, 'translateText']);
    Route::post('/trans/speech-to-speech', [GoogleAiTransController::class, 'speechToSpeech']);

    Route::get('/user/event/register', [UserController::class, 'eventRegister']);
    Route::get('/user/event/certificate', [UserController::class, 'eventCertificate']);
    Route::get('/user/event/souvenir', [UserController::class, 'eventSouvenir']);
    Route::post('/user/event/clock', [UserController::class, 'eventClock']);

    Route::get('program/attendance', [UserController::class, 'programAttendance']);
});

Route::post('/bounty/register', [BountyController::class, 'register']);
Route::post('/bounty/verify', [BountyController::class, 'verify']);
Route::post('/bounty/requestOtp', [BountyController::class, 'requestOtp']);
Route::post('/bounty/login', [BountyController::class, 'login']);
Route::post('/bounty/loginVerify', [BountyController::class, 'loginVerify']);
Route::post('/bounty/forgot-password', [BountyController::class, 'forgotPassword']);
Route::post('/bounty/reset-password', [BountyController::class, 'resetPassword']);
Route::get('/bounty/leaderboard', [BountyController::class, 'leaderboard']);

Route::middleware(['api.client.protection', 'auth:sanctum'])->group(function () {
    Route::post('/bounty/createUser', [BountyController::class, 'createUser']);
    Route::get('/bounty/getUser', [BountyController::class, 'getUser']);
    Route::get('/bounty/user/report/{userId}', [BountyController::class, 'reportLogUser']);
    Route::get('/bounty/user/leaderboard', [BountyController::class, 'leaderboard']);

    Route::get('/bounty/profile', [BountyController::class, 'profile']);
    Route::post('/bounty/profile', [BountyController::class, 'profile']);
    Route::post('/bounty/logout', [BountyController::class, 'logout']);

    Route::get('/bounty/program', [BountyController::class, 'program']);
    Route::get('/bounty/category', [BountyController::class, 'category']);
    Route::post('/bounty/report', [BountyController::class, 'report']);
    Route::post('/bounty/reportUpdate', [BountyController::class, 'reportUpdate']);
    Route::get('/bounty/reportlog', [BountyController::class, 'reportLog']);
    Route::get('/bounty/reportInfo', [BountyController::class, 'reportInfo']);
});

Route::middleware(['api.client.protection', 'auth:sanctum'])->group(function () {
    Route::get('/super/dashboard', [SuperAdminController::class, 'dashboard'])->name('api.super.dashboard');
    Route::get('/super/account/{user}', [SuperAdminController::class, 'account'])->name('api.super.account');
    Route::post('/super/accountCreate', [SuperAdminController::class, 'accountCreate'])->name('api.super.accountCreate');
    Route::post('/super/accountEdit', [SuperAdminController::class, 'accountEdit'])->name('api.super.accountEdit');
    Route::get('/super/accountView/{id}', [SuperAdminController::class, 'accountView'])->name('api.super.accountView');
    Route::get('/super/accessLog/{id}', [SuperAdminController::class, 'accessLog'])->name('api.super.accessLog');
    Route::get('/super/accountDelete/{id}', [SuperAdminController::class, 'accountDelete'])->name('api.super.accountDelete');
    Route::get('/super/accountToken', [SuperAdminController::class, 'accountToken'])->name('api.super.accountToken');

    Route::get('/super/systemMail', [SuperAdminController::class, 'systemMail'])->name('api.super.systemMail');
    Route::post('/super/systemMailUpdate', [SuperAdminController::class, 'systemMailUpdate'])->name('api.super.systemMailUpdate');

    Route::get('/super/language', [SuperAdminController::class, 'language'])->name('api.super.language');
    Route::post('/super/languageCreate', [SuperAdminController::class, 'languageCreate'])->name('api.super.languageCreate');
    Route::post('/super/languageEdit', [SuperAdminController::class, 'languageEdit'])->name('api.super.languageEdit');

    Route::get('/super/agreements', [SuperAdminController::class, 'agreements'])->name('api.super.agreements');
    Route::post('/super/agreementsCreate', [SuperAdminController::class, 'agreementsCreate'])->name('api.super.agreementsCreate');
    Route::post('/super/agreementsEdit', [SuperAdminController::class, 'agreementsEdit'])->name('api.super.agreementsEdit');

    Route::get('/super/notification', [SuperAdminController::class, 'notification'])->name('api.super.notification');
    Route::post('/super/notification/create', [SuperAdminController::class, 'notificationCreate'])->name('api.super.notification.create');
    Route::get('/super/notification/delete/{id}', [SuperAdminController::class, 'notificationDelete'])->name('api.super.notification.delete');
    Route::post('/super/notification/edit', [SuperAdminController::class, 'notificationEdit'])->name('api.super.notification.edit');

    Route::get('/super/store/user', [SuperAdminController::class, 'storeUser'])->name('api.super.store.user');
    Route::get('/super/store/user/{id}', [SuperAdminController::class, 'storeUserDetail'])->name('api.super.store.user.detail');
    Route::post('/super/store/user/detailSub', [SuperAdminController::class, 'storeuserdetailSub'])->name('api.super.store.user.detailSub');
    Route::get('/super/store/app/{id?}', [SuperAdminController::class, 'storeApp'])->name('api.super.store.app');
    Route::get('/super/store/app/detail/{id}', [SuperAdminController::class, 'storeappdetail'])->name('api.super.store.appt.detail');
    Route::post('/super/store/app/detailSub', [SuperAdminController::class, 'storeappdetailSub'])->name('api.super.store.app.detailSub');
    Route::get('/super/web/contact', [SuperAdminController::class, 'webContact'])->name('api.super.web.contact');
    Route::get('/super/web/booking', [SuperAdminController::class, 'webBooking'])->name('api.super.web.booking');
    Route::get('/super/plan', [SuperAdminController::class, 'plan'])->name('api.super.plan');
    Route::post('/super/planAdd', [SuperAdminController::class, 'planAdd'])->name('api.super.planAdd');
    Route::post('/super/planEdit', [SuperAdminController::class, 'planEdit'])->name('api.super.planEdit');

    Route::get('/super/bounty/user/{type?}', [SuperAdminController::class, 'bountyUser'])->name('api.super.bountyUser');
    Route::get('/super/bounty/userId/{id}', [SuperAdminController::class, 'bountyUserId'])->name('api.super.bountyUserId');
    Route::get('/super/bounty/program', [SuperAdminController::class, 'bountyProgram'])->name('api.super.bountyProgram');
    Route::post('/super/bounty/program/add', [SuperAdminController::class, 'bountyProgramAdd'])->name('api.super.bountyProgramAdd');
    Route::post('/super/bounty/program/update', [SuperAdminController::class, 'bountyProgramUpdate'])->name('api.super.bountyProgramUpdate');
    Route::post('/super/bountyuser/active', [SuperAdminController::class, 'bountyUserActive'])->name('api.super.bountyUser.active');
    Route::post('/super/bountyuser/block', [SuperAdminController::class, 'bountyUserBlock'])->name('api.super.bountyUser.block');
    Route::get('/super/bounty/category', [SuperAdminController::class, 'bountyCategory'])->name('api.super.bountyCategory');
    Route::post('/super/bounty/category/add', [SuperAdminController::class, 'bountyCategoryAdd'])->name('api.super.bountyCategoryAdd');
    Route::post('/super/bounty/category/update', [SuperAdminController::class, 'bountyCategoryUpdate'])->name('api.super.bountyCategoryUpdate');
    Route::get('/super/bounty/subCategory/{id}', [SuperAdminController::class, 'bountySubCategory'])->name('api.super.bountySubCategory');
    Route::post('/super/bounty/subCategory/add', [SuperAdminController::class, 'bountySubCategoryAdd'])->name('api.super.bountySubCategoryAdd');
    Route::post('/super/bounty/subCategory/update', [SuperAdminController::class, 'bountySubCategoryUpdate'])->name('api.super.bountySubCategoryUpdate');
    Route::get('/super/bounty/report/{severity?}/{category?}/{sub?}', [SuperAdminController::class, 'bountyReport'])->name('api.super.bountyReport');
    Route::get('/super/bounty/reportView/{id}', [SuperAdminController::class, 'bountyReportView'])->name('api.super.bountyReportView');
    Route::post('/super/bounty/reportApproval', [SuperAdminController::class, 'reportApproval'])->name('api.super.reportApproval');
    Route::get('/super/bounty/reportMarkFix/{id}', [SuperAdminController::class, 'reportMarkFix'])->name('api.super.reportMarkFix');

    Route::get('/super/program', [SuperAdminController::class, 'program'])->name('api.super.program');
    Route::post('/super/program/add', [SuperAdminController::class, 'programAdd'])->name('api.super.programAdd');
    Route::post('/super/program/update', [SuperAdminController::class, 'programUpdate'])->name('api.super.programUpdate');
    Route::get('/super/attendance/{id}', [SuperAdminController::class, 'attendance'])->name('api.super.attendance');
    Route::get('/program/attendance/{id}/{userId}/{userType}', [SuperAdminController::class, 'attendanceUser'])->name('api.super.attendanceUser');
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/admin/dashboard', [AdminController::class, 'dashboard'])->name('api.admin.dashboard');

    Route::get('/admin/notification', [AdminController::class, 'notification'])->name('api.admin.notification');
    Route::post('/admin/notification/create', [AdminController::class, 'notificationCreate'])->name('api.admin.notification.create');
    Route::get('/admin/notification/delete/{id}', [AdminController::class, 'notificationDelete'])->name('api.admin.notification.delete');
    Route::post('/admin/notification/edit', [AdminController::class, 'notificationEdit'])->name('api.admin.notification.edit');

    Route::get('/admin/account', [AdminController::class, 'account'])->name('api.admin.account');
    Route::get('/admin/account/{id}/{status}', [AdminController::class, 'accountStatus'])->name('api.admin.account.status');
    Route::post('/admin/account/create', [AdminController::class, 'accountCreate'])->name('api.admin.account.create');
    Route::post('/admin/account/block', [AdminController::class, 'accountBlock'])->name('api.admin.account.block');

    Route::get('/admin/group', [AdminController::class, 'group'])->name('api.admin.group');
    Route::post('/admin/group/create', [AdminController::class, 'groupCreate'])->name('api.admin.group.create');
    Route::post('/admin/group/update', [AdminController::class, 'groupUpdate'])->name('api.admin.group.update');
    Route::get('/admin/group/member/{id}', [AdminController::class, 'member'])->name('api.admin.member');
    Route::get('/admin/group/member/{id}/add', [AdminController::class, 'memberAdd'])->name('api.admin.member.add');
    Route::post('/admin/group/member/remove', [AdminController::class, 'memberRemove'])->name('api.admin.member.remove');
    Route::post('/admin/group/member/add', [AdminController::class, 'memberGroupAdd'])->name('api.admin.member.group.add');

    Route::get('/admin/meeting', [AdminController::class, 'meeting'])->name('api.admin.meeting');
    Route::post('/admin/meeting/create', [AdminController::class, 'meetingCreate'])->name('api.admin.meeting.create');

    Route::get('/admin/form/{status?}', [AdminController::class, 'form'])->name('api.admin.form');
    Route::get('/admin/form/application/{id}', [AdminController::class, 'formApplication'])->name('api.admin.form.application');
    Route::get('/admin/form/attendance/{id}', [AdminController::class, 'formAttendance'])->name('api.admin.form.attendance');
    Route::post('/admin/form/create', [AdminController::class, 'formCreate'])->name('api.admin.form.create');
    Route::post('/admin/form/update', [AdminController::class, 'formUpdate'])->name('api.admin.form.update');
    Route::get('/admin/form/attendance/{id}/{userId}', [AdminController::class, 'attendanceUser'])->name('api.admin.attendanceUser');
    Route::post('/admin/form/mail', [AdminController::class, 'formMail'])->name('api.admin.form.mail');

    // Certificate Management
    Route::get('/admin/form/certificate/{id}', [AdminController::class, 'certificateList'])->name('api.admin.form.certificate');
    Route::post('/admin/form/certificate/create', [AdminController::class, 'certificateCreate'])->name('api.admin.form.certificate.create');
    Route::post('/admin/form/certificate/update', [AdminController::class, 'certificateUpdate'])->name('api.admin.form.certificate.update');
    Route::get('/admin/form/certificate/delete/{id}', [AdminController::class, 'certificateDelete'])->name('api.admin.form.certificate.delete');
    Route::get('/admin/form/certificate/applicants/{id}', [AdminController::class, 'certificateApplicants'])->name('api.admin.form.certificate.applicants');
    Route::post('/admin/form/certificate/applicants/collect', [AdminController::class, 'certificateCollect'])->name('api.admin.form.certificate.collect');
    Route::post('/admin/form/certificate/mail', [AdminController::class, 'certificateMail'])->name('api.admin.form.certificate.mail');

    // Souvenir Management
    Route::get('/admin/form/souvenir/{id}', [AdminController::class, 'souvenirList'])->name('api.admin.form.souvenir');
    Route::post('/admin/form/souvenir/create', [AdminController::class, 'souvenirCreate'])->name('api.admin.form.souvenir.create');
    Route::post('/admin/form/souvenir/update', [AdminController::class, 'souvenirUpdate'])->name('api.admin.form.souvenir.update');
    Route::get('/admin/form/souvenir/delete/{id}', [AdminController::class, 'souvenirDelete'])->name('api.admin.form.souvenir.delete');
    Route::get('/admin/form/souvenir/applicants/{id}', [AdminController::class, 'souvenirApplicants'])->name('api.admin.form.souvenir.applicants');
    Route::post('/admin/form/souvenir/applicants/collect', [AdminController::class, 'souvenirCollect'])->name('api.admin.form.souvenir.collect');

    Route::get('/admin/file', [AdminController::class, 'file'])->name('api.admin.file');
    Route::get('/admin/file/user', [AdminController::class, 'fileUser'])->name('api.admin.file.user');
    Route::get('/admin/file/request', [AdminController::class, 'fileRequest'])->name('api.admin.file.request');
    Route::get('/admin/file/view/{id}', [AdminController::class, 'fileView'])->name('api.admin.file.view');
    Route::get('/admin/file/download/{id}', [AdminController::class, 'fileDownload'])->name('api.admin.file.download');
    Route::post('/admin/file/upload', [AdminController::class, 'fileUpload'])->name('api.admin.file.upload');
    Route::get('/admin/file/share/group/{id}', [AdminController::class, 'fileShareGroup'])->name('api.admin.file.share.group');
    Route::post('/admin/file/share/group/add', [AdminController::class, 'fileShareGroupAdd'])->name('api.admin.file.share.group.add');
    Route::get('/admin/file/share/user/{id}', [AdminController::class, 'fileShareUser'])->name('api.admin.file.share.user');
    Route::post('/admin/file/share/user/add', [AdminController::class, 'fileShareUserAdd'])->name('api.admin.file.share.user.add');
    Route::get('/admin/file/access/group/{id}', [AdminController::class, 'fileAccessGroup'])->name('api.admin.file.access.group');
    Route::get('/admin/file/access/user/{id}', [AdminController::class, 'fileAccessUser'])->name('api.admin.file.access.user');
    Route::get('/admin/file/access/{id}/revoke', [AdminController::class, 'fileAccessRevoke'])->name('api.admin.file.access.revoke');
    Route::get('/admin/file/access/{id}/log', [AdminController::class, 'fileAccessLog'])->name('api.admin.file.access.log');
    Route::get('/admin/file/{id}/accept', [AdminController::class, 'fileAccept'])->name('api.admin.file.accept');
    Route::get('/admin/file/{id}/decline', [AdminController::class, 'fileDecline'])->name('api.admin.file.decline');
    Route::get('/admin/profile', [AdminController::class, 'profile'])->name('api.admin.profile');
    Route::post('/admin/profile/upload', [AdminController::class, 'profileUpload'])->name('api.admin.profile.upload');
});

Route::get('ip-checker', function (Request $request) {
    return response()->json([
        'ip' => $request->ip(),
        'server_ip' => $_SERVER['SERVER_ADDR'] ?? null,
    ]);
});
