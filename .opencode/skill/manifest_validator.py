"""Validate the PWA web manifest against the basics that matter for installability.

This is intentionally lightweight (no spec compliance suite). It checks:
- Required fields (name, short_name, start_url, display, icons).
- Icons reference files that actually exist on disk.
- At least one 192x192 and one 512x512 icon are present.
- A maskable icon exists (purpose contains 'maskable').

The manifest is generated at build time by vite-plugin-pwa from `vite.config.ts`,
so this script parses the manifest object out of that file with a tolerant regex,
then walks the icons[] array against the filesystem.

Usage:
    python3 .opencode/skill/manifest_validator.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
VITE_CONFIG = REPO_ROOT / "vite.config.ts"
PUBLIC_DIR = REPO_ROOT / "public"


def warn(msg: str) -> None:
    print(f"⚠️  {msg}")


def error(msg: str) -> None:
    print(f"❌ {msg}")


def ok(msg: str) -> None:
    print(f"✅ {msg}")


def main() -> int:
    text = VITE_CONFIG.read_text(encoding="utf-8")

    failures = 0

    for field in ("name", "short_name", "start_url", "display"):
        if f"{field}:" not in text:
            error(f"Manifest missing field: {field}")
            failures += 1
        else:
            ok(f"Manifest declares {field}")

    icon_srcs = re.findall(r"src:\s*'([^']+)'", text)
    icon_srcs = [s for s in icon_srcs if "manifest-icons" in s or s.endswith(".png")]
    if not icon_srcs:
        error("No PWA icons declared in manifest")
        failures += 1
    else:
        for src in icon_srcs:
            p = PUBLIC_DIR / src
            if p.exists():
                ok(f"Icon exists: public/{src}")
            else:
                warn(f"Icon declared but missing on disk: public/{src} "
                     f"(falls back to browser default until you add it)")

    if not any("192x192" in line for line in text.splitlines()):
        warn("No 192x192 icon size declared")
    if not any("512x512" in line for line in text.splitlines()):
        warn("No 512x512 icon size declared")
    if "maskable" not in text:
        warn("No maskable icon declared (Android adaptive icons will be cropped)")

    if failures:
        print(f"\n❌ {failures} required check(s) failed.")
        return 1
    print("\n✅ Manifest passes required checks.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
