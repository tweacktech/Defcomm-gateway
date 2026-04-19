FROM php:8.3-fpm

# RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
#     && apt-get install -y nodejs
# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    nodejs \
    npm \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    flac \
    espeak-ng \
    libespeak1 \
    && rm -rf /var/lib/apt/lists/*

# Python venv lives outside /var/www so bind mounts do not erase packages (docker-compose dev)
COPY app/Services/pythonService/requirements.txt /opt/venv-speech-requirements.txt
RUN python3 -m venv /opt/venv-speech \
    && /opt/venv-speech/bin/pip install --upgrade pip \
    && /opt/venv-speech/bin/pip install --no-cache-dir -r /opt/venv-speech-requirements.txt

ENV PATH="/opt/venv-speech/bin:${PATH}"

# Install PHP extensions
RUN docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

# Copy project
COPY . .

# Install dependencies
RUN composer install
RUN npm install && npm run build

# Permissions
RUN chown -R www-data:www-data /var/www

EXPOSE 9000

CMD ["php-fpm"]
