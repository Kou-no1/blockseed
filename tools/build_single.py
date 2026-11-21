from __future__ import annotations

import base64
import json
import mimetypes
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dist" / "blockseed-single.html"
IMPORT_RE = re.compile(r"(?:import\s+(?:[^'\"]+?\s+from\s+)?|import\s*\()(['\"])(\.[^'\"]+)\1")


def resolve_module(parent: str, specifier: str) -> str:
    path = (Path(parent).parent / specifier).as_posix()
    parts: list[str] = []
    for part in path.split("/"):
        if part == "..":
            parts.pop()
        elif part != ".":
            parts.append(part)
    return "/".join(parts)


def collect_module(name: str, sources: dict[str, str]) -> None:
    if name in sources:
        return
    source = (ROOT / name).read_text(encoding="utf-8")
    sources[name] = source
    for match in IMPORT_RE.finditer(source):
        collect_module(resolve_module(name, match.group(2)), sources)


def data_uri(path: Path) -> str:
    media_type = "image/webp" if path.suffix.lower() == ".webp" else mimetypes.guess_type(path.name)[0]
    if media_type is None:
        raise ValueError(f"Unknown media type: {path.name}")
    return f"data:{media_type};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def inline_stylesheet(match: re.Match) -> str:
    tag = match.group()
    filename = re.search(r'href="([^"]+)"', tag).group(1)
    media = re.search(r' media="[^"]+"', tag)
    path = ROOT / filename
    css = path.read_text(encoding="utf-8")

    def inline_resource(url: re.Match) -> str:
        name = url.group(2)
        if name.startswith(("data:", "#")):
            return url.group()
        return 'url("' + data_uri(path.parent / name) + '")'

    css = re.sub(r"""url\(\s*(['"]?)([^'")]+)\1\s*\)""", inline_resource, css)
    return '<style' + (media.group() if media else '') + '>' + css.replace("</style>", "<\\/style>") + '</style>'


def build() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html = re.sub(r'<link rel="stylesheet"[^>]+>', inline_stylesheet, html)
    html = re.sub(r"\s*<link rel=\"manifest\"[^>]+>", "", html)
    html = html.replace('<html ', '<html data-standalone ')
    html = re.sub(r'(src|href)="(assets/[^"]+|icon\.svg)"', lambda m: m[1] + '="' + data_uri(ROOT / m[2]) + '"', html)
    html = re.sub(r"\s*<script type=\"module\" src=\"js/main.js\"></script>", "", html)
    sources: dict[str, str] = {}
    collect_module("js/main.js", sources)
    bootstrap = """
<script>
(function () {
  const sources = __SOURCES__;
  const urls = {};
  function normalize(parent, child) {
    const parts = parent.split('/'); parts.pop();
    child.split('/').forEach(function (part) { if (part === '..') parts.pop(); else if (part !== '.') parts.push(part); });
    return parts.join('/');
  }
  function make(name) {
    if (urls[name]) return urls[name];
    let source = sources[name];
    source = source.replace(/(import\\s+(?:[^'\"]+?\\s+from\\s+)?|import\\s*\\()(['\"])(\\.[^'\"]+)\\2/g, function (_, lead, quote, spec) {
      return lead + quote + make(normalize(name, spec)) + quote;
    });
    urls[name] = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    return urls[name];
  }
  import(make('js/main.js'));
}());
</script>
""".replace("__SOURCES__", json.dumps(sources, ensure_ascii=False).replace("</", "<\\/"))
    html = html.replace("</body>", bootstrap + "</body>")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    build()
