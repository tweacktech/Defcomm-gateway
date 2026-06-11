<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrganizationController extends Controller
{
    /**
     * Search organizations by name for the registration typeahead.
     */
    public function search(Request $request): JsonResponse
    {
        $query = $request->string('q')->trim();

        if ($query->isEmpty() || $query->length() < 2) {
            return response()->json([]);
        }

        $organizations = Organization::query()
            ->where('status', 'active')
            ->where('name', 'like', "%{$query}%")
            ->orderByRaw('CASE WHEN name LIKE ? THEN 0 ELSE 1 END', [$query . '%'])
            ->limit(8)
            ->get(['id', 'name', 'email']);

        return response()->json($organizations);
    }
}
