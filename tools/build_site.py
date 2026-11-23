from __future__ import annotations

import hashlib
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
TOP_LEVEL = ("index.html", "manifest.webmanifest", "icon.svg", "sw.js")
DIRECTORIES = ("css", "js", "assets")

# Only trim indentation in plain JS. Newlines carry automatic-semicolon
# semantics, and whitespace in template literals / continued strings is data.
CSS_LITERAL = re.compile(r"""('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|/\*.*?\*/)""", re.S)


def production_bytes(source: Path) -> bytes:
    if source.suffix not in {".css", ".js"}:
        return source.read_bytes()
    text = source.read_text(encoding="utf-8")
    if source.suffix == ".js":
        if chr(96) not in text and not re.search(r"\\\n", text):
            text = re.sub(r"^[ \t]+", "", text, flags=re.M)
    else:
        parts = CSS_LITERAL.split(text)
        for index in range(0, len(parts), 2):
            # Whitespace around these delimiters never denotes a descendant
            # selector. Keep spaces around combinators, functions and math.
            parts[index] = re.sub(r"\s*([{};])\s*", r"\1", parts[index])
        text = "".join(parts)
    return text.encode("utf-8")


def build() -> None:
    DIST.mkdir(parents=True, exist_ok=True)
    sources = [ROOT / name for name in TOP_LEVEL]
    sources.extend(source for directory in DIRECTORIES for source in
                   sorted((ROOT / directory).rglob("*")) if source.is_file())
    version = hashlib.sha256()
    for source in sources:
        version.update(source.relative_to(ROOT).as_posix().encode())
        version.update(production_bytes(source))
    for source in sources:
        output = DIST / source.relative_to(ROOT)
        output.parent.mkdir(parents=True, exist_ok=True)
        data = production_bytes(source)
        if source.name == "sw.js":
            data = data.replace(b"blockseed-expeditions-v3-dev",
                                b"blockseed-expeditions-v3-" + version.hexdigest()[:12].encode())
        output.write_bytes(data)
    print(f"prepared {DIST}")


if __name__ == "__main__":
    build()
