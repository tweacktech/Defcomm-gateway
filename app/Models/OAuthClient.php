<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OAuthClient extends Model
{
    protected $table = 'oauth_clients';

    protected $fillable = [
        'name',
        'secret',
        'redirect_uris',
        'scope',
        'is_active',
    ];

    protected $casts = [
        'redirect_uris' => 'array',
        'is_active' => 'boolean',
    ];

    protected $hidden = [
        'secret',
    ];

    /**
     * Whether the given redirect_uri is one this client registered.
     * Required to stop `redirect_uri` from being an open redirect vector.
     */
    public function hasRedirectUri(string $uri): bool
    {
        $normalize = fn (string $u) => rtrim($u, '/');

        return in_array(
            $normalize($uri),
            array_map($normalize, $this->redirect_uris ?? []),
            true
        );
    }
}
