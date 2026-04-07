#!/bin/bash
# PriveBoost VPS Deployment Script
# Run this on your Hostinger VPS after cloning the repo

set -e

echo "=== PriveBoost Deployment ==="

# Pull latest code
echo "[1/5] Pulling latest code..."
git pull origin master

# Build and start containers
echo "[2/5] Building and starting containers..."
docker compose up -d --build

# Wait for services to be healthy
echo "[3/5] Waiting for services to start..."
sleep 10

# Collect static files inside the container
echo "[4/5] Collecting static files..."
docker compose exec web python manage.py collectstatic --noinput

echo "[5/5] Done! Checking container status..."
docker compose ps

echo ""
echo "=== Deployment complete ==="
echo "Site should be live at https://www.priveboost.com"
