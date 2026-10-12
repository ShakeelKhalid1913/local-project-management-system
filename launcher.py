"""Double-click entry: start PMS and open the browser."""

from __future__ import annotations

import socket
import sys
import threading
import time
import webbrowser

from app import run_server

HOST = "127.0.0.1"
PORT = 5000
URL = f"http://{HOST}:{PORT}"


def _port_free(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) != 0


def _open_when_ready() -> None:
    for _ in range(40):
        if not _port_free(HOST, PORT):
            webbrowser.open(URL)
            return
        time.sleep(0.15)
    webbrowser.open(URL)


def main() -> int:
    already_running = not _port_free(HOST, PORT)
    if already_running:
        print(f"PMS already running — opening {URL}")
        webbrowser.open(URL)
        return 0

    print("PMS starting…")
    print(f"Open: {URL}")
    print("Close this window to stop the app.")
    print("-" * 40)

    threading.Thread(target=_open_when_ready, daemon=True).start()
    try:
        run_server(host=HOST, port=PORT, debug=False)
    except OSError as exc:
        print(f"Could not start server: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
