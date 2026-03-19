<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\Response;

/**
 * ApiResponds
 *
 * Drop into any API controller for consistent, typed JSON responses.
 *
 * Usage:
 *   use App\Traits\ApiResponds;
 *
 *   class UserController extends Controller
 *   {
 *       use ApiResponds;
 *
 *       public function index() {
 *           return $this->ok($users, 'Users retrieved.');
 *       }
 *
 *       public function store() {
 *           return $this->created($user, 'User created.');
 *       }
 *
 *       public function destroy() {
 *           return $this->noContent();
 *       }
 *
 *       public function login() {
 *           return $this->unauthorized('Invalid credentials.');
 *       }
 *   }
 */
trait ApiResponds
{
    // =========================================================================
    // 2xx — Success
    // =========================================================================

    /**
     * 200 OK — generic success with optional data.
     *
     * @param  mixed       $data
     * @param  string      $message
     * @param  array       $meta    Extra top-level keys merged into the response envelope
     */
    protected function ok(
        mixed  $data    = null,
        string $message = 'Success.',
        array  $meta    = [],
    ): JsonResponse {
        return $this->success($data, $message, Response::HTTP_OK, $meta);
    }

    /**
     * 201 Created.
     */
    protected function created(
        mixed  $data    = null,
        string $message = 'Resource created.',
        array  $meta    = [],
    ): JsonResponse {
        return $this->success($data, $message, Response::HTTP_CREATED, $meta);
    }

    /**
     * 202 Accepted — async / queued operation.
     */
    protected function accepted(
        mixed  $data    = null,
        string $message = 'Request accepted.',
        array  $meta    = [],
    ): JsonResponse {
        return $this->success($data, $message, Response::HTTP_ACCEPTED, $meta);
    }

    /**
     * 204 No Content — used for DELETE / actions with no body.
     */
    protected function noContent(): JsonResponse
    {
        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    // =========================================================================
    // 4xx — Client Errors
    // =========================================================================

    /**
     * 400 Bad Request — malformed input, business rule violation.
     */
    protected function badRequest(
        string $message = 'Bad request.',
        mixed  $errors  = null,
    ): JsonResponse {
        return $this->error($message, Response::HTTP_BAD_REQUEST, $errors);
    }

    /**
     * 401 Unauthorized — missing or invalid credentials.
     */
    protected function unauthorized(
        string $message = 'Unauthenticated.',
    ): JsonResponse {
        return $this->error($message, Response::HTTP_UNAUTHORIZED);
    }

    /**
     * 402 Payment Required.
     */
    protected function paymentRequired(
        string $message = 'Payment required.',
    ): JsonResponse {
        return $this->error($message, Response::HTTP_PAYMENT_REQUIRED);
    }

    /**
     * 403 Forbidden — authenticated but not authorized.
     */
    protected function forbidden(
        string $message = 'Forbidden.',
    ): JsonResponse {
        return $this->error($message, Response::HTTP_FORBIDDEN);
    }

    /**
     * 404 Not Found.
     */
    protected function notFound(
        string $message = 'Resource not found.',
    ): JsonResponse {
        return $this->error($message, Response::HTTP_NOT_FOUND);
    }

    /**
     * 405 Method Not Allowed.
     */
    protected function methodNotAllowed(
        string $message = 'Method not allowed.',
    ): JsonResponse {
        return $this->error($message, Response::HTTP_METHOD_NOT_ALLOWED);
    }

    /**
     * 409 Conflict — duplicate resource, state mismatch.
     */
    protected function conflict(
        string $message = 'Conflict.',
        mixed  $errors  = null,
    ): JsonResponse {
        return $this->error($message, Response::HTTP_CONFLICT, $errors);
    }

    /**
     * 410 Gone — resource existed but has been permanently removed.
     */
    protected function gone(
        string $message = 'Resource no longer available.',
    ): JsonResponse {
        return $this->error($message, Response::HTTP_GONE);
    }

    /**
     * 422 Unprocessable Entity — validation errors.
     *
     * @param  array|string  $errors   Validation error bag or single message
     */
    protected function unprocessable(
        mixed  $errors  = null,
        string $message = 'Validation failed.',
    ): JsonResponse {
        return $this->error($message, Response::HTTP_UNPROCESSABLE_ENTITY, $errors);
    }

    /**
     * 429 Too Many Requests — rate limit exceeded.
     */
    protected function tooManyRequests(
        string $message   = 'Too many requests. Slow down.',
        int    $retryAfter = 60,
    ): JsonResponse {
        return response()->json([
            'status'      => 'error',
            'code'        => Response::HTTP_TOO_MANY_REQUESTS,
            'message'     => $message,
            'retry_after' => $retryAfter,
        ], Response::HTTP_TOO_MANY_REQUESTS)
            ->header('Retry-After', (string) $retryAfter);
    }

    // =========================================================================
    // 5xx — Server Errors
    // =========================================================================

    /**
     * 500 Internal Server Error.
     */
    protected function serverError(
        string $message = 'An unexpected error occurred.',
        mixed  $debug   = null,
    ): JsonResponse {
        $body = [
            'status'  => 'error',
            'code'    => Response::HTTP_INTERNAL_SERVER_ERROR,
            'message' => $message,
        ];

        // Only expose debug info in non-production environments
        if ($debug !== null && ! app()->isProduction()) {
            $body['debug'] = $debug;
        }

        return response()->json($body, Response::HTTP_INTERNAL_SERVER_ERROR);
    }

    /**
     * 503 Service Unavailable — maintenance, downstream dependency down.
     */
    protected function serviceUnavailable(
        string $message = 'Service temporarily unavailable.',
    ): JsonResponse {
        return $this->error($message, Response::HTTP_SERVICE_UNAVAILABLE);
    }

    // =========================================================================
    // Paginated response
    // =========================================================================

    /**
     * Wrap a paginator in the standard envelope.
     *
     * Automatically extracts pagination meta so callers don't have to.
     *
     * @param  LengthAwarePaginator  $paginator
     * @param  callable|null         $transform   Optional item-level transform
     * @param  string                $message
     * @param  array                 $meta        Extra envelope keys
     */
    protected function paginated(
        LengthAwarePaginator $paginator,
        ?callable            $transform = null,
        string               $message   = 'Success.',
        array                $meta      = [],
    ): JsonResponse {
        $items = $transform
            ? $paginator->getCollection()->map($transform)->values()
            : $paginator->items();

        return response()->json(array_merge([
            'status'  => 'success',
            'code'    => Response::HTTP_OK,
            'message' => $message,
            'data'    => $items,
            'meta'    => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
                'from'         => $paginator->firstItem(),
                'to'           => $paginator->lastItem(),
                'has_more'     => $paginator->hasMorePages(),
            ],
        ], $meta), Response::HTTP_OK);
    }

