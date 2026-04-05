#!/bin/bash
cd /www/wwwroot/aisystem.defcomm.cloud

echo "Pulling latest changes..."
git pull origin main

echo "Installing PHP dependencies..."
composer install --no-dev --optimize-autoloader

echo "Installing Node dependencies..."
npm install --legacy-peer-deps

echo "Building frontend..."
npm run build
rm -f public/hot

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

echo "Done!"
