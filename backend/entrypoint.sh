#!/bin/bash
set -e

echo "⏳ Waiting for database..."
while ! python -c "import psycopg2; psycopg2.connect('${DATABASE_URL}')" 2>/dev/null; do
    sleep 1
done
echo "✅ Database ready."

echo "🔄 Running migrations..."
python manage.py migrate --noinput

echo "📦 Collecting static files..."
python manage.py collectstatic --noinput

echo "🌱 Creating superuser if not exists..."
python manage.py shell -c "
from apps.accounts.models import User
if not User.objects.filter(email='admin@prosticker.com').exists():
    User.objects.create_superuser(
        email='admin@prosticker.com',
        password='admin123',
        full_name_en='System Admin',
        full_name_ar='مدير النظام',
        role='admin'
    )
    print('Superuser created: admin@prosticker.com / admin123')
else:
    print('Superuser already exists.')
"

echo "🚀 Starting server..."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
