<?php

namespace App\Modules\SecureDB\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Models\SecureDbWidget;
use App\Modules\SecureDB\Services\AuditService;
use App\Modules\SecureDB\Services\WidgetService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SecureDbWidgetController extends Controller
{
    public function __construct(
        protected WidgetService $widgets,
        protected AuditService $audit,
    ) {}

    public function index(Request $request): Response
    {
        $this->requireAdmin($request);

        return Inertia::render('admin/secure-db/secure-widget', [
            'widgets' => SecureDbWidget::with(['project:id,name'])
                ->latest()
                ->paginate(15),
            'projects' => SecureDbProject::select('id', 'name')->orderBy('name')->get(),
            'languages' => WidgetService::LANGUAGES,
            'database_market' => WidgetService::DATABASE_MARKET,
            'gateway_url' => rtrim(config('app.url'), '/'),
        ]);
    }

    public function store(Request $request)
    {
        $this->requireAdmin($request);

        $data = $request->validate([
            'project_id' => 'required|exists:secure_db_projects,id',
            'name' => 'required|string|max:255',
            'language' => 'required|string|in:' . implode(',', array_keys(WidgetService::LANGUAGES)),
            'database_type' => 'required|string|in:' . implode(',', array_keys(WidgetService::DATABASE_MARKET)),
            'allowed_origins' => 'nullable|array',
            'allowed_origins.*' => 'string|max:255',
        ]);

        $project = SecureDbProject::findOrFail($data['project_id']);

        $result = $this->widgets->create(
            $project,
            $data['name'],
            $data['language'],
            $data['database_type'],
            $request->user()->id,
            $data['allowed_origins'] ?? null,
        );

        $this->audit->log($project, 'project_change', "Secure widget created: {$data['name']}", $request->user(), $request);

        return redirect()->back()->with('widget_created', [
            'uuid' => $result['widget']->uuid,
            'name' => $result['widget']->name,
            'widget_key' => $result['widget']->widget_key,
            'secret_key' => $result['secret_key'],
            'embed_code' => $result['embed_code'],
            'database_type' => $result['widget']->database_type,
        ]);
    }

    public function regenerateSecret(Request $request, SecureDbWidget $widget)
    {
        $this->requireAdmin($request);

        $result = $this->widgets->regenerateSecret($widget);
        $this->audit->log($widget->project, 'project_change', "Widget secret regenerated: {$widget->name}", $request->user(), $request);

        return redirect()->back()->with('widget_secret', [
            'uuid' => $widget->uuid,
            'secret_key' => $result['secret_key'],
            'embed_code' => $result['embed_code'],
        ]);
    }

    public function embedCode(Request $request, SecureDbWidget $widget)
    {
        $this->requireAdmin($request);

        return response()->json([
            'embed_code' => $this->widgets->buildEmbedCode($widget),
        ]);
    }

    public function toggle(Request $request, SecureDbWidget $widget)
    {
        $this->requireAdmin($request);
        $widget->update(['is_active' => ! $widget->is_active]);

        return redirect()->back();
    }

    public function destroy(Request $request, SecureDbWidget $widget)
    {
        $this->requireAdmin($request);
        $widget->delete();

        return redirect()->back();
    }

    protected function requireAdmin(Request $request): void
    {
        if ($request->user()?->role !== 'admin') {
            abort(403);
        }
    }
}
