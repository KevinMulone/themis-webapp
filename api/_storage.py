import json
import os
import urllib.error
import urllib.request

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', '')
SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
BUCKET = 'documents'


def download_object(storage_path: str) -> bytes:
    req = urllib.request.Request(f'{SUPABASE_URL}/storage/v1/object/{BUCKET}/{storage_path}')
    req.add_header('apikey', SERVICE_ROLE_KEY)
    req.add_header('Authorization', f'Bearer {SERVICE_ROLE_KEY}')
    with urllib.request.urlopen(req) as resp:
        return resp.read()


def upload_object(storage_path: str, data: bytes):
    req = urllib.request.Request(
        f'{SUPABASE_URL}/storage/v1/object/{BUCKET}/{storage_path}', data=data, method='POST',
    )
    req.add_header('apikey', SERVICE_ROLE_KEY)
    req.add_header('Authorization', f'Bearer {SERVICE_ROLE_KEY}')
    req.add_header('Content-Type', 'application/octet-stream')
    req.add_header('x-upsert', 'true')
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f'Upload fallito ({exc.code}): {exc.read().decode()}') from exc


def rest_get(path: str):
    req = urllib.request.Request(f'{SUPABASE_URL}{path}')
    req.add_header('apikey', SERVICE_ROLE_KEY)
    req.add_header('Authorization', f'Bearer {SERVICE_ROLE_KEY}')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8') or '[]')


def rest_post(path: str, body):
    data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(f'{SUPABASE_URL}{path}', data=data, method='POST')
    req.add_header('apikey', SERVICE_ROLE_KEY)
    req.add_header('Authorization', f'Bearer {SERVICE_ROLE_KEY}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'return=representation')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8') or '[]')
