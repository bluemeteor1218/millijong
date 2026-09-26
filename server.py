import hashlib
import hmac
import getpass
import json
import os
import re
import secrets
import sys
import tempfile
import time
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "data.js"
SESSION_COOKIE = "millijong_admin"
SESSION_SECONDS = 30 * 60
LOGIN_WINDOW_SECONDS = 60
MAX_LOGIN_FAILURES = 5
MAX_BODY_BYTES = 16 * 1024
SESSIONS = {}
LOGIN_FAILURES = {}


def _find_matching_delimiter(source, start, opening, closing):
    depth = 0
    quote = None
    escaped = False
    line_comment = False
    block_comment = False
    index = start

    while index < len(source):
        char = source[index]
        following = source[index + 1] if index + 1 < len(source) else ""

        if line_comment:
            if char in "\r\n":
                line_comment = False
        elif block_comment:
            if char == "*" and following == "/":
                block_comment = False
                index += 1
        elif quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
        elif char == "/" and following == "/":
            line_comment = True
            index += 1
        elif char == "/" and following == "*":
            block_comment = True
            index += 1
        elif char in "\"'`":
            quote = char
        elif char == opening:
            depth += 1
        elif char == closing:
            depth -= 1
            if depth == 0:
                return index
        index += 1

    raise ValueError("Could not find the end of the JavaScript object")


def _raw_units_bounds(source):
    match = re.search(r"\bconst\s+RAW_UNITS\s*=\s*\{", source)
    if not match:
        raise ValueError("RAW_UNITS was not found in data.js")
    opening = source.index("{", match.start())
    closing = _find_matching_delimiter(source, opening, "{", "}")
    return opening, closing


def _unit_names_from_source(source, object_start, object_end):
    body = source[object_start + 1:object_end]
    names = set()
    for match in re.finditer(r'("(?:\\.|[^"\\])*")\s*:', body):
        try:
            names.add(json.loads(match.group(1)))
        except json.JSONDecodeError:
            continue
    return names


def _custom_names_line(source):
    match = re.search(r"(?m)^const CUSTOM_UNIT_NAMES = ([^;\r\n]+);?\r?$", source)
    if not match:
        raise ValueError("CUSTOM_UNIT_NAMES was not found in data.js")
    names = json.loads(match.group(1))
    if not isinstance(names, list) or any(not isinstance(name, str) for name in names):
        raise ValueError("CUSTOM_UNIT_NAMES must be a JSON string array")
    return match, names


def _idol_names(source):
    match = re.search(r"\bconst\s+IDOLS\s*=\s*\{", source)
    if not match:
        raise ValueError("IDOLS was not found in data.js")
    opening = source.index("{", match.start())
    closing = _find_matching_delimiter(source, opening, "{", "}")
    body = source[opening + 1:closing]
    idols = set()
    for match in re.finditer(r"\b(?:Princess|Fairy|Angel)\s*:\s*(\[[^\]]*\])", body):
        idols.update(json.loads(match.group(1)))
    if len(idols) != 52:
        raise ValueError("Expected exactly 52 idols in data.js")
    return idols


def _extract_custom_units(source):
    names_match, names = _custom_names_line(source)
    opening, closing = _raw_units_bounds(source)
    body = source[opening + 1:closing]
    units = []
    for name in names:
        key = json.dumps(name, ensure_ascii=False)
        match = re.search(re.escape(key) + r"\s*:\s*", body)
        if not match:
            continue
        array_start = body.find("[", match.end())
        if array_start == -1:
            continue
        array_end = _find_matching_delimiter(body, array_start, "[", "]")
        members = json.loads(body[array_start:array_end + 1])
        units.append({"name": name, "members": members})
    return units


def _atomic_write(path, contents):
    file_mode = path.stat().st_mode
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=path.name + ".", suffix=".tmp", delete=False) as temporary:
            temporary_path = Path(temporary.name)
            temporary.write(contents.encode("utf-8"))
            temporary.flush()
            os.fsync(temporary.fileno())
        os.chmod(temporary_path, file_mode)
        os.replace(temporary_path, path)
    finally:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink()


