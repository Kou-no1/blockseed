from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SW = (ROOT / "sw.js").read_text(encoding="utf-8")
FILES = re.findall(r"['\"]\./([^'\"]+)['\"]", SW)
errors: list[str] = []

for name in FILES:
    path = ROOT / ("index.html" if name == "" else name)
    if not path.exists():
        errors.append(f"missing precache file: {name}")

production = sorted(set(FILES + ["index.html", "sw.js"]))
size = sum((ROOT / name).stat().st_size for name in production if name and (ROOT / name).exists())
if size >= 300_000:
    errors.append(f"production payload is {size:,} bytes (limit 300,000)")

for name in production:
    path = ROOT / name
    if not path.exists() or path.suffix.lower() not in {".html", ".css", ".js", ".webmanifest"}:
        continue
    text = path.read_text(encoding="utf-8")
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