    // =========================================================================
    // Token / Auth helpers
    // =========================================================================

    /**
     * Return a token response (used after login / token refresh).
     *
     * @param  string  $token
     * @param  string  $tokenType    e.g. 'Bearer'
     * @param  mixed   $user         Optional user payload
     * @param  string  $message
     */
    protected function withToken(
        string $token,
        string $tokenType = 'Bearer',
        mixed  $user      = null,
        string $message   = 'Authenticated.',
    ): JsonResponse {
        $body = [
            'status'     => 'success',
            'code'       => Response::HTTP_OK,
            'message'    => $message,
            'token'      => $token,
            'token_type' => $tokenType,
        ];

        if ($user !== null) {
            $body['user'] = $user;
        }

        return response()->json($body, Response::HTTP_OK);
    }

    // =========================================================================
    // Core builders (private — use the named helpers above)
    // =========================================================================

    /**
     * Build a success envelope.
     */
    private function success(
        mixed  $data,
        string $message,
        int    $status,
        array  $meta,
    ): JsonResponse {
        $body = [
            'status'  => 'success',
            'code'    => $status,
            'message' => $message,
        ];

        if ($data !== null) {
            // Unwrap paginator automatically
            if ($data instanceof LengthAwarePaginator) {
                $body['data'] = $data->items();
                $body['meta'] = [
                    'current_page' => $data->currentPage(),
                    'last_page'    => $data->lastPage(),
                    'per_page'     => $data->perPage(),
                    'total'        => $data->total(),
                    'from'         => $data->firstItem(),
                    'to'           => $data->lastItem(),
                    'has_more'     => $data->hasMorePages(),
                ];
            } elseif ($data instanceof Collection) {
                $body['data'] = $data->values();
            } else {
                $body['data'] = $data;
            }
        }

        // Merge any extra top-level keys
        foreach ($meta as $key => $value) {
            $body[$key] = $value;
        }

        return response()->json($body, $status);
    }

    /**
     * Build an error envelope.
     */
    private function error(
        string $message,
        int    $status,
        mixed  $errors = null,
    ): JsonResponse {
        $body = [
            'status'  => 'error',
            'code'    => $status,
            'message' => $message,
        ];

        if ($errors !== null) {
            $body['errors'] = $errors;
        }

        return response()->json($body, $status);
    }
}
