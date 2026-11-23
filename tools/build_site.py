from __future__ import annotations

import hashlib
import json
import re
import zlib
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


def replace_once(source: str, old: str, new: str) -> str:
    if source.count(old) != 1:
        raise ValueError(f"Source marker changed: {old}")
    return source.replace(old, new)


def build(destination: Path = DIST) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    sources = [ROOT / name for name in TOP_LEVEL]
    sources.extend(source for directory in DIRECTORIES for source in
                   sorted((ROOT / directory).rglob("*")) if source.is_file())
    payload = {source.relative_to(ROOT).as_posix(): production_bytes(source) for source in sources}
    modules = {name: data.decode("utf-8") for name, data in payload.items() if name.startswith("js/")}
    for name in modules:
        del payload[name]
    archive = zlib.compress(json.dumps(modules, ensure_ascii=False, separators=(",", ":")).encode(), level=9)
    pack = "modules-" + hashlib.sha256(archive).hexdigest()[:16] + ".pack"
    payload[pack] = archive
    boot = (ROOT / "tools" / "packed-boot.js").read_text(encoding="utf-8").replace("__MODULE_PACK__", pack)
    payload["boot.js"] = boot.encode()
    payload["index.html"] = replace_once(payload["index.html"].decode(), 'src="js/main.js"', 'src="boot.js"').encode()
    sw = payload["sw.js"].decode()
    before, source_list = sw.split("const FILES = [", 1)
    source_list, after = source_list.split("];", 1)
    declared = re.findall(r"""['"]\./([^'"]+)['"]""", source_list)
    if set(declared) != (set(payload) - {"boot.js", pack}) | set(modules):
        raise ValueError("Source service worker must list all app assets and modules")
    files = sorted("./" + name for name in payload)
    sw = before + "const FILES = " + json.dumps(files) + ";" + after
    sw = replace_once(sw, "cache => cache.addAll(requests)", "async cache => {\n"
        "    await cache.addAll(requests);\n"
        f"    const archive = await cache.match('./{pack}');\n"
        "    const modules = await new Response(archive.body.pipeThrough(new DecompressionStream('deflate'))).json();\n"
        "    await Promise.all(Object.entries(modules).map(([name, source]) =>\n"
        "      cache.put('./' + name, new Response(source, {headers: {'Content-Type': 'text/javascript; charset=utf-8'}}))));\n"
        "  }")
    sw += "\nself.addEventListener('message', e => { if (e.data === 'blockseed:release') e.ports[0]?.postMessage(CACHE); });\n"
    payload["sw.js"] = sw.encode()
    version = hashlib.sha256()
    for name, data in sorted(payload.items()):
        version.update(name.encode())
        version.update(data)
    cache = "blockseed-expeditions-v3-" + version.hexdigest()[:12]
    payload["boot.js"] = replace_once(boot, "__CACHE_NAME__", cache).encode()
    payload["sw.js"] = replace_once(sw, "blockseed-expeditions-v3-dev", cache).encode()
    for name, data in payload.items():
        output = destination / name
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(data)
    # Only remove artifacts produced by this build or its loose-module predecessor.
    for name in modules:
        (destination / name).unlink(missing_ok=True)
    for old in destination.glob("modules-*.pack"):
        if old.name != pack and re.fullmatch(r"modules-[a-f0-9]{16}\.pack", old.name):
            old.unlink()
    print(f"prepared {destination}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DIST)
    build(parser.parse_args().output)
