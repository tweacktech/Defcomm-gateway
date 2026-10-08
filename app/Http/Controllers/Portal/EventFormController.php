<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Models\CertificateRegistration;
use App\Models\EventAttendance;
use App\Models\EventForm;
use App\Models\EventRegistration;
use App\Models\MeetRoom;
use App\Models\Organization;
use App\Models\OrganizationGroup;
use App\Models\Souvenir;
use App\Models\SouvenirRegistration;
use App\Models\User;
use App\Traits\LogsActivity;
use App\Traits\ResolvesOrganization;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class EventFormController extends Controller
{
    use LogsActivity;
    use ResolvesOrganization;

    public function index(Request $request): Response
    {
        $org = $this->resolveOrganization($request);

        $forms = EventForm::query()
            ->where('organization_id', $org->id)
            ->with(['group:id,name', 'meetRoom:id,name'])
            ->withCount('registrations')
            ->latest()
            ->get()
            ->map(fn (EventForm $f) => $f->payload());

        return Inertia::render('portal/company/forms', [
            'organization' => ['id' => $org->id, 'name' => $org->name],
            'forms' => $forms,
            'groups' => OrganizationGroup::query()
                ->where('organization_id', $org->id)
                ->orderBy('name')
                ->get(['id', 'name']),
            'meetings' => $this->orgMeetings($org),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $org = $this->resolveOrganization($request);
        $data = $this->validatedForm($request, $org);

        $form = EventForm::create([
            ...$data,
            'organization_id' => $org->id,
            'created_by' => $request->user()->id,
            'is_active' => ($data['status'] ?? 'active') === 'active',
        ]);

        $this->log('created', "Created form {$form->title}", 'forms', $form, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', 'Event form created.');
    }

    public function update(Request $request, EventForm $form): RedirectResponse
    {
        $org = $this->assertFormOrg($request, $form);
        $data = $this->validatedForm($request, $org);

        $form->update([
            ...$data,
            'is_active' => ($data['status'] ?? 'active') === 'active',
        ]);

        $this->log('updated', "Updated form {$form->title}", 'forms', $form, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', 'Event form updated.');
    }

    public function destroy(Request $request, EventForm $form): RedirectResponse
    {
        $org = $this->assertFormOrg($request, $form);
        $title = $form->title;
        $form->delete();

        $this->log('deleted', "Deleted form {$title}", 'forms', null, [
            'organization_id' => $org->id,
        ]);

        return redirect()->route('company.forms', $this->orgQuery($request, $org))
            ->with('success', 'Event form deleted.');
    }

    public function applications(Request $request, EventForm $form): Response
    {
        $org = $this->assertFormOrg($request, $form);

        $registrations = EventRegistration::query()
            ->with('user:id,name,email,phone,organization_id')
            ->where('event_form_id', $form->id)
            ->latest()
            ->get()
            ->map(fn (EventRegistration $r) => [
                'id' => $r->id,
                'user_id' => $r->user_id,
                'name' => $r->name ?: $r->user?->name,
                'email' => $r->email ?: $r->user?->email,
                'phone' => $r->phone ?: $r->user?->phone,
                'status' => $r->status,
                'data' => $r->data,
                'created_at' => $r->created_at?->toIso8601String(),
            ]);

        return Inertia::render('portal/company/form-applications', [
            'organization' => ['id' => $org->id, 'name' => $org->name],
            'form' => $form->payload(),
            'registrations' => $registrations,
            'counts' => [
                'applications' => $registrations->count(),
                'attendance' => EventAttendance::query()->where('event_form_id', $form->id)->count(),
                'certificates' => Certificate::query()->where('event_form_id', $form->id)->count(),
                'souvenirs' => Souvenir::query()->where('event_form_id', $form->id)->count(),
            ],
        ]);
    }

    public function mailApplicants(Request $request, EventForm $form): RedirectResponse
    {
        $org = $this->assertFormOrg($request, $form);
        $data = $request->validate([
            'registration_ids' => ['required', 'array', 'min:1'],
            'registration_ids.*' => ['integer'],
            'subject' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string'],
        ]);

        $regs = EventRegistration::query()
            ->where('event_form_id', $form->id)
            ->whereIn('id', $data['registration_ids'])
            ->get();

        foreach ($regs as $reg) {
            $email = $reg->email ?: $reg->user?->email;
            if (! $email) {
                continue;
            }
            Mail::html(
                nl2br(e($data['message'])),
                fn ($message) => $message->to($email)->subject($data['subject'])
            );
        }

        $this->log('updated', "Mailed {$regs->count()} applicants for {$form->title}", 'forms', $form, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', "Mail sent to {$regs->count()} applicant(s).");
    }

    public function attendance(Request $request, EventForm $form): Response
    {
        $org = $this->assertFormOrg($request, $form);

        $rows = EventAttendance::query()
            ->with('user:id,name,email')
            ->where('event_form_id', $form->id)
            ->latest()
            ->get()
            ->map(fn (EventAttendance $a) => [
                'id' => $a->id,
                'user_id' => $a->user_id,
                'name' => $a->user?->name,
                'email' => $a->user?->email,
                'comment' => $a->comment,
                'location' => $a->location,
                'clock_in_at' => $a->clock_in_at?->toIso8601String(),
                'clock_out_at' => $a->clock_out_at?->toIso8601String(),
                'latitude' => $a->latitude,
                'longitude' => $a->longitude,
                'created_at' => $a->created_at?->toIso8601String(),
            ]);

        $registrants = EventRegistration::query()
            ->with('user:id,name,email')
            ->where('event_form_id', $form->id)
            ->get()
            ->map(fn (EventRegistration $r) => [
                'user_id' => $r->user_id,
                'name' => $r->name ?: $r->user?->name,
                'email' => $r->email ?: $r->user?->email,
            ]);

        return Inertia::render('portal/company/form-attendance', [
            'organization' => ['id' => $org->id, 'name' => $org->name],
            'form' => $form->payload(),
            'attendance' => $rows,
            'registrants' => $registrants,
        ]);
    }

    public function markAttendance(Request $request, EventForm $form): RedirectResponse
    {
        $org = $this->assertFormOrg($request, $form);
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'comment' => ['nullable', 'string', 'max:255'],
        ]);

        $user = User::query()->findOrFail($data['user_id']);
        abort_unless((int) $user->organization_id === (int) $org->id, 403);

        EventAttendance::updateOrCreate(
            [
                'event_form_id' => $form->id,
                'user_id' => $user->id,
            ],
            [
                'clock_in_at' => now(),
                'comment' => $data['comment'] ?: 'Checked by '.$request->user()->name,
                'location' => $form->location,
                'latitude' => $form->latitude,
                'longitude' => $form->longitude,
                'timezone' => $form->timezone,
            ]
        );

        $this->log('updated', "Marked attendance for {$user->email} on {$form->title}", 'forms', $form, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', "Attendance marked for {$user->name}.");
    }

    public function certificates(Request $request, EventForm $form): Response
    {
        $org = $this->assertFormOrg($request, $form);

        $certs = Certificate::query()
            ->where('event_form_id', $form->id)
            ->withCount('registrationLinks')
            ->latest()
            ->get()
            ->map(fn (Certificate $c) => [
                'id' => $c->id,
                'title' => $c->title,
                'status' => $c->status ?: 'active',
                'template_url' => $c->templateUrl(),
                'applicants_count' => (int) $c->registration_links_count,
            ]);

        return Inertia::render('portal/company/form-certificates', [
            'organization' => ['id' => $org->id, 'name' => $org->name],
            'form' => $form->payload(),
            'certificates' => $certs,
        ]);
    }

    public function storeCertificate(Request $request, EventForm $form): RedirectResponse
    {
        $org = $this->assertFormOrg($request, $form);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'status' => ['required', Rule::in(['active', 'disabled'])],
            'template' => ['nullable', 'image', 'max:5120'],
        ]);

        $path = null;
        if ($request->hasFile('template')) {
            $path = $request->file('template')->store('certificates', 'public');
        }

        Certificate::create([
            'event_form_id' => $form->id,
            'title' => $data['title'],
            'status' => $data['status'],
            'template' => $path,
            'file_path' => $path,
        ]);

        $this->log('created', "Created certificate {$data['title']} for {$form->title}", 'forms', $form, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', 'Certificate created.');
    }

    public function updateCertificate(Request $request, EventForm $form, Certificate $certificate): RedirectResponse
    {
        $org = $this->assertFormOrg($request, $form);
        abort_unless((int) $certificate->event_form_id === (int) $form->id, 403);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'status' => ['required', Rule::in(['active', 'disabled'])],
            'template' => ['nullable', 'image', 'max:5120'],
        ]);

        $payload = [
            'title' => $data['title'],
            'status' => $data['status'],
        ];

        if ($request->hasFile('template')) {
            $path = $request->file('template')->store('certificates', 'public');
            $payload['template'] = $path;
            $payload['file_path'] = $path;
        }

        $certificate->update($payload);

        $this->log('updated', "Updated certificate {$certificate->title}", 'forms', $form, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', 'Certificate updated.');
    }

    public function destroyCertificate(Request $request, EventForm $form, Certificate $certificate): RedirectResponse
    {
        $org = $this->assertFormOrg($request, $form);
        abort_unless((int) $certificate->event_form_id === (int) $form->id, 403);
        $certificate->delete();

        $this->log('deleted', "Deleted certificate {$certificate->title}", 'forms', $form, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', 'Certificate deleted.');
    }

    public function certificateApplicants(Request $request, EventForm $form, Certificate $certificate): Response
    {
        $org = $this->assertFormOrg($request, $form);
        abort_unless((int) $certificate->event_form_id === (int) $form->id, 403);

        $links = CertificateRegistration::query()
            ->where('certificate_id', $certificate->id)
            ->get()
            ->keyBy('event_registration_id');

        $applicants = EventRegistration::query()
            ->with('user:id,name,email')
            ->where('event_form_id', $form->id)
            ->latest()
            ->get()
            ->map(fn (EventRegistration $r) => [
                'id' => $r->id,
                'name' => $r->name ?: $r->user?->name,
                'email' => $r->email ?: $r->user?->email,
                'is_collected' => (bool) ($links[$r->id]->is_collected ?? false),
                'is_sent' => (bool) ($links[$r->id]->is_sent ?? false),
            ]);

        return Inertia::render('portal/company/form-certificate-applicants', [
            'organization' => ['id' => $org->id, 'name' => $org->name],
            'form' => $form->payload(),
            'certificate' => [
                'id' => $certificate->id,
                'title' => $certificate->title,
                'template_url' => $certificate->templateUrl(),
            ],
            'applicants' => $applicants,
        ]);
    }

    public function toggleCertificateCollect(Request $request, EventForm $form, Certificate $certificate): RedirectResponse
    {
        $this->assertFormOrg($request, $form);
        abort_unless((int) $certificate->event_form_id === (int) $form->id, 403);

        $data = $request->validate([
            'event_registration_id' => ['required', 'integer'],
            'is_collected' => ['required', 'boolean'],
        ]);

        $reg = EventRegistration::query()
            ->where('event_form_id', $form->id)
            ->where('id', $data['event_registration_id'])
            ->firstOrFail();

        CertificateRegistration::updateOrCreate(
            [
                'certificate_id' => $certificate->id,
                'event_registration_id' => $reg->id,
            ],
            ['is_collected' => $data['is_collected']]
        );

        return back()->with('success', 'Collection status updated.');
    }

    public function mailCertificates(Request $request, EventForm $form, Certificate $certificate): RedirectResponse
    {
        $org = $this->assertFormOrg($request, $form);
        abort_unless((int) $certificate->event_form_id === (int) $form->id, 403);

        $data = $request->validate([
            'registration_ids' => ['required', 'array', 'min:1'],
            'registration_ids.*' => ['integer'],
            'subject' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string'],
        ]);

        $regs = EventRegistration::query()
            ->where('event_form_id', $form->id)
            ->whereIn('id', $data['registration_ids'])
            ->get();

        $sent = 0;
        foreach ($regs as $reg) {
            $email = $reg->email ?: $reg->user?->email;
            if (! $email) {
                continue;
            }

            Mail::html(
                nl2br(e($data['message'])),
                function ($message) use ($email, $data, $certificate) {
                    $message->to($email)->subject($data['subject']);
                    $path = $certificate->template ?: $certificate->file_path;
                    if ($path && Storage::disk('public')->exists($path)) {
                        $message->attach(Storage::disk('public')->path($path));
                    }
                }
            );

            CertificateRegistration::updateOrCreate(
                [
                    'certificate_id' => $certificate->id,
                    'event_registration_id' => $reg->id,
                ],
                ['is_sent' => true]
            );
            $sent++;
        }

        $this->log('updated', "Sent certificate {$certificate->title} to {$sent} applicants", 'forms', $form, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', "Certificate mailed to {$sent} applicant(s).");
    }

    public function souvenirs(Request $request, EventForm $form): Response
    {
        $org = $this->assertFormOrg($request, $form);

        $items = Souvenir::query()
            ->where('event_form_id', $form->id)
            ->withCount('registrationLinks')
            ->latest()
            ->get()
            ->map(fn (Souvenir $s) => [
                'id' => $s->id,
                'title' => $s->title,
                'status' => $s->status ?: 'active',
                'image_url' => $s->imageUrl(),
                'applicants_count' => (int) $s->registration_links_count,
            ]);

        return Inertia::render('portal/company/form-souvenirs', [
            'organization' => ['id' => $org->id, 'name' => $org->name],
            'form' => $form->payload(),
            'souvenirs' => $items,
        ]);
    }

    public function storeSouvenir(Request $request, EventForm $form): RedirectResponse
    {
        $org = $this->assertFormOrg($request, $form);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'status' => ['required', Rule::in(['active', 'disabled', 'pending'])],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        $path = null;
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('souvenirs', 'public');
        }

        Souvenir::create([
            'event_form_id' => $form->id,
            'title' => $data['title'],
            'status' => $data['status'],
            'image' => $path,
        ]);

        $this->log('created', "Created souvenir {$data['title']} for {$form->title}", 'forms', $form, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', 'Souvenir created.');
    }

    public function updateSouvenir(Request $request, EventForm $form, Souvenir $souvenir): RedirectResponse
    {
        $org = $this->assertFormOrg($request, $form);
        abort_unless((int) $souvenir->event_form_id === (int) $form->id, 403);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'status' => ['required', Rule::in(['active', 'disabled', 'pending'])],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        $payload = [
            'title' => $data['title'],
            'status' => $data['status'],
        ];
        if ($request->hasFile('image')) {
            $payload['image'] = $request->file('image')->store('souvenirs', 'public');
        }
        $souvenir->update($payload);

        $this->log('updated', "Updated souvenir {$souvenir->title}", 'forms', $form, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', 'Souvenir updated.');
    }

    public function destroySouvenir(Request $request, EventForm $form, Souvenir $souvenir): RedirectResponse
    {
        $org = $this->assertFormOrg($request, $form);
        abort_unless((int) $souvenir->event_form_id === (int) $form->id, 403);
        $souvenir->delete();

        $this->log('deleted', "Deleted souvenir {$souvenir->title}", 'forms', $form, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', 'Souvenir deleted.');
    }

    public function souvenirApplicants(Request $request, EventForm $form, Souvenir $souvenir): Response
    {
        $org = $this->assertFormOrg($request, $form);
        abort_unless((int) $souvenir->event_form_id === (int) $form->id, 403);

        $links = SouvenirRegistration::query()
            ->where('souvenir_id', $souvenir->id)
            ->get()
            ->keyBy('event_registration_id');

        $applicants = EventRegistration::query()
            ->with('user:id,name,email')
            ->where('event_form_id', $form->id)
            ->latest()
            ->get()
            ->map(fn (EventRegistration $r) => [
                'id' => $r->id,
                'name' => $r->name ?: $r->user?->name,
                'email' => $r->email ?: $r->user?->email,
                'is_collected' => (bool) ($links[$r->id]->is_collected ?? false),
            ]);

        return Inertia::render('portal/company/form-souvenir-applicants', [
            'organization' => ['id' => $org->id, 'name' => $org->name],
            'form' => $form->payload(),
            'souvenir' => [
                'id' => $souvenir->id,
                'title' => $souvenir->title,
                'image_url' => $souvenir->imageUrl(),
            ],
            'applicants' => $applicants,
        ]);
    }

    public function toggleSouvenirCollect(Request $request, EventForm $form, Souvenir $souvenir): RedirectResponse
    {
        $this->assertFormOrg($request, $form);
        abort_unless((int) $souvenir->event_form_id === (int) $form->id, 403);

        $data = $request->validate([
            'event_registration_id' => ['required', 'integer'],
            'is_collected' => ['required', 'boolean'],
        ]);

        $reg = EventRegistration::query()
            ->where('event_form_id', $form->id)
            ->where('id', $data['event_registration_id'])
            ->firstOrFail();

        SouvenirRegistration::updateOrCreate(
            [
                'souvenir_id' => $souvenir->id,
                'event_registration_id' => $reg->id,
            ],
            ['is_collected' => $data['is_collected']]
        );

        return back()->with('success', 'Collection status updated.');
    }

    private function validatedForm(Request $request, Organization $org): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'form_type' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'message' => ['nullable', 'string'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'location' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'string', 'max:50'],
            'longitude' => ['nullable', 'string', 'max:50'],
            'timezone' => ['nullable', 'string', 'max:80'],
            'group_id' => ['nullable', 'integer', 'exists:organization_groups,id'],
            'meet_room_id' => ['nullable', 'integer', 'exists:meet_rooms,id'],
            'signup' => ['required', Rule::in(['enabled', 'disabled'])],
            'attendance' => ['required', Rule::in(['enabled', 'disabled'])],
            'status' => ['required', Rule::in(['active', 'block', 'disable'])],
        ]);

        if (($data['status'] ?? null) === 'disable') {
            $data['status'] = 'block';
        }

        if (! empty($data['group_id'])) {
            $group = OrganizationGroup::query()->findOrFail($data['group_id']);
            abort_unless((int) $group->organization_id === (int) $org->id, 403);
        }

        if (! empty($data['meet_room_id'])) {
            $ids = $this->organizationUserIds($org);
            $meeting = MeetRoom::query()->findOrFail($data['meet_room_id']);
            abort_unless(in_array((int) $meeting->owner_id, $ids, true) || $request->user()->isSuperAdmin(), 403);
        }

        return $data;
    }

    private function assertFormOrg(Request $request, EventForm $form): Organization
    {
        $org = $this->resolveOrganization($request);
        abort_unless((int) $form->organization_id === (int) $org->id, 403);

        return $org;
    }

    private function orgQuery(Request $request, Organization $org): array
    {
        if ($request->user()?->isSuperAdmin()) {
            return ['organization_id' => $org->id];
        }

        return [];
    }

    /** @return list<array{id:int,name:string}> */
    private function orgMeetings(Organization $org): array
    {
        $userIds = $this->organizationUserIds($org);

        return MeetRoom::query()
            ->whereIn('owner_id', $userIds ?: [0])
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (MeetRoom $m) => ['id' => $m->id, 'name' => $m->name])
            ->all();
    }
}
