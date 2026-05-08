import os
import shutil
import zipfile
import subprocess
from pathlib import Path
from datetime import datetime

from django.conf import settings as django_settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from apps.accounts.permissions import IsAdminOrManager


_default_backup_root = str(django_settings.BASE_DIR.parent / "erp-backups")
BACKUP_ROOT = Path(os.environ.get("BACKUP_DIR", _default_backup_root))
BACKEND_DIR = django_settings.BASE_DIR
PROJECT_ROOT = BACKEND_DIR.parent


def _get_backup_list():
    BACKUP_ROOT.mkdir(parents=True, exist_ok=True)
    files = sorted(BACKUP_ROOT.glob("backup_*.zip"), key=lambda f: f.stat().st_mtime, reverse=True)
    result = []
    for f in files:
        stat = f.stat()
        result.append({
            "name": f.name,
            "size_bytes": stat.st_size,
            "size_mb": round(stat.st_size / 1024 / 1024, 2),
            "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })
    return result


class BackupListView(APIView):
    """GET  /api/backup/          → list all backup files
       POST /api/backup/create/   → trigger a new backup now"""
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def get(self, request):
        backups = _get_backup_list()
        total_size = sum(b["size_bytes"] for b in backups)
        return Response({
            "backups": backups,
            "count": len(backups),
            "total_size_mb": round(total_size / 1024 / 1024, 2),
            "backup_root": str(BACKUP_ROOT),
        })


class BackupCreateView(APIView):
    """POST /api/backup/create/ → run backup now"""
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request):
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        backup_dir = BACKUP_ROOT / timestamp
        zip_path = BACKUP_ROOT / f"backup_{timestamp}.zip"

        try:
            BACKUP_ROOT.mkdir(parents=True, exist_ok=True)
            backup_dir.mkdir(parents=True, exist_ok=True)

            items_backed = []

            # 1. SQLite DB
            sqlite_src = BACKEND_DIR / "db.sqlite3"
            if sqlite_src.exists():
                shutil.copy2(sqlite_src, backup_dir / "db.sqlite3")
                items_backed.append("SQLite DB")

            # 2. Media files
            media_src = BACKEND_DIR / "media"
            if media_src.exists():
                shutil.copytree(media_src, backup_dir / "media")
                items_backed.append("Media files")

            # 3. Designs folder
            designs_src = BACKEND_DIR / "designs"
            if designs_src.exists():
                shutil.copytree(designs_src, backup_dir / "designs")
                items_backed.append("Designs")

            # 4. Config & secrets
            config_dir = backup_dir / "config"
            config_dir.mkdir(exist_ok=True)
            config_files = [
                (PROJECT_ROOT / ".env",                    "root.env"),
                (BACKEND_DIR / ".env",                     "backend.env"),
                (BACKEND_DIR / "credentials.json",         "credentials.json"),
                (PROJECT_ROOT / "docker-compose.yml",      "docker-compose.yml"),
                (PROJECT_ROOT / "nginx" / "nginx.conf",    "nginx.conf"),
            ]
            for src, name in config_files:
                if src.exists():
                    shutil.copy2(src, config_dir / name)
            items_backed.append("Config & secrets")

            # Compress to zip
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                for file in backup_dir.rglob("*"):
                    zf.write(file, file.relative_to(backup_dir))

            # Remove temp dir
            shutil.rmtree(backup_dir)

            size_mb = round(zip_path.stat().st_size / 1024 / 1024, 2)

            return Response({
                "success": True,
                "filename": zip_path.name,
                "size_mb": size_mb,
                "items": items_backed,
                "created_at": datetime.now().isoformat(),
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            # Cleanup on failure
            if backup_dir.exists():
                shutil.rmtree(backup_dir, ignore_errors=True)
            if zip_path.exists():
                zip_path.unlink(missing_ok=True)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BackupDeleteView(APIView):
    """DELETE /api/backup/<filename>/ → delete a backup file"""
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def delete(self, request, filename):
        # Security: only allow backup_*.zip filenames
        if not filename.startswith("backup_") or not filename.endswith(".zip"):
            return Response({"error": "Invalid filename"}, status=status.HTTP_400_BAD_REQUEST)

        file_path = BACKUP_ROOT / filename
        if not file_path.exists():
            return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

        file_path.unlink()
        return Response({"success": True, "deleted": filename})


class BackupDownloadView(APIView):
    """GET /api/backup/<filename>/download/ → stream file as download"""
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def get(self, request, filename):
        if not filename.startswith("backup_") or not filename.endswith(".zip"):
            return Response({"error": "Invalid filename"}, status=status.HTTP_400_BAD_REQUEST)

        file_path = BACKUP_ROOT / filename
        if not file_path.exists():
            return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)

        from django.http import FileResponse
        response = FileResponse(
            open(file_path, "rb"),
            content_type="application/zip",
            as_attachment=True,
            filename=filename,
        )
        # Explicit headers so browser saves with correct filename and extension
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Content-Type"] = "application/zip"
        response["X-Filename"] = filename
        return response


class BackupStatsView(APIView):
    """GET /api/backup/stats/ → disk usage stats"""
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def get(self, request):
        backups = _get_backup_list()

        # Disk usage of key directories
        def dir_size_mb(path: Path):
            if not path.exists():
                return 0
            total = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
            return round(total / 1024 / 1024, 2)

        return Response({
            "backup_count": len(backups),
            "total_backup_size_mb": round(sum(b["size_bytes"] for b in backups) / 1024 / 1024, 2),
            "db_size_mb": round((BACKEND_DIR / "db.sqlite3").stat().st_size / 1024 / 1024, 2)
                           if (BACKEND_DIR / "db.sqlite3").exists() else 0,
            "media_size_mb": dir_size_mb(BACKEND_DIR / "media"),
            "designs_size_mb": dir_size_mb(BACKEND_DIR / "designs"),
            "latest_backup": backups[0] if backups else None,
        })


class BackupImportView(APIView):
    """POST /api/backup/import/
    Upload a .zip backup file from outside → saves it into BACKUP_ROOT.
    Accepts multipart/form-data with field 'file'.
    """
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request):
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate it looks like a backup zip
        if not uploaded.name.endswith(".zip"):
            return Response({"error": "Only .zip backup files are accepted."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate it is actually a zip
        import io
        content = uploaded.read()
        if not zipfile.is_zipfile(io.BytesIO(content)):
            return Response({"error": "File is not a valid ZIP archive."}, status=status.HTTP_400_BAD_REQUEST)

        # Force the filename to be safe: backup_<timestamp>.zip
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        # Keep original name if it matches pattern, else rename
        import re
        safe_name = uploaded.name if re.match(r"^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.zip$", uploaded.name) \
                    else f"backup_imported_{timestamp}.zip"

        BACKUP_ROOT.mkdir(parents=True, exist_ok=True)
        dest_path = BACKUP_ROOT / safe_name

        with open(dest_path, "wb") as f:
            f.write(content)

        size_mb = round(dest_path.stat().st_size / 1024 / 1024, 2)
        return Response({
            "success": True,
            "filename": safe_name,
            "size_mb": size_mb,
            "message": f"Backup imported successfully as {safe_name}",
        }, status=status.HTTP_201_CREATED)


class BackupRestoreView(APIView):
    """POST /api/backup/<filename>/restore/
    Restores a backup: DB, media, designs, config.
    Body JSON: { restore_db, restore_media, restore_config } (all default true)
    """
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    def post(self, request, filename):
        if not filename.startswith("backup_") or not filename.endswith(".zip"):
            return Response({"error": "Invalid filename"}, status=status.HTTP_400_BAD_REQUEST)

        zip_path = BACKUP_ROOT / filename
        if not zip_path.exists():
            return Response({"error": "Backup file not found."}, status=status.HTTP_404_NOT_FOUND)

        restore_db     = request.data.get("restore_db",     True)
        restore_media  = request.data.get("restore_media",  True)
        restore_config = request.data.get("restore_config", False)  # default off for safety

        extract_dir = BACKUP_ROOT / "_restore_temp"
        restored_items = []
        errors = []

        try:
            # Clean and extract
            if extract_dir.exists():
                shutil.rmtree(extract_dir)
            extract_dir.mkdir(parents=True)

            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(extract_dir)

            # 1. Restore SQLite DB
            if restore_db:
                db_src = extract_dir / "db.sqlite3"
                if db_src.exists():
                    db_dest = BACKEND_DIR / "db.sqlite3"
                    if db_dest.exists():
                        shutil.copy2(db_dest, str(db_dest) + ".pre_restore_bak")
                    shutil.copy2(db_src, db_dest)
                    restored_items.append("SQLite DB")
                else:
                    errors.append("db.sqlite3 not found in backup")

            # 2. Restore media files
            if restore_media:
                media_src = extract_dir / "media"
                if media_src.exists():
                    media_dest = BACKEND_DIR / "media"
                    if media_dest.exists():
                        shutil.rmtree(media_dest)
                    shutil.copytree(media_src, media_dest)
                    file_count = sum(1 for _ in media_dest.rglob("*") if _.is_file())
                    restored_items.append(f"Media files ({file_count} files)")
                else:
                    errors.append("media/ not found in backup")

            # 3. Restore designs
            designs_src = extract_dir / "designs"
            if designs_src.exists():
                designs_dest = BACKEND_DIR / "designs"
                if designs_dest.exists():
                    shutil.rmtree(designs_dest)
                shutil.copytree(designs_src, designs_dest)
                restored_items.append("Designs")

            # 4. Restore config (optional, off by default)
            if restore_config:
                config_dir = extract_dir / "config"
                mapping = {
                    "root.env":          PROJECT_ROOT / ".env",
                    "backend.env":       BACKEND_DIR  / ".env",
                    "credentials.json":  BACKEND_DIR  / "credentials.json",
                }
                for name, dest in mapping.items():
                    src = config_dir / name
                    if src.exists():
                        if dest.exists():
                            shutil.copy2(dest, str(dest) + ".pre_restore_bak")
                        shutil.copy2(src, dest)
                restored_items.append("Config files")

            return Response({
                "success": True,
                "restored": restored_items,
                "warnings": errors,
                "message": "Restore complete. Restart the backend server to apply DB changes.",
            })

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        finally:
            if extract_dir.exists():
                shutil.rmtree(extract_dir, ignore_errors=True)
