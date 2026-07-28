<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // OAuth2 Clients
        Schema::create('oauth_clients', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('secret')->unique();
            $table->text('redirect_uris');
            $table->string('scope')->default('read');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index('is_active');
        });

        // OAuth2 Authorization Codes
        Schema::create('oauth_auth_codes', function (Blueprint $table) {
            $table->id();
            // $table->foreignId('user_id')->constrained()->onDelete('cascade');
             $table->unsignedBigInteger('user_id'); // ✅ Removed foreign key constraint
            $table->string('client_id');
            $table->string('code', 100)->unique();
            $table->string('scopes')->nullable();
            $table->text('redirect_uri')->nullable();
            $table->dateTime('expires_at');
            $table->timestamps();

            $table->index('code');
            $table->index('expires_at');
            $table->foreign('client_id')->references('id')->on('oauth_clients')->onDelete('cascade');
        });

        // OAuth2 Access Tokens
        Schema::create('oauth_access_tokens', function (Blueprint $table) {
            $table->id();
            // $table->foreignId('user_id')->constrained()->onDelete('cascade');
             $table->unsignedBigInteger('user_id'); // ✅ Removed foreign key constraint
            $table->string('client_id');
            $table->string('token', 255)->unique();
            $table->string('scopes')->nullable();
            $table->dateTime('expires_at');
            $table->timestamps();

            $table->index('token');
            $table->index('expires_at');
            $table->foreign('client_id')->references('id')->on('oauth_clients')->onDelete('cascade');
        });

        // OAuth2 Refresh Tokens
        Schema::create('oauth_refresh_tokens', function (Blueprint $table) {
            $table->id();
            // $table->foreignId('access_token_id')->constrained('oauth_access_tokens')->onDelete('cascade')
            // ;
            $table->unsignedBigInteger('access_token_id'); // ✅ Removed foreign key constraint
            $table->string('token', 255)->unique();
            $table->dateTime('expires_at');
            $table->timestamps();

            $table->index('token');
            $table->index('expires_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('oauth_refresh_tokens');
        Schema::dropIfExists('oauth_access_tokens');
        Schema::dropIfExists('oauth_auth_codes');
        Schema::dropIfExists('oauth_clients');
    }
};
