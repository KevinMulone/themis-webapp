import json
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        results = {}

        try:
            from _auth import get_user_id  # noqa: F401
            results['local_import'] = 'ok'
        except Exception as exc:
            results['local_import'] = f'FALLITO: {exc!r}'

        try:
            import cryptography  # noqa: F401
            results['cryptography'] = 'ok'
        except Exception as exc:
            results['cryptography'] = f'FALLITO: {exc!r}'

        try:
            import docx  # noqa: F401
            results['python_docx'] = 'ok'
        except Exception as exc:
            results['python_docx'] = f'FALLITO: {exc!r}'

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(results).encode('utf-8'))