def add_unit_to_data(source, name, members):
    name = name.strip() if isinstance(name, str) else ""
    if (
        not name
        or len(name) > 60
        or "<" in name
        or ">" in name
        or any(ord(char) < 32 or ord(char) == 127 for char in name)
    ):
        raise ValueError("Invalid unit name")
    if name in {"__proto__", "constructor", "prototype"}:
        raise ValueError("Reserved unit name")
    if not isinstance(members, list) or not 2 <= len(members) <= 52:
        raise ValueError("Select between 2 and 52 idols")
    if any(not isinstance(member, str) for member in members) or len(set(members)) != len(members):
        raise ValueError("Unit members must be unique idol names")
    valid_idols = _idol_names(source)
    if any(member not in valid_idols for member in members):
        raise ValueError("Unknown idol")

    opening, closing = _raw_units_bounds(source)
    existing_names = _unit_names_from_source(source, opening, closing)
    if name in existing_names:
        raise KeyError("Unit name already exists")

    names_match, custom_names = _custom_names_line(source)
    if name in custom_names:
        raise KeyError("Unit name already exists")

    line_ending = "\r\n" if "\r\n" in source else "\n"
    body = source[opening + 1:closing]
    trimmed_body = body.rstrip()
    trailing_whitespace = body[len(trimmed_body):]
    comma = "," if trimmed_body and not trimmed_body.endswith(",") else ""
    entry = "    " + json.dumps(name, ensure_ascii=False) + ": " + json.dumps(members, ensure_ascii=False)
    updated_body = trimmed_body + comma + line_ending + entry + trailing_whitespace
    updated_source = source[:opening + 1] + updated_body + source[closing:]

    updated_names = custom_names + [name]
    names_line = "const CUSTOM_UNIT_NAMES = " + json.dumps(updated_names, ensure_ascii=False) + ";"
    updated_source, replacements = re.subn(
        r"(?m)^const CUSTOM_UNIT_NAMES = [^;\r\n]+;?(?P<ending>\r?\n|$)",
        lambda match: names_line + match.group("ending"),
        updated_source,
        count=1,
    )
    if replacements != 1:
        raise ValueError("Could not update CUSTOM_UNIT_NAMES")
    return updated_source


