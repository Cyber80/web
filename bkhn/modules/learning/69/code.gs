function doGet(e) {
  let template = HtmlService.createTemplateFromFile('index');
  
  // รับค่า ?treeId=... จาก URL ถ้าไม่มีให้ใช้ T-0001 เป็นค่าเริ่มต้น
  template.initialTreeId = (e.parameter && e.parameter.treeId) ? e.parameter.treeId : 'T-0001';
  
  return template.evaluate()
    .setTitle('Smart Botanical Hub')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getTreeData(treeId) {
  const SHEET_ID = '1IDPAvXP3HNeyuYNhoFQW27Y36t19h1JQ2faEoV7rZT4'; 
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Trees');
  
  if (!sheet) return null;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === treeId.toString().trim()) { 
      let treeData = {};
      for (let j = 0; j < headers.length; j++) {
        let val = data[i][j];
        // แก้ไขบั๊ก: ถ้าเป็นข้อมูลประเภท Date ให้แปลงเป็น String ก่อน
        if (val instanceof Date) {
          val = val.toISOString();
        }
        treeData[headers[j]] = val;
      }
      return treeData;
    }
  }
  
  return null; 
}

function getTreeActivities(treeId) {
  const SHEET_ID = '1IDPAvXP3HNeyuYNhoFQW27Y36t19h1JQ2faEoV7rZT4';
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Timeline_Activities');
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  let activities = [];
  
  for (let i = data.length - 1; i > 0; i--) {
    if (data[i][1].toString().trim() === treeId.toString().trim()) { 
      let act = {};
      for (let j = 0; j < headers.length; j++) {
        let val = data[i][j];
        // แก้ไขบั๊ก: ถ้าเป็นข้อมูลประเภท Date ให้แปลงเป็น String ก่อน
        if (val instanceof Date) {
          val = val.toISOString();
        }
        act[headers[j]] = val;
      }
      activities.push(act);
    }
  }
  return activities;
}

// รับข้อมูลจากหน้าเว็บเพื่อบันทึกลงฐานข้อมูลและเพิ่ม EXP
function submitActivity(formObject) {
  const SHEET_ID = '1IDPAvXP3HNeyuYNhoFQW27Y36t19h1JQ2faEoV7rZT4';
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  const treeId = formObject.treeId;
  const userId = formObject.userId || 'S001'; // จำลองว่าผู้ใช้ S001 เป็นคนล็อกอิน
  const activityType = formObject.activityType;
  const description = formObject.description;
  const timestamp = new Date();
  
  // 1. บันทึกลงชีต Timeline_Activities
  const timelineSheet = ss.getSheetByName('Timeline_Activities');
  const activityId = 'A' + (timelineSheet.getLastRow()); 
  
  // ลำดับ Column: activity_id, tree_id, user_id, timestamp, activity_type, height_cm, girth_cm, milestone_type, description, image_url, sar_element
  const newRow = [
    activityId, 
    treeId, 
    userId, 
    timestamp, 
    activityType, 
    formObject.height || '', 
    formObject.girth || '', 
    'None', 
    description, 
    '', 
    2  
  ];
  timelineSheet.appendRow(newRow);
  
  // 2. ระบบ Gamification: เพิ่ม EXP
  const expEarned = activityType === 'Growth' ? 10 : 20; // ให้คะแนนตามประเภทกิจกรรม
  const logSheet = ss.getSheetByName('Gamification_Logs');
  const logId = 'L' + (logSheet.getLastRow());
  logSheet.appendRow([logId, userId, activityType, expEarned, timestamp]);
  
  // 3. อัปเดต EXP รวมของผู้ใช้
  const userSheet = ss.getSheetByName('Users');
  const userData = userSheet.getDataRange().getValues();
  let newTotalExp = expEarned;
  
  for (let i = 1; i < userData.length; i++) {
    if (userData[i][0] === userId) {
      let currentExp = Number(userData[i][4]) || 0;
      newTotalExp = currentExp + expEarned;
      userSheet.getRange(i + 1, 5).setValue(newTotalExp);
      
      // ถ้าระดับ EXP ถึง 200 ให้ปลดล็อก Badge
      if (newTotalExp >= 200 && (userData[i][5] || '').indexOf('ผู้พิทักษ์แห่งฤดูกาล') === -1) {
         let currentBadges = userData[i][5] ? userData[i][5] + ', ' : '';
         userSheet.getRange(i + 1, 6).setValue(currentBadges + 'ผู้พิทักษ์แห่งฤดูกาล');
      }
      break;
    }
  }
  
  return { success: true, expEarned: expEarned, newTotalExp: newTotalExp };
}

// ดึงข้อมูลสถิติสำหรับ Dashboard
function getDashboardStats() {
  const SHEET_ID = '1IDPAvXP3HNeyuYNhoFQW27Y36t19h1JQ2faEoV7rZT4';
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  const treeSheet = ss.getSheetByName('Trees');
  const treeCount = Math.max(0, treeSheet.getLastRow() - 1);
  
  const timelineSheet = ss.getSheetByName('Timeline_Activities');
  const activityCount = Math.max(0, timelineSheet.getLastRow() - 1);
  
  const userSheet = ss.getSheetByName('Users');
  const userCount = Math.max(0, userSheet.getLastRow() - 1);
  
  // นับจำนวนกิจกรรมแยกตามองค์ประกอบงานสวนพฤกษศาสตร์ (1-5) เพื่อทำกราฟ SAR
  let sarData = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  if (activityCount > 0) {
    // องค์ประกอบอยู่ Column K (Index 11)
    const activities = timelineSheet.getRange(2, 11, activityCount, 1).getValues();
    activities.forEach(row => {
      let el = row[0].toString();
      if (sarData[el] !== undefined) sarData[el]++;
    });
  }
  
  return {
    treeCount: treeCount,
    activityCount: activityCount,
    userCount: userCount,
    sarData: [sarData["1"], sarData["2"], sarData["3"], sarData["4"], sarData["5"]]
  };
}