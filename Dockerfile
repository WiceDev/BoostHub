# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Django app ────────────────────────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app

# System deps (psycopg2 needs libpq)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirement.txt .
RUN pip install --no-cache-dir -r requirement.txt

# Copy Django source
COPY . .

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Collect static files (needs a dummy SECRET_KEY — no DB access required)
RUN SECRET_KEY=dummy-collectstatic-key \
    DATABASE_NAME=dummy DATABASE_USER=dummy DATABASE_PASSWORD=dummy \
    python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "core.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4", "--threads", "4", "--worker-class", "gthread", "--timeout", "120"]
