from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
NAMES = sorted(path.stem for path in (ROOT / 'assets' / 'limericksarg').glob('*.jpg'))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        if self.path == '/tools/compile-targets.html':
            template = (ROOT / 'tools' / 'compile-targets.html').read_text(encoding='utf-8')
            page = template.replace('PARAM_NAMES', repr(NAMES))
            body = page.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        if self.path != '/save-target':
            self.send_error(404)
            return
        name = self.headers.get('X-Limerick-Name', '')
        if name not in NAMES or not re.fullmatch(r'[a-z0-9_]+', name):
            self.send_error(400)
            return
        length = int(self.headers.get('Content-Length', '0'))
        target_dir = ROOT / name
        target_dir.mkdir(exist_ok=True)
        (target_dir / 'targets.mind').write_bytes(self.rfile.read(length))
        self.send_response(204)
        self.end_headers()


if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
