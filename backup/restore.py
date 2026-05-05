#!/usr/bin/env python3
"""
============================================================
 ProSticker ERP - Restore Script
 Restores a backup created by backup_local.ps1 or backup_server.sh

 Usage:
   python restore.py --list                          # show available backups
   python restore.py --file backup_2026-05-04.zip   # restore specific backup
   python restore.py --latest                        # restore newest backup
   python restore.py --latest --skip-db             # skip database restore
============================================================
"""

import os
import sys
import shutil
import argparse
import subprocess
import zipfile
import tarfile
from pathlib import Path
from datetime import datetime

# ── Config ──────────────────────────────────────────────────
PROJECT_ROOT = Path("D:/saas/erp")
BACKUP_ROOT  = Path("D:/saas/erp-backups")
BACKEND_DIR  = PROJECT_ROOT / "backend"


def list_backups():
    backups = sorted(BACKUP_ROOT.glob("backup_*.zip")) + sorted(BACKUP_ROOT.glob("backup_*.tar.gz"))
    if not backups:
        print("No backups found in", BACKUP_ROOT)
        return []
    print(f"\nAvailable backups in {BACKUP_ROOT}:\n")
    for i, b in enumerate(backups, 1):
        size_mb = round(b.stat().st_size / 1024 / 1024, 2)
        mtime = datetime.fromtimestamp(b.stat().st_mtime).strftime("%Y-%m-%d %H:%M")
        print(f"  [{i:02d}] {b.name:55s} {size_mb:6.2f} MB  ({mtime})")
    print()
    return backups


def extract_backup(backup_path: Path, extract_to: Path):
    """Extract zip or tar.gz backup."""
    print(f"  Extracting {backup_path.name} -> {extract_to}")
    extract_to.mkdir(parents=True, exist_ok=True)
    if backup_path.suffix == ".zip":
        with zipfile.ZipFile(backup_path, "r") as z:
            z.extractall(extract_to)
    elif backup_path.name.endswith(".tar.gz"):
        with tarfile.open(backup_path, "r:gz") as t:
            t.extractall(extract_to)
    else:
        raise ValueError(f"Unknown backup format: {backup_path}")


def restore_sqlite(extract_dir: Path, skip: bool):
    src = extract_dir / "db.sqlite3"
    dest = BACKEND_DIR / "db.sqlite3"
    if skip or not src.exists():
        print("  [SKIP] SQLite restore")
        return
    confirm = input(f"\n  WARNING: This will overwrite {dest}. Continue? [y/N] ")
    if confirm.lower() != "y":
        print("  [SKIP] SQLite restore (cancelled)")
        return
    if dest.exists():
        shutil.copy2(dest, str(dest) + ".before_restore")
        print(f"  Backed up current db to db.sqlite3.before_restore")
    shutil.copy2(src, dest)
    print(f"  OK  SQLite restored -> {dest}")


def restore_media(extract_dir: Path, skip: bool):
    src = extract_dir / "media"
    dest = BACKEND_DIR / "media"
    if skip or not src.exists():
        print("  [SKIP] Media restore")
        return
    confirm = input(f"\n  WARNING: This will overwrite {dest}. Continue? [y/N] ")
    if confirm.lower() != "y":
        print("  [SKIP] Media restore (cancelled)")
        return
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src, dest)
    file_count = sum(1 for _ in dest.rglob("*") if _.is_file())
    print(f"  OK  Media restored ({file_count} files) -> {dest}")


def restore_designs(extract_dir: Path, skip: bool):
    src = extract_dir / "designs"
    dest = BACKEND_DIR / "designs"
    if skip or not src.exists():
        print("  [SKIP] Designs restore")
        return
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src, dest)
    file_count = sum(1 for _ in dest.rglob("*") if _.is_file())
    print(f"  OK  Designs restored ({file_count} files) -> {dest}")


def restore_config(extract_dir: Path, skip: bool):
    config_dir = extract_dir / "config"
    if skip or not config_dir.exists():
        print("  [SKIP] Config restore")
        return

    mapping = {
        "root.env":          PROJECT_ROOT / ".env",
        "backend.env":       BACKEND_DIR  / ".env",
        "credentials.json":  BACKEND_DIR  / "credentials.json",
    }

    confirm = input(f"\n  WARNING: This will overwrite .env files. Continue? [y/N] ")
    if confirm.lower() != "y":
        print("  [SKIP] Config restore (cancelled)")
        return

    for name, dest in mapping.items():
        src = config_dir / name
        if src.exists():
            if dest.exists():
                shutil.copy2(dest, str(dest) + ".before_restore")
            shutil.copy2(src, dest)
            print(f"  OK  {name} -> {dest}")
        else:
            print(f"  SKIP  {name} not in backup")


def main():
    parser = argparse.ArgumentParser(description="ProSticker ERP Restore Tool")
    parser.add_argument("--list",       action="store_true", help="List available backups")
    parser.add_argument("--file",       type=str,  help="Path to backup file")
    parser.add_argument("--latest",     action="store_true", help="Use the most recent backup")
    parser.add_argument("--skip-db",    action="store_true", help="Skip database restore")
    parser.add_argument("--skip-media", action="store_true", help="Skip media files restore")
    parser.add_argument("--skip-config",action="store_true", help="Skip config/.env restore")
    args = parser.parse_args()

    if args.list or (not args.file and not args.latest):
        list_backups()
        return

    # Find backup file
    if args.latest:
        backups = sorted(BACKUP_ROOT.glob("backup_*.zip")) + sorted(BACKUP_ROOT.glob("backup_*.tar.gz"))
        if not backups:
            print("ERROR: No backups found in", BACKUP_ROOT)
            sys.exit(1)
        backup_path = sorted(backups, key=lambda f: f.stat().st_mtime)[-1]
    else:
        backup_path = Path(args.file)
        if not backup_path.is_absolute():
            backup_path = BACKUP_ROOT / backup_path

    if not backup_path.exists():
        print(f"ERROR: Backup file not found: {backup_path}")
        sys.exit(1)

    print(f"\n========================================")
    print(f"  Restoring: {backup_path.name}")
    print(f"========================================\n")

    # Extract to temp dir
    extract_dir = BACKUP_ROOT / "_restore_temp"
    if extract_dir.exists():
        shutil.rmtree(extract_dir)

    try:
        extract_backup(backup_path, extract_dir)

        print("\n[1/4] Restoring SQLite database...")
        restore_sqlite(extract_dir, args.skip_db)

        print("\n[2/4] Restoring media files...")
        restore_media(extract_dir, args.skip_media)

        print("\n[3/4] Restoring designs folder...")
        restore_designs(extract_dir, False)

        print("\n[4/4] Restoring config files...")
        restore_config(extract_dir, args.skip_config)

        print("\n========================================")
        print("  Restore Complete!")
        print("  Remember to restart the backend server.")
        print("========================================\n")

    finally:
        if extract_dir.exists():
            shutil.rmtree(extract_dir)


if __name__ == "__main__":
    main()
