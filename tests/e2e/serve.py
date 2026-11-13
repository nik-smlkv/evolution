"""Serve a fresh production build on loopback for the browser suite."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import signal
import subprocess
import sys
from tempfile import TemporaryDirectory


ROOT = Path(__file__).resolve().parents[2]


class PreviewHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path.startswith("/preview/"):
            path = path.removeprefix("/preview")
        return super().translate_path(path)

    def log_request(self, code="-", size="-"):
        if isinstance(code, int) and code >= 400:
            super().log_request(code, size)

    def copyfile(self, source, output):
        try:
            super().copyfile(source, output)
        except (BrokenPipeError, ConnectionResetError):
            # Navigation and media cancellation can close the browser's socket.
            pass


def stop_server(_signal, _frame):
    raise KeyboardInterrupt


def main():
    signal.signal(signal.SIGTERM, stop_server)
    with TemporaryDirectory(prefix="evolution-e2e-") as temporary:
        build = Path(temporary) / "dist"
        subprocess.run(
            [sys.executable, "-B", str(ROOT / "scripts/build-production.py"), "--output", str(build)],
            cwd=ROOT,
            check=True,
        )
        handler = partial(PreviewHandler, directory=build)
        with ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), handler) as server:
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass


if __name__ == "__main__":
    main()
