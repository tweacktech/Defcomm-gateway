#!/bin/bash
cd /www/wwwroot/aisystem.defcomm.cloud

# echo "Pulling latest changes..."
# git pull origin main

# echo "Installing PHP dependencies..."
# composer install --no-dev --optimize-autoloader

# echo "Installing Node dependencies..."
# npm install --legacy-peer-deps

# echo "Building frontend..."
# npm run build
# rm -f public/hot

echo "Clearing caches..."
php artisan config:clear
php artisan cache:clear
php artisan view:clear
php artisan route:clear
rm -f bootstrap/cache/*.php

echo "Running migrations..."
php artisan migrate --force

echo "Optimizing..."
php artisan config:cache
php artisan route:cache

echo "Fixing permissions..."
chown -R www:www storage bootstrap/cache
chmod -R 775 storage bootstrap/cache

# ─────────────────────────────────────────────────────────────────
# START REVERB WEBSOCKET SERVER
# ─────────────────────────────────────────────────────────────────

echo "Starting Laravel Reverb..."

# Method 1: Using Supervisor (Recommended for Production)
# Uncomment if you have Supervisor configured
# echo "Restarting Reverb via Supervisor..."
# supervisorctl restart reverb

# Method 2: Using systemd service (if configured)
# echo "Restarting Reverb service..."
# systemctl restart reverb

# Method 3: Kill existing Reverb process and start new one (current implementation)
# echo "Stopping existing Reverb processes..."
# pkill -f "reverb:start" || true
# sleep 2

# Method 4: Using PM2 (if you prefer Node.js process manager)
# npm install -g pm2
# pm2 restart reverb

# Start Reverb in background with queue worker
# echo "Starting Reverb server..."
# nohup php artisan reverb:start --host=0.0.0.0 --port=8081 > /dev/null 2>&1 &

# Also start queue worker for broadcasting events
# echo "Starting queue worker..."
# nohup php artisan queue:work --daemon > /dev/null 2>&1 &

# echo "Waiting for Reverb to start..."
# sleep 3


# Check if Reverb is running
# if pgrep -f "reverb:start" > /dev/null; then
#     echo "✅ Reverb started successfully!"
#     echo "Reverb PID: $(pgrep -f 'reverb:start')"
# else
#     echo "❌ Failed to start Reverb. Check logs: tail -f storage/logs/laravel.log"
# fi

# Optional: Check if port 8080 is listening
# echo "Checking WebSocket port..."
# if netstat -tulpn 2>/dev/null | grep ":8080" > /dev/null; then
#     echo "✅ Port 8080 is listening"
# else
#     echo "⚠️ Port 8080 not yet listening (may need a few more seconds)"
# fi

echo nohup php artisan reverb:start --host=0.0.0.0 --port=8080 >> /var/log/reverb.log 2>&1 &

# Or with supervisor (recommended for production)



# ─────────────────────────────────────────────────────────────────
# RELOAD DOCKER CONTAINERS (Coturn TURN Server)
# ─────────────────────────────────────────────────────────────────

echo "Reloading Docker containers..."

# Navigate to docker directory (adjust path if needed)
cd /www/wwwroot/aisystem.defcomm.cloud

# # Pull latest Docker images (optional)
# echo "Pulling latest Docker images..."
# docker-compose pull

# Stop existing containers gracefully
echo "Stopping existing containers..."
docker-compose down

# # Remove stopped containers (cleanup)
# echo "Removing old containers..."
# docker container prune -f

# Rebuild and start containers
echo "Building and starting containers..."
docker-compose up -d --build

# Check container status
echo "Docker container status:"
docker-compose ps

# Show Coturn logs for verification
echo "Coturn container logs (last 10 lines):"
docker-compose logs --tail=10 coturn

# Check if Coturn is healthy
if docker-compose ps | grep -q "coturn.*Up"; then
    echo "✅ Coturn TURN server is running"
else
    echo "⚠️ Coturn container failed to start. Check logs: docker-compose logs coturn"
fi

echo ps aux | grep reverb

echo "Done!"