class MahjongRequestHandler(SimpleHTTPRequestHandler):
    server_version = "MillijongLocal/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def guess_type(self, path):
        if path.lower().endswith(".js"):
            return "text/javascript"
        return super().guess_type(path)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        if urlsplit(self.path).path.endswith(".js"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def translate_path(self, path):
        relative = unquote(urlsplit(path).path).lstrip("/")
        target = ROOT.joinpath(*Path(relative).parts).resolve()
        if not target.is_relative_to(ROOT):
            return str(ROOT / "__forbidden__")
        return str(target)

    def _send_json(self, status, payload, cookie=None):
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(encoded)

    def _read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("Invalid content length")
        if length < 1 or length > MAX_BODY_BYTES:
            raise ValueError("Invalid request size")
        try:
            payload = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ValueError("Invalid JSON")
        if not isinstance(payload, dict):
            raise ValueError("JSON object required")
        return payload

    def _same_origin(self):
        origin = self.headers.get("Origin", "")
        parsed = urlsplit(origin)
        return (
            parsed.scheme == "http"
            and parsed.hostname in {"localhost", "127.0.0.1"}
            and parsed.port == self.server.server_port
        )

    def _client_key(self):
        return self.client_address[0]

    def _session(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
            token = cookie[SESSION_COOKIE].value
        except Exception:
            return None
        expires = SESSIONS.get(token, 0)
        if expires <= time.monotonic():
            SESSIONS.pop(token, None)
            return None
        SESSIONS[token] = time.monotonic() + SESSION_SECONDS
        return token

    def do_GET(self):
        if urlsplit(self.path).path == "/api/health":
            self._send_json(200, {"ok": True})
            return
        super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        if path not in {"/api/login", "/api/units"}:
            self._send_json(404, {"error": "Not found"})
            return
        if not self._same_origin():
            self._send_json(403, {"error": "Invalid origin"})
            return

        try:
            payload = self._read_json()
        except ValueError as error:
            self._send_json(400, {"error": str(error)})
            return

        if path == "/api/login":
            self._login(payload)
        else:
            self._add_unit(payload)

    def _login(self, payload):
        now = time.monotonic()
        client_key = self._client_key()
        failures = [stamp for stamp in LOGIN_FAILURES.get(client_key, []) if now - stamp < LOGIN_WINDOW_SECONDS]
        LOGIN_FAILURES[client_key] = failures
        if len(failures) >= MAX_LOGIN_FAILURES:
            self._send_json(429, {"error": "Too many attempts"})
            return

        first = payload.get("passwordOne")
        second = payload.get("passwordTwo")
        valid = (
            isinstance(first, str)
            and isinstance(second, str)
            and hmac.compare_digest(hashlib.sha256(first.encode("utf-8")).digest(), self.server.password_hashes[0])
            and hmac.compare_digest(hashlib.sha256(second.encode("utf-8")).digest(), self.server.password_hashes[1])
        )
        if not valid:
            failures.append(now)
            LOGIN_FAILURES[client_key] = failures
            self._send_json(401, {"error": "Authentication failed"})
            return

        LOGIN_FAILURES.pop(client_key, None)
        token = secrets.token_urlsafe(32)
        SESSIONS[token] = now + SESSION_SECONDS
        cookie = f"{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={SESSION_SECONDS}"
        self._send_json(200, {"ok": True}, cookie)

    def _add_unit(self, payload):
        if not self._session():
            self._send_json(401, {"error": "Authentication required"})
            return
        try:
            source = DATA_FILE.read_bytes().decode("utf-8")
            updated = add_unit_to_data(source, payload.get("name"), payload.get("members"))
            _atomic_write(DATA_FILE, updated)
            custom_units = _extract_custom_units(updated)
        except KeyError:
            self._send_json(409, {"error": "Unit already exists"})
            return
        except (OSError, UnicodeDecodeError, ValueError, json.JSONDecodeError) as error:
            status = 400 if isinstance(error, ValueError) else 500
            self._send_json(status, {"error": str(error) if status == 400 else "Unable to update data.js"})
            return
        self._send_json(200, {"ok": True, "customUnits": custom_units})


def main():
    password_one = os.environ.get("UNIT_EDITOR_PASSWORD_ONE", "")
    password_two = os.environ.get("UNIT_EDITOR_PASSWORD_TWO", "")
    try:
        if not password_one:
            password_one = getpass.getpass("Unit editor password 1 (12+ characters): ")
        if not password_two:
            password_two = getpass.getpass("Unit editor password 2 (12+ characters): ")
    except (EOFError, OSError):
        print("Set UNIT_EDITOR_PASSWORD_ONE and UNIT_EDITOR_PASSWORD_TWO for non-interactive startup.", file=sys.stderr)
        return 2
    if len(password_one) < 12 or len(password_two) < 12:
        print("Set UNIT_EDITOR_PASSWORD_ONE and UNIT_EDITOR_PASSWORD_TWO to separate passwords of at least 12 characters.", file=sys.stderr)
        return 2
    if hmac.compare_digest(hashlib.sha256(password_one.encode()).digest(), hashlib.sha256(password_two.encode()).digest()):
        print("The two unit editor passwords must be different.", file=sys.stderr)
        return 2

    host = os.environ.get("MILLIJONG_HOST", "127.0.0.1")
    port = int(os.environ.get("MILLIJONG_PORT", "8765"))
    server = ThreadingHTTPServer((host, port), MahjongRequestHandler)
    server.password_hashes = (
        hashlib.sha256(password_one.encode("utf-8")).digest(),
        hashlib.sha256(password_two.encode("utf-8")).digest(),
    )
    print(f"Millijong server running at http://{host}:{port}/")
    print("Keep this server bound to localhost unless it is protected by HTTPS and a trusted reverse proxy.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())