<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\WebhookSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebhookController extends Controller
{
    private const VALID_EVENTS = ['user.created', 'user.updated', 'user.deleted', '*'];

    /**
     * GET /auth/webhooks
     */
    public function index(Request $request): JsonResponse
    {
        $webhooks = WebhookSubscription::where('user_id', $request->user()->id)
            ->select('id', 'name', 'url', 'events', 'is_active', 'last_triggered_at', 'last_response_status', 'created_at')
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $webhooks]);
    }

    /**
     * POST /auth/webhooks
     * Body: { name, url, events: ["user.created", ...] }
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'url' => 'required|url',
            'events' => 'required|array|min:1',
            'events.*' => 'string|in:'.implode(',', self::VALID_EVENTS),
        ]);

        $secret = WebhookSubscription::generateSecret();

        $webhook = WebhookSubscription::create([
            'user_id' => $request->user()->id,
            'name' => $validated['name'],
            'url' => $validated['url'],
            'events' => $validated['events'],
            'secret' => $secret,
            'is_active' => true,
        ]);

        return response()->json([
            'data' => $webhook,
            'secret' => $secret,
        ], 201);
    }

    /**
     * POST /auth/webhooks/{webhook}/rotate-secret
     */
    public function rotateSecret(Request $request, WebhookSubscription $webhook): JsonResponse
    {
        if ($webhook->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $secret = WebhookSubscription::generateSecret();
        $webhook->update(['secret' => $secret, 'failure_count' => 0, 'is_active' => true]);

        return response()->json(['secret' => $secret]);
    }

    /**
     * DELETE /auth/webhooks/{webhook}
     */
    public function destroy(Request $request, WebhookSubscription $webhook): JsonResponse
    {
        if ($webhook->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $webhook->delete();

        return response()->json(['message' => 'Webhook deleted']);
    }
}
