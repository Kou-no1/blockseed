from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dist" / "blockseed-single.html"
CSS_FILES = ["css/base.css", "css/blocks.css", "css/layout.css", "css/levels.css", "css/print.css"]
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


def build() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html = re.sub(r"\s*<link rel=\"stylesheet\"[^>]+>", "", html)
    html = re.sub(r"\s*<link rel=\"manifest\"[^>]+>", "", html)
    html = re.sub(r"\s*<script type=\"module\" src=\"js/main.js\"></script>", "", html)
    css = "\n".join((ROOT / name).read_text(encoding="utf-8") for name in CSS_FILES)
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
    html = html.replace("</head>", "<style>" + css.replace("</style>", "<\\/style>") + "</style></head>")
    html = html.replace("</body>", bootstrap + "</body>")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    build()
