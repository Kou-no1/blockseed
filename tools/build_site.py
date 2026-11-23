from __future__ import annotations

import hashlib
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
TOP_LEVEL = ("index.html", "manifest.webmanifest", "icon.svg", "sw.js")
DIRECTORIES = ("css", "js", "assets")

CSS_LITERAL = re.compile(r"""('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|/\*.*?\*/)""", re.S)
JS_STRING = re.compile(r"""('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")""")
JS_DELIMITER = re.compile(r"[ \t]*([,;(){}\[\]:])[ \t]*")
JS_SPACED_OPERATOR = re.compile(r" (===|!==|==|!=|=>|&&|\|\||=) ")


def compact_module(text: str) -> str:
    # Leave files with multiline literals or block comments untouched. For
    # plain modules, preserve every newline and skip lines that may contain a
    # regex or a comment. Only compact punctuation outside quoted strings.
    if "`" in text or "/*" in text or "\\\n" in text:
        return text
    lines = text.split("\n")
    for index, original in enumerate(lines):
        line = original.lstrip(" \t")
        if "/" not in line:
            parts = JS_STRING.split(line)
            for part in range(0, len(parts), 2):
                plain = JS_SPACED_OPERATOR.sub(r"\1", parts[part])
                parts[part] = JS_DELIMITER.sub(r"\1", plain)
            line = "".join(parts)
        lines[index] = line
    return "\n".join(lines)


def production_bytes(source: Path) -> bytes:
    if source.suffix not in {".css", ".js"}:
        return source.read_bytes()
    text = source.read_text(encoding="utf-8")
    if source.suffix == ".js":
        if source.name != "sw.js":
            text = compact_module(text)
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
