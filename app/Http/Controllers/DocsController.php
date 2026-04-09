<?php
// ─── Add to routes/web.php (inside auth middleware group) ─────────────────────

// Route::middleware(['auth'])->group(function () {
//     ...existing routes...
//     Route::get('/docs/sdk', [DocsController::class, 'sdk'])->name('docs.sdk');
// });


// ─── app/Http/Controllers/DocsController.php ─────────────────────────────────

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class DocsController extends Controller
{
    /**
     * GET /docs/sdk
     * SDK documentation page — auth protected.
     */
    public function sdk(): Response
    {
        return Inertia::render('docs-sdk');
    }
}
