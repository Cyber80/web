# Workload Calendar Sandbox

แอปต้นแบบสำหรับทดสอบระบบ "บันทึกภาระงาน + Google Login + Google Calendar Sync"
ก่อนนำไป deploy จริง

## ความสามารถ
- Login ด้วย Google OAuth 2.0
- โหมด Sandbox Login สำหรับทดสอบ UI โดยไม่ต้องสร้าง Google OAuth
- เพิ่ม / แก้ไข / ลบภาระงาน
- กำหนดเป็น Private หรือ Public
- บันทึกข้อมูลลง SQLite
- ออกแบบ `external_event_id` เพื่อรองรับ sync กับ Google Calendar ในอนาคต
- Sync งานไป Google Calendar
- เมื่อแก้ไข/ลบงานจากแอป จะ update/delete event ที่เคย sync
- รองรับการกำหนด Google Calendar ID ผ่าน environment variable

## โครงสร้าง
- `app.py` - FastAPI backend + Google OAuth + CRUD + Calendar sync
- `static/index.html` - หน้าเว็บ
- `static/app.js` - frontend logic
- `static/style.css` - UI
- `.env.example` - ตัวแปรระบบ

## เริ่มแบบ Sandbox
ต้องมี Python 3.11+

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

เปิด `http://localhost:8000`

Sandbox login:
- กด "เข้าสู่ระบบแบบ Sandbox"
- ใช้ทดสอบ CRUD และ UI ได้ทันที

## เปิด Google Login จริง
1. สร้าง OAuth 2.0 Client ID แบบ Web application ใน Google Cloud Console
2. เพิ่ม Authorized redirect URI:
   `http://localhost:8000/auth/google/callback`
3. ใส่ค่าใน `.env`
4. Restart server
5. กด "เข้าสู่ระบบด้วย Google"

Scopes ที่ใช้:
- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/calendar.events`

## แนวทางก่อน Production
- เปลี่ยน `SESSION_SECRET`
- ใช้ PostgreSQL แทน SQLite
- ใช้ HTTPS
- เก็บ OAuth secret ใน Secret Manager
- จำกัด domain ของ Google Workspace ถ้าต้องการเฉพาะบัญชีโรงเรียน
- เพิ่ม role/permission เช่น admin, staff
- เพิ่ม audit log
- เพิ่ม background sync queue และ retry
- เพิ่ม Google webhook/push notification หากต้องการ sync แบบสองทางจริง
