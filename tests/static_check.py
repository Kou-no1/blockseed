from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
SW = (DIST / "sw.js").read_text(encoding="utf-8")
FILES = re.findall(r"['\"]\./([^'\"]+)['\"]", SW.split("const FILES = [", 1)[1].split("];", 1)[0])
errors: list[str] = []
if len(FILES) != len(set(FILES)):
    errors.append("duplicate URL in precache")

for name in FILES:
    path = DIST / ("index.html" if name == "" else name)
    if not path.exists():
        errors.append(f"missing precache file: {name}")

production = sorted(set(FILES + ["index.html", "sw.js"]))
shipped = {path.relative_to(DIST).as_posix() for path in DIST.rglob("*")
           if path.is_file() and path != DIST / "blockseed-single.html"}
for name in sorted(shipped - set(production)):
    errors.append(f"shipped file not precached: {name}")
size = sum((DIST / name).stat().st_size for name in shipped)
if size >= 300_000:
    errors.append(f"production payload is {size:,} bytes (limit 300,000)")

for name in production:
    path = DIST / name
    if not path.exists() or path.suffix.lower() not in {".html", ".css", ".js", ".webmanifest"}:
        continue
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".js":
        dependencies = re.findall(r"""\bfrom\s+['"](\.[^'"]+)['"]""", text)
    elif path.suffix == ".css":
        dependencies = re.findall(r"""url\(['"]?(\.[^'")]+)['"]?\)""", text)
    elif path.suffix == ".html":
        dependencies = re.findall(r'(?:src|href)="((?:assets/|js/|css/)[^"]+)"', text)
    else:
        dependencies = []
    for dependency in dependencies:
        asset = (path.parent / dependency).resolve().relative_to(DIST).as_posix()
        if asset not in production:
            errors.append(f"not available offline: {asset} (used in {name})")
    if re.search(r"https?://", text):
        errors.append(f"external URL in {name}")
    if re.search(r"\b(?:alert|prompt)\s*\(", text) or re.search(r"(?<![.\w])confirm\s*\(", text):
        errors.append(f"native blocking dialog in {name}")
    if re.search(r"\beval\s*\(|new\s+Function\s*\(", text):
        errors.append(f"dynamic code execution in {name}")
    if path.suffix == ".css" and re.search(r"@import|url\s*\(\s*['\"]?https?://", text):
        errors.append(f"remote CSS dependency in {name}")

print(f"production payload: {size:,} bytes")
print(f"precache entries: {len(FILES)}")
if errors:
    print("FAILED")
    for error in errors:
        print("-", error)
    sys.exit(1)
print("PASS")
