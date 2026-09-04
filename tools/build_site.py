from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
TOP_LEVEL = ("index.html", "manifest.webmanifest", "icon.svg", "sw.js")
DIRECTORIES = ("css", "js")


def build() -> None:
    DIST.mkdir(parents=True, exist_ok=True)
    for name in TOP_LEVEL:
        shutil.copy2(ROOT / name, DIST / name)
    for name in DIRECTORIES:
        target = DIST / name
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(ROOT / name, target)
    print(f"prepared {DIST}")


if __name__ == "__main__":
    build()
