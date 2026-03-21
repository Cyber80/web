const SPREADSHEET_ID = '1yFUxh73pRr3E8HM_haMWIbZVZArQGGg_kT1KhindNyY';
const SHEET_NAME = 'data';

function doGet(e) {
  // ดักจับกรณีเปิด URL ตรงๆ โดยไม่มี Parameter
  if (!e || !e.parameter || !e.parameter.action) {
    return jsonResponse({error: 'No action specified. API is running.'});
  }

  const action = e.parameter.action;
  try {
    if (action === 'getData') return jsonResponse(getDashboardData());
    if (action === 'updateField') return jsonResponse(updateField(e.parameter));
    if (action === 'deleteRow') return jsonResponse(deleteRow(e.parameter.rowNum));
    if (action === 'addRow') return jsonResponse(addRow(e.parameter));
    return jsonResponse({error: 'Invalid action'});
  } catch (err) {
    // ส่ง Error จริงออกไปให้หน้าเว็บเห็น
    return jsonResponse({error: err.toString()});
  }
}

// ❌ ลบ .setHeader ออกแล้ว เพื่อป้องกัน Error จากฝั่ง Google
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getDashboardData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("ไม่พบหน้าชีทที่ชื่อ: " + SHEET_NAME);
  
  // ใช้ getDisplayValues() เพื่อป้องกันปัญหา Format วันที่/ตัวเลข ที่ทำให้ JSON พัง
  const data = sheet.getDataRange().getDisplayValues(); 
  if (data.length <= 1) return { rows: [], stats: { total: 0, received: 0 } };
  
  const rows = data.slice(1).map((row, index) => ({
    rowNum: index + 2,
    c1: row[0], c2: row[1], c3: row[2], c4: row[3], c5: row[4], 
    c6: row[5], c7: row[6], c8: row[7], c9: row[8] || 'ยังไม่ได้รับ', 
    c10: row[9] || 'ยังไม่ได้รับ', c11: row[10]
  }));
  
  const receivedCount = rows.filter(r => r.c9 === 'ได้รับแล้ว').length;
  return { rows, stats: { total: rows.length, received: receivedCount } };
}

function updateField(p) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (p.colName === 'c9') {
    sheet.getRange(p.rowNum, 9).setValue(p.newValue);
  } else {
    // อัปเดตข้อมูลทั้งแถว (คอลัมน์ 1 ถึง 11)
    const vals = [[p.c1, p.c2, p.c3, p.c4, '', p.c6, p.c7, p.c8, p.c9, p.c10, p.c11]];
    sheet.getRange(p.rowNum, 1, 1, 11).setValues(vals);
  }
  return { success: true };
}

function deleteRow(rowNum) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  sheet.deleteRow(parseInt(rowNum));
  return { success: true };
}

function addRow(p) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  sheet.appendRow([p.c1, p.c2, p.c3, p.c4, '', p.c6, p.c7, p.c8, p.c9 || 'ยังไม่ได้รับ', p.c10 || 'ยังไม่ได้รับ', p.c11]);
  return { success: true };
}