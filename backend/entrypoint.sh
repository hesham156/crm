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

echo "🪣 Creating MinIO bucket if not exists..."
python -c "
import os, boto3
from botocore.exceptions import ClientError
endpoint = os.environ.get('AWS_S3_ENDPOINT_URL')
if endpoint:
    try:
        s3 = boto3.client(
            's3',
            endpoint_url=endpoint,
            aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID', 'prosticker_minio'),
            aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY', 'prosticker_minio_secret'),
        )
        bucket = os.environ.get('AWS_STORAGE_BUCKET_NAME', 'prosticker-files')
        try:
            s3.create_bucket(Bucket=bucket)
            print(f'✅ Bucket [{bucket}] created.')
        except ClientError as e:
            code = e.response['Error']['Code']
            if code in ('BucketAlreadyExists', 'BucketAlreadyOwnedByYou'):
                print(f'✅ Bucket [{bucket}] already exists.')
            else:
                print(f'⚠️  MinIO bucket error: {e}')
        # Set bucket policy: public read
        policy = '{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"AWS\":[\"*\"]},\"Action\":[\"s3:GetBucketLocation\",\"s3:ListBucket\",\"s3:GetObject\"],\"Resource\":[\"arn:aws:s3:::' + bucket + '\",\"arn:aws:s3:::' + bucket + '/*\"]}]}'
        try:
            s3.put_bucket_policy(Bucket=bucket, Policy=policy)
            print(f'✅ Bucket [{bucket}] policy set to public-read.')
        except ClientError:
            pass
    except Exception as ex:
        print(f'⚠️  MinIO setup skipped: {ex}')
else:
    print('ℹ️  MinIO not configured, using local file storage.')
" 2>/dev/null || echo "⚠️  MinIO bucket setup failed, continuing..."

echo "🚀 Starting server..."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
