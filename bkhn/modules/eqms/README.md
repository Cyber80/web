# EQMS

ระบบวิเคราะห์ข้อสอบสำหรับ Cloudflare Workers, Google Apps Script และ Google Sheets

## โครงสร้าง

- หน้าเว็บและ Worker อยู่ในโฟลเดอร์นี้ และ deploy เป็น Worker แยกจากระบบหลัก
- `Code.gs`, `Analysis.gs` และ `appsscript.json` คือ backend สำหรับ Apps Script
- Google Sheet ทะเบียนกลางเก็บเฉพาะ `year` และ `sheet_id`
- เมื่อเพิ่มปีผ่านหน้าเว็บ Apps Script จะสร้าง Google Sheet ของปีนั้น พร้อมแท็บ Subjects, Students, Exams, ExamParts, ExamKeys และ Responses
- การลบปีออกจาก EQMS ไม่ลบไฟล์ Google Sheet จึงกู้ข้อมูลได้

## ทดสอบในเครื่อง

ต้องใช้ Node.js 20 ขึ้นไป

```sh
npm ci
npm run check
npm run dev
```

เปิด `http://127.0.0.1:4173/bkhn/modules/eqms/` ข้อมูลในโหมดนี้เป็นข้อมูลจำลองในหน่วยความจำและไม่เขียน Google Sheets

## ตั้งค่า Apps Script

1. สร้าง Apps Script project และเพิ่ม `Code.gs`, `Analysis.gs`, `appsscript.json`
2. เรียก `SETUP_SYSTEM_AND_AUTHORIZE` หนึ่งครั้ง ระบบจะสร้างไฟล์ทะเบียนกลาง
3. เปิด Project Settings > Script Properties แล้วอ่านค่า `EQMS_SHARED_SECRET` ที่ระบบสร้างไว้ หรือเปลี่ยนเป็นค่าสุ่มยาวของคุณเอง
4. Deploy เป็น Web app โดย Execute as: Me และ Who has access: Anyone
5. เก็บ URL `/exec` ที่ได้ไว้สำหรับ Worker secret `GAS_URL`

ห้ามเก็บ URL, shared secret หรือรหัสผ่านจริงลง Git

## ตั้งค่า Cloudflare Worker

สร้าง secret ผ่าน Wrangler แบบโต้ตอบ:

```sh
npx wrangler secret put GAS_URL
npx wrangler secret put EQMS_SHARED_SECRET
npx wrangler secret put OWNER_PASSWORD
npx wrangler secret put SESSION_SECRET
```

- `OWNER_PASSWORD` ต้องมีอย่างน้อย 16 ตัวอักษร
- `SESSION_SECRET` ควรเป็นค่าสุ่มอย่างน้อย 32 ตัวอักษร
- ค่า `EQMS_SHARED_SECRET` ต้องตรงกับ Apps Script
- หากแยก frontend คนละโดเมน ให้เพิ่ม secret `FRONTEND_ORIGIN` เป็น origin แบบ `https://example.com` เท่านั้น

ตรวจแพ็กเกจสำหรับ deploy โดยไม่ส่งขึ้นจริง:

```sh
npm run deploy:check
```

จากนั้นจึง deploy ด้วย `npm run deploy` หรือเชื่อมโฟลเดอร์นี้กับ Cloudflare Workers Builds โดยตั้ง Root directory เป็น `bkhn/modules/eqms` และ Deploy command เป็น `npm run deploy`

## การใช้งาน

ลำดับงานที่แนะนำคือ เพิ่มปีการศึกษา → เพิ่มรายวิชา → เพิ่มนักเรียน → สร้างข้อสอบ → กรอกเฉลย/น้ำหนัก/ตัวชี้วัด/Bloom → กำหนดผู้เข้าสอบ → บันทึกคำตอบ → ตรวจผลวิเคราะห์

หน้าแก้เฉลยแสดงจำนวนข้อทันทีหลังสร้างข้อสอบ แม้ยังไม่มีคำตอบนักเรียน ส่วนค่าความเชื่อมั่นจะแสดงเมื่อมีข้อมูลเพียงพอ และใช้ KR-20 เมื่อทุกข้อมีน้ำหนักเท่ากัน หรือ Cronbach's alpha สำหรับคะแนนถ่วงน้ำหนัก
