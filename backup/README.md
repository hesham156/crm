# 🗄️ ProSticker ERP - Backup System

نظام نسخ احتياطي شامل للمشروع يغطي قاعدة البيانات والملفات والإعدادات.

## 📁 الملفات

| الملف | الوظيفة |
|---|---|
| `backup_local.ps1` | نسخ احتياطي يدوي/تلقائي للـ Windows (dev) |
| `backup_server.sh` | نسخ احتياطي للـ Linux Server (production) |
| `restore.py` | استعادة أي نسخة احتياطية |
| `setup_scheduler.ps1` | تسجيل مهمة يومية تلقائية في Windows |

---

## 🖥️ الـ Local Backup (Windows)

### تشغيل يدوي
```powershell
powershell -ExecutionPolicy Bypass -File "D:\saas\erp\backup\backup_local.ps1"
```

### تشغيل مع خيارات
```powershell
# تغيير مكان الحفظ
.\backup_local.ps1 -BackupRoot "E:\my-backups"

# الاحتفاظ بـ 14 يوم بس
.\backup_local.ps1 -KeepDays 14
```

### إعداد النسخ التلقائي اليومي (مرة واحدة بصلاحيات Admin)
```powershell
powershell -ExecutionPolicy Bypass -File "D:\saas\erp\backup\setup_scheduler.ps1"
```
> يشتغل كل يوم الساعة 2:00 صباحاً تلقائياً

### ما يتم نسخه
- ✅ `db.sqlite3` - قاعدة البيانات المحلية
- ✅ `backend/media/` - الملفات المرفوعة (صور، مستندات)
- ✅ `backend/designs/` - ملفات التصميم
- ✅ `.env` files - إعدادات البيئة والـ secrets
- ✅ `credentials.json` - مفاتيح Google Drive
- ✅ `docker-compose.yml` + `nginx.conf`

### مكان الحفظ
```
D:\saas\erp-backups\
  ├── backup_2026-05-04_02-00-00.zip
  ├── backup_2026-05-03_02-00-00.zip
  └── backup.log
```

---

## 🐧 الـ Server Backup (Linux Production)

### رفع الـ Script للـ Server
```bash
scp -i procrm-key.pem backup_server.sh ubuntu@16.16.56.212:/opt/prosticker/backup/
ssh -i procrm-key.pem ubuntu@16.16.56.212 "chmod +x /opt/prosticker/backup/backup_server.sh"
```

### تشغيل يدوي
```bash
/opt/prosticker/backup/backup_server.sh
```

### إعداد Cron يومي (على الـ Server)
```bash
crontab -e
# أضف هذا السطر:
0 2 * * * /opt/prosticker/backup/backup_server.sh >> /var/log/prosticker_backup.log 2>&1
```

### ما يتم نسخه على الـ Server
- ✅ **PostgreSQL dump** مضغوط (.sql.gz)
- ✅ **MinIO bucket** - كل الملفات المخزنة
- ✅ **media volume** - الملفات المحلية
- ✅ Config files + .env

---

## 🔄 الاستعادة (Restore)

### عرض النسخ المتاحة
```bash
python backup/restore.py --list
```

### استعادة أحدث نسخة
```bash
python backup/restore.py --latest
```

### استعادة نسخة معينة
```bash
python backup/restore.py --file backup_2026-05-04_02-00-00.zip
```

### استعادة جزئية
```bash
# استعادة بدون DB
python backup/restore.py --latest --skip-db

# استعادة بدون ملفات .env
python backup/restore.py --latest --skip-config
```

> ⚠️ **تحذير:** الاستعادة ستطلب تأكيد قبل الكتابة فوق أي ملفات موجودة

---

## 📊 حجم النسخ المتوقع

| المكوّن | الحجم التقريبي |
|---|---|
| SQLite DB | ~1-5 MB |
| media files | ~يزداد مع الوقت |
| Config files | < 50 KB |
| **الإجمالي المضغوط** | **5-50 MB** |

---

## 🔐 نصائح الأمان

1. **لا ترفع الـ backups للـ Git** - مضافة في `.gitignore`
2. **احفظ نسخة خارج الجهاز** (External HDD أو Cloud Storage)
3. **اختبر الـ restore** على بيئة تجريبية بانتظام
4. **الـ .env files** تحتوي passwords - احتفظ بها في مكان آمن

---

## 🔗 نقل نسخة للـ Cloud (اختياري)

### AWS S3
```bash
aws s3 cp backup_2026-05-04.zip s3://your-bucket/erp-backups/
```

### Google Drive (عبر rclone)
```bash
rclone copy D:\saas\erp-backups\ gdrive:ERP-Backups/
```

### Backblaze B2
```bash
b2 upload-file your-bucket backup.zip erp-backups/backup.zip
```
