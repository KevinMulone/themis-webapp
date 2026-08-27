"""Genera un documento .docx da un template + i dati di una pratica.

Funzione serverless Python (Vercel Python Runtime): riusa direttamente
_docgen.py (identico a backend/docgen.py) per non riscrivere la logica di
sostituzione dei placeholder, già collaudata. Verifica sempre l'identità di
chi chiama tramite Supabase Auth (mai fidandosi di un ID studio passato dal
client) e non fa altro che questo più leggere/scrivere lo Storage cifrato:
non ha accesso diretto al database applicativo oltre alle query dirette a
Postgrest necessarie per raccogliere il contesto del documento.
"""
import json
import os
import tempfile
import uuid
from http.server import BaseHTTPRequestHandler

from _auth import get_user_id
from _doc_encryption import decrypt_bytes, encrypt_bytes, SYSTEM_SCOPE
from _docgen import format_value, generate_document
from _storage import download_object, rest_get, rest_post, upload_object


def _first(rows):
    return rows[0] if rows else None


def _handle(body):
    access_token = body.get('access_token')
    user_id = get_user_id(access_token)
    if not user_id:
        raise PermissionError('Sessione non valida')

    matter_id = body.get('matter_id')
    template_id = body.get('template_id')
    manual_values = body.get('manual_values') or {}
    output_filename = body.get('output_filename') or 'documento.docx'
    if not matter_id or not template_id:
        raise ValueError('matter_id e template_id sono obbligatori')

    matter = _first(rest_get(f'/rest/v1/matters?id=eq.{matter_id}&studio_id=eq.{user_id}&select=*'))
    if not matter:
        raise ValueError('Pratica non trovata')

    template = _first(rest_get(
        f'/rest/v1/templates?id=eq.{template_id}'
        f'&or=(studio_id.is.null,studio_id.eq.{user_id})&select=*'
    ))
    if not template:
        raise ValueError('Template non trovato o non accessibile')

    client = _first(rest_get(f'/rest/v1/clients?id=eq.{matter["client_id"]}&select=*'))
    sinistro = None
    if matter.get('tipo_pratica') == 'sinistro':
        sinistro = _first(rest_get(f'/rest/v1/sinistri?matter_id=eq.{matter_id}&select=*'))

    placeholders = rest_get(f'/rest/v1/template_placeholders?template_id=eq.{template_id}&select=*&order=ordine')

    context = {}
    missing = []
    for p in placeholders:
        sorgente = p['sorgente']
        campo = p.get('campo_sorgente')
        key = p['placeholder_key']
        raw_value = None
        if sorgente == 'client' and campo:
            raw_value = (client or {}).get(campo)
        elif sorgente == 'matter' and campo:
            raw_value = matter.get(campo)
        elif sorgente == 'sinistro' and campo:
            raw_value = (sinistro or {}).get(campo)
        else:
            raw_value = manual_values.get(key)

        if raw_value in (None, '') and p.get('obbligatorio'):
            missing.append(p['etichetta'])
            continue
        context[key] = format_value(raw_value, p.get('tipo_campo'))

    if missing:
        raise ValueError('Campi obbligatori mancanti: ' + ', '.join(missing))

    template_scope = template['studio_id'] or SYSTEM_SCOPE
    template_blob = download_object(template['storage_path'])
    template_bytes = decrypt_bytes(template_blob, template_scope)

    settings = _first(rest_get(f'/rest/v1/studio_settings?studio_id=eq.{user_id}&select=*')) or {}
    letterhead_path_tmp = None
    if settings.get('letterhead_storage_path'):
        letterhead_blob = download_object(settings['letterhead_storage_path'])
        letterhead_bytes = decrypt_bytes(letterhead_blob, user_id)
        letterhead_path_tmp = os.path.join(tempfile.gettempdir(), f'letterhead_{uuid.uuid4().hex}.png')
        with open(letterhead_path_tmp, 'wb') as f:
            f.write(letterhead_bytes)

    template_path_tmp = os.path.join(tempfile.gettempdir(), f'template_{uuid.uuid4().hex}.docx')
    output_path_tmp = os.path.join(tempfile.gettempdir(), f'output_{uuid.uuid4().hex}.docx')
    with open(template_path_tmp, 'wb') as f:
        f.write(template_bytes)

    try:
        used = generate_document(
            template_path_tmp, output_path_tmp, context,
            letterhead_path=letterhead_path_tmp,
            font_family=settings.get('font_family') or 'Times New Roman',
            font_size_pt=float(settings.get('font_size_pt') or 12),
            line_spacing=float(settings.get('line_spacing') or 1.5),
        )
        with open(output_path_tmp, 'rb') as f:
            output_bytes = f.read()
    finally:
        for p in (template_path_tmp, output_path_tmp, letterhead_path_tmp):
            if p and os.path.isfile(p):
                os.remove(p)

    documento_id = str(uuid.uuid4())
    storage_path = f'documenti/{user_id}/{documento_id}.docx.enc'
    upload_object(storage_path, encrypt_bytes(output_bytes, user_id))

    rest_post('/rest/v1/documenti', {
        'id': documento_id, 'studio_id': user_id, 'matter_id': matter_id, 'template_id': template_id,
        'nome_file': output_filename, 'storage_path': storage_path,
    })

    return {
        'ok': True,
        'documento_id': documento_id,
        'nome_file': output_filename,
        'placeholder_usati': sorted(used),
    }


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8') or '{}')
            result = _handle(body)
            self._send(200, result)
        except PermissionError as exc:
            self._send(401, {'ok': False, 'error': str(exc)})
        except ValueError as exc:
            self._send(400, {'ok': False, 'error': str(exc)})
        except Exception as exc:  # noqa: BLE001 - confine della funzione, non deve mai propagare
            self._send(500, {'ok': False, 'error': str(exc)})

    def _send(self, status, payload):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode('utf-8'))
