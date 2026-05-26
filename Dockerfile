# docker/reverb/Dockerfile
#
# Minimal PHP CLI image for running `php artisan reverb:start`.
#
# Why not php:8.3-cli directly?
# Laravel Reverb's StartServer command registers OS signal handlers via
# pcntl (SIGINT, SIGTERM, SIGTSTP). The stock php:8.3-cli image does NOT
# compile pcntl in, so PHP treats those constants as undefined and the
# process crashes immediately with:
#
#   Undefined constant "Laravel\Reverb\...\SIGINT"
#
# Solution: compile pcntl (and a minimal set of other required extensions).

FROM php:8.3-cli

# pcntl   — signal handling (SIGINT/SIGTERM/SIGTSTP) — REQUIRED by Reverb
# sockets — low-level socket I/O used by the ReactPHP event loop
# mbstring — string utilities used by Laravel framework bootstrap
RUN docker-php-ext-install pcntl sockets mbstring

# Install Composer so we can verify/install dependencies at container start
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# The application directory is bind-mounted at runtime (see docker-compose.yml).
# We do not COPY source here — keeps the image generic and avoids stale layers.

CMD ["php", "artisan", "reverb:start", "--host=0.0.0.0", "--port=8080", "--debug"]
