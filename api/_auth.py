import json
import os
import urllib.error
import urllib.request

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', '')
ANON_KEY = os.environ.get('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')


def get_user_id(access_token: str):
    """Verifica il token dell'utente chiamando Supabase Auth direttamente
    (non ci si fida MAI di uno studio_id passato dal client): ritorna l'id
    dell'utente autenticato, o None se il token non è valido."""
    if not access_token:
        return None
    req = urllib.request.Request(f'{SUPABASE_URL}/auth/v1/user')
    req.add_header('apikey', ANON_KEY)
    req.add_header('Authorization', f'Bearer {access_token}')
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('id')
    except urllib.error.HTTPError:
        return None
