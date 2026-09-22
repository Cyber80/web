/** EQMS API v3. Registry in MASTER_SHEET_ID; one separate spreadsheet per year. */
var EQMS_CONTEXT = null;
var EQMS_SCHEMA = {
  Years: ['year','sheet_id'],
  Subjects: ['code','name','grade_level','units'],
  Students: ['Student_ID','Prefix','First_Name','Last_Name','Grade_Level','Room','No','Gender','DOB','Category','LD_Types'],
  Exams: ['Exam_ID','Subject_Code','Subject_Name','Unit_Name','Term','Grade_Level','Exam_Title','Total_Questions','Total_Score','Passing_Score','Exam_Date','Created_By','Target_Students'],
  ExamParts: ['Exam_ID','Part_ID','Part_Name','Start_Q','End_Q','Choice_Count','Score_Per_Q','Part_Weight'],
  ExamKeys: ['Exam_ID','Part_ID','Q_Num','Answer_Key','Choice_Count','Weight','Standard_Code','Bloom_Taxonomy'],
  Responses: ['Submission_ID','Exam_ID','Student_ID_Raw','Student_ID_Matched','Is_Verified','Match_Method','Raw_Answers','Submission_Type','Timestamp']
};
var EQMS_TABLES = { Subjects:'Config_Metadata.Subjects', Students:'Students_Roster', Exams:'Exams_Header', ExamParts:'Exam_Parts', ExamKeys:'Exam_Items_Key', Responses:'Student_Responses' };
function jsonOutput_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return jsonOutput_({service:'EQMS',version:3}); }
function doPost(e) {
  var lock;
  try {
    var req = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('EQMS_SHARED_SECRET');
    if (!secret || !constantEqual_(req.secret || '', secret)) throw new Error('Unauthorized');
    var readOnly = ['health','meta','data','exams/subject_overview','export/json','export/csv'].indexOf(req.action) >= 0;
    // Serialize reads with writes too: a snapshot must never observe half a multi-tab save.
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error('ระบบกำลังบันทึกข้อมูล กรุณาลองอีกครั้ง');
    EQMS_CONTEXT = {payload:req.payload || {}, db:null, dirty:{}, readOnly:readOnly};
    var result = dispatch_(req.action, EQMS_CONTEXT.payload);
    return jsonOutput_(result);
  } catch (err) { return jsonOutput_({error:err.message || String(err)}); }
  finally { EQMS_CONTEXT = null; if (lock) lock.releaseLock(); }
}
function constantEqual_(a,b) {
  var ah = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(a));
  var bh = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(b));
  var diff = 0; for(var i=0;i<ah.length;i++) diff |= ah[i] ^ bh[i]; return diff === 0;
}
function SETUP_SYSTEM_AND_AUTHORIZE() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('MASTER_SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('EQMS • ทะเบียนปีการศึกษา');
  if (!id) props.setProperty('MASTER_SHEET_ID', ss.getId());
  if (!ss.getSheetByName('Years')) writeSheetData_(ss,'Years',[]);
  if (!props.getProperty('EQMS_SHARED_SECRET')) props.setProperty('EQMS_SHARED_SECRET',Utilities.getUuid()+Utilities.getUuid());
  return 'พร้อมใช้งาน: ตั้งค่า EQMS_SHARED_SECRET จาก Script Properties ให้ตรงกับ Worker และเพิ่มปีผ่านหน้าเว็บ';
}
function registry_() {
  var id = PropertiesService.getScriptProperties().getProperty('MASTER_SHEET_ID');
  if (!id) throw new Error('กรุณาเรียก SETUP_SYSTEM_AND_AUTHORIZE ก่อนใช้งาน');
  return SpreadsheetApp.openById(id);
}
function extractSpreadsheetId_(value) {
  var text=String(value || '').trim();
  var match=text.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : text;
}
function initializeYearSpreadsheet_(ss) {
  Object.keys(EQMS_TABLES).forEach(function(name){
    var sheet=ss.getSheetByName(name);
    if(!sheet || sheet.getLastRow()===0) writeSheetData_(ss,name,[]);
  });
  SpreadsheetApp.flush();
  return ss;
}
function getSheetData_(ss,name) {
  var sheet=ss.getSheetByName(name); if(!sheet || sheet.getLastRow()<2) return [];
  var values=sheet.getDataRange().getValues(), headers=values.shift();
  return values.filter(function(row){return row.some(function(v){return v!=='';});}).map(function(row){
    var obj={}; headers.forEach(function(h,i){
      var v=row[i];
      if (v instanceof Date) v=Utilities.formatDate(v,'Asia/Bangkok','yyyy-MM-dd');
      if(typeof v==='string' && /^[\[{]/.test(v)) { try {v=JSON.parse(v);}catch(e){} }
      if (['Student_ID','Student_ID_Raw','Student_ID_Matched','Exam_ID','year','Room','Grade_Level','code','sheet_id'].indexOf(h)>=0) v=String(v);
      if(h==='Is_Verified') v=v===true || String(v).toLowerCase()==='true';
      if(h) obj[h]=v;
    }); return obj;
  });
}
function writeSheetData_(ss,name,data) {
  var sheet=ss.getSheetByName(name) || ss.insertSheet(name), headers=EQMS_SCHEMA[name];
  var rows=[headers].concat(data.map(function(obj){return headers.map(function(h){
    var v=obj[h]; if(v===undefined || v===null) return '';
    if(typeof v==='object') return JSON.stringify(v);
    if(typeof v==='number') {if(!isFinite(v)) throw new Error('พบตัวเลขไม่ถูกต้องใน '+name); return v;}
    v=String(v); return /^[=+@\-]/.test(v) ? "'"+v : v;
  });}));
  if(rows.length>sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(),rows.length-sheet.getMaxRows());
  if(headers.length>sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(),headers.length-sheet.getMaxColumns());
  var previous=sheet.getLastRow();
  // Keep IDs and Thai text as text. Write before clearing obsolete trailing rows.
  sheet.getRange(1,1,rows.length,headers.length).setNumberFormat('@').setValues(rows);
  if(previous>rows.length) sheet.getRange(rows.length+1,1,previous-rows.length,headers.length).clearContent();
}
function getDB_() {
  if(EQMS_CONTEXT.db) return EQMS_CONTEXT.db;
  var years=getSheetData_(registry_(),'Years');
  var requested=String(EQMS_CONTEXT.payload.year || '');
  var year=years.find(function(y){return y.year===requested;}) || (!requested ? years[years.length-1] : null);
  if(requested && !year) throw new Error('ไม่พบปีการศึกษาที่เลือก กรุณาโหลดใหม่');
  var db={Config_Metadata:{Academic_Years:years,Active_Academic_Year:year?year.year:'',Active_Term:'1',School_Name:'ระบบวิเคราะห์ข้อสอบ',Subjects:[]},Students_Roster:[],Exams_Header:[],Exam_Parts:[],Exam_Items_Key:[],Student_Responses:[]};
  if(year) {
    if(!year.sheet_id) throw new Error('ปี '+year.year+' ยังไม่ได้เชื่อมไฟล์ Google Sheets แยกรายปี');
    var ss=SpreadsheetApp.openById(year.sheet_id);
    Object.keys(EQMS_TABLES).forEach(function(name){var path=EQMS_TABLES[name].split('.'); var obj=path.length===2?db[path[0]]:db; obj[path[path.length-1]]=getSheetData_(ss,name);});
    EQMS_CONTEXT.ss=ss;
  }
  db.Students_Roster.forEach(function(s){if(!Array.isArray(s.LD_Types)) s.LD_Types=[];});
  db.Exams_Header.forEach(function(e){if(!Array.isArray(e.Target_Students))e.Target_Students=[];});
  db.Config_Metadata.Subjects.forEach(function(s){
    if(Array.isArray(s.units)) return;
    if(!s.units) s.units=[];
    else if(typeof s.units==='string') {
      try {var parsed=JSON.parse(s.units);s.units=Array.isArray(parsed)?parsed:[];} catch(e) {s.units=[];}
    } else s.units=[];
  });
  EQMS_CONTEXT.db=db;
  return db;
}
function requireYear_() { var db=getDB_(); if(!EQMS_CONTEXT.ss) throw new Error('กรุณาเพิ่มปีการศึกษาก่อน'); return db; }
function selectedExam_(db,req) {
  var ex=db.Exams_Header.find(function(e){return e.Exam_ID===req.exam_id;});
  if(!ex && !req.exam_id) ex=db.Exams_Header[0];
  if(!ex) throw new Error('ไม่พบข้อสอบที่เลือก'); return ex;
}
function saveTables_(names) {
  var db=EQMS_CONTEXT.db;
  names.forEach(function(name){var p=EQMS_TABLES[name].split('.');writeSheetData_(EQMS_CONTEXT.ss,name,p.length===2?db[p[0]][p[1]]:db[p[0]]);});
  SpreadsheetApp.flush();
}
function snapshot_(req) {
  var db=getDB_(), ex=req.exam_id?db.Exams_Header.find(function(e){return e.Exam_ID===req.exam_id;}):db.Exams_Header[0];
  if(req.exam_id && !ex) throw new Error('ไม่พบข้อสอบที่เลือก');
  var id=ex?ex.Exam_ID:null;
  var keys=db.Exam_Items_Key.filter(function(k){return k.Exam_ID===id;}).sort(function(a,b){return a.Q_Num-b.Q_Num;});
  var parts=db.Exam_Parts.filter(function(p){return p.Exam_ID===id;});
  var responses=db.Student_Responses.filter(function(r){return r.Exam_ID===id;});
  var targets=ex?ex.Target_Students:[];
  var analysis=calculateExamAnalysis(ex,parts,keys,responses.filter(function(r){return targets.indexOf(r.Student_ID_Matched)>=0;}),db.Students_Roster);
  var publicDB=Object.assign({},db,{Exams_Header:db.Exams_Header.map(function(e){return Object.assign({},e,{Is_Active:e.Exam_ID===id});}),Exam_Items_Key:keys,Exam_Parts:parts,Student_Responses:responses});
  return {status:'success',db:publicDB,analysis:analysis,year:db.Config_Metadata.Active_Academic_Year,exam_id:id};
}
function requiredText_(value,label) { var s=String(value??'').trim(); if(!s || s.length>300) throw new Error('กรุณาตรวจสอบ'+label); return s; }
function number_(v,label,min,max) {var n=Number(v);if(v==='' || v==null || !isFinite(n) || n<min || n>max)throw new Error('กรุณาตรวจสอบ'+label);return n;}
function id_(prefix) {return prefix+'_'+Utilities.getUuid();}
function answer_(value,choices,blank) {
  var s=String(value??'').trim().toUpperCase(), alphabet={'ก':'1','ข':'2','ค':'3','ง':'4','จ':'5','A':'1','B':'2','C':'3','D':'4','E':'5'};
  s=alphabet[s] || s;
  if(blank && (s==='' || s==='-' || s==='0'))return '';
  if(!/^[1-9]$/.test(s) || Number(s)>choices)throw new Error('คำตอบต้องอยู่ระหว่าง 1–'+choices);
  return s;
}
function dispatch_(action,req) {
  if(action==='health') {
    var props=PropertiesService.getScriptProperties(), id=props.getProperty('MASTER_SHEET_ID');
    if(!id) return {status:'setup_required',message:'ยังไม่ได้เตรียมระบบ กรุณาเรียก SETUP_SYSTEM_AND_AUTHORIZE ใน Apps Script ก่อน'};
    var reg=SpreadsheetApp.openById(id), years=getSheetData_(reg,'Years');
    return {status:'ready',version:3,registry_sheet_id:id,year_count:years.length,can_create_spreadsheet:true};
  }
  if(action==='years/add') {
    var reg=registry_(), years=getSheetData_(reg,'Years'), y=requiredText_(req.year,'ปีการศึกษา');
    if(!/^\d{4}$/.test(y))throw new Error('ปีการศึกษาต้องเป็นตัวเลข 4 หลัก');
    if(years.some(function(row){return row.year===y;}))throw new Error('ปีการศึกษานี้มีอยู่แล้ว');
    var suppliedId=extractSpreadsheetId_(req.sheet_id), ss;
    try {
      ss=suppliedId ? SpreadsheetApp.openById(suppliedId) : SpreadsheetApp.create('EQMS • ปีการศึกษา '+y);
      initializeYearSpreadsheet_(ss);
    } catch(e) {
      throw new Error((suppliedId ? 'เปิด Google Sheet ที่ระบุไม่ได้' : 'สร้าง Google Sheet ใหม่ไม่ได้')+' กรุณาตรวจสิทธิ์ Apps Script และเรียก SETUP_SYSTEM_AND_AUTHORIZE อีกครั้ง: '+e.message);
    }
    years.push({year:y,sheet_id:ss.getId()});years.sort(function(a,b){return a.year.localeCompare(b.year);});
    writeSheetData_(reg,'Years',years);req.year=y;req.exam_id=null;return snapshot_(req);
  }
  if(action==='years/delete') {
    var reg=registry_(), years=getSheetData_(reg,'Years');
    writeSheetData_(reg,'Years',years.filter(function(y){return y.year!==String(req.year);}));
    req.year='';req.exam_id=null;return snapshot_(req); // Actual yearly file is retained.
  }
  if(action==='years/select') {req.exam_id=null;return snapshot_(req);}
  if(action==='data' || action==='exams/select') return snapshot_(req);
  if(action==='meta') {var db=getDB_();return {Config_Metadata:db.Config_Metadata,Exams_Header:db.Exams_Header};}
  var db=requireYear_();
  if(action==='subjects/save') {
    var s=req.subject||{};s.code=requiredText_(s.code,'รหัสวิชา');s.name=requiredText_(s.name,'ชื่อวิชา');
    var i=db.Config_Metadata.Subjects.findIndex(function(x){return x.code===s.code;});
    if(!Array.isArray(s.units)) s.units=i>=0 && Array.isArray(db.Config_Metadata.Subjects[i].units) ? db.Config_Metadata.Subjects[i].units : [];
    s.units=s.units.map(function(unit,index){
      return {unit_no:String(unit.unit_no || index+1),unit_name:requiredText_(unit.unit_name,'ชื่อหน่วยการเรียนรู้')};
    });
    if(i<0)db.Config_Metadata.Subjects.push(s);else db.Config_Metadata.Subjects[i]=s;
    saveTables_(['Subjects']);
  } else if(action==='subjects/delete') {
    if(db.Exams_Header.some(function(e){return e.Subject_Code===req.code;}))throw new Error('วิชานี้มีข้อสอบอยู่ กรุณาจัดการข้อสอบก่อน');
    db.Config_Metadata.Subjects=db.Config_Metadata.Subjects.filter(function(s){return s.code!==req.code;});saveTables_(['Subjects']);
  } else if(action==='students/save' || action==='students/bulk_save') {
    var incoming=action==='students/save'?[req.student]:req.students;
    if(!Array.isArray(incoming) || incoming.length>10000)throw new Error('รายชื่อนักเรียนไม่ถูกต้อง');
    var indexed={};db.Students_Roster.forEach(function(s,i){indexed[s.Student_ID]=i;});
    incoming.forEach(function(s){
      s.Student_ID=requiredText_(s.Student_ID,'รหัสนักเรียน');
      s.First_Name=requiredText_(s.First_Name,'ชื่อนักเรียน');
      s.Room=String(s.Room||'');s.Grade_Level=String(s.Grade_Level||'');s.LD_Types=Array.isArray(s.LD_Types)?s.LD_Types:[];
      if(Object.prototype.hasOwnProperty.call(indexed,s.Student_ID))db.Students_Roster[indexed[s.Student_ID]]=s;
      else {indexed[s.Student_ID]=db.Students_Roster.length;db.Students_Roster.push(s);}
    }); saveTables_(['Students']);
  } else if(action==='students/delete') {
    if(db.Student_Responses.some(function(r){return r.Student_ID_Matched===req.student_id;}))throw new Error('นักเรียนมีคำตอบที่บันทึกไว้ กรุณาลบคำตอบก่อน');
    db.Students_Roster=db.Students_Roster.filter(function(s){return s.Student_ID!==req.student_id;});
    db.Exams_Header.forEach(function(e){e.Target_Students=e.Target_Students.filter(function(id){return id!==req.student_id;});});saveTables_(['Students','Exams']);
  } else if(action==='exams/add') {
    var e=Object.assign({},req.exam), parts=e.parts;delete e.parts;
    e.Exam_Title=requiredText_(e.Exam_Title,'ชื่อข้อสอบ');
    if(!db.Config_Metadata.Subjects.some(function(s){return s.code===e.Subject_Code;}))throw new Error('กรุณาเพิ่มและเลือกรายวิชาก่อน');
    if(!Array.isArray(parts)||!parts.length)throw new Error('กรุณากำหนดตอนของข้อสอบ');
    var q=1,score=0;e.Exam_ID=id_('EXAM');e.Target_Students=[];
    parts.forEach(function(p,i){
      var count=number_(p.qs,'จำนวนข้อ',1,500), total=number_(p.score,'คะแนน',0,10000);
      if(!Number.isInteger(count) || q+count-1>500)throw new Error('ข้อสอบรองรับจำนวนเต็มไม่เกิน 500 ข้อ');
      db.Exam_Parts.push({Exam_ID:e.Exam_ID,Part_ID:i+1,Part_Name:requiredText_(p.name,'ชื่อตอน'),Start_Q:q,End_Q:q+count-1,Choice_Count:5,Score_Per_Q:total/count,Part_Weight:total});
      for(var j=0;j<count;j++,q++)db.Exam_Items_Key.push({Exam_ID:e.Exam_ID,Part_ID:i+1,Q_Num:q,Answer_Key:'',Choice_Count:5,Weight:total/count,Standard_Code:'',Bloom_Taxonomy:'การจำ'});
      score+=total;
    });e.Total_Questions=q-1;e.Total_Score=score;e.Passing_Score=number_(e.Passing_Score??score/2,'คะแนนผ่าน',0,score);
    db.Exams_Header.push(e);req.exam_id=e.Exam_ID;saveTables_(['Exams','ExamParts','ExamKeys']);
  } else if(action==='exams/delete') {
    var ex=selectedExam_(db,req),id=ex.Exam_ID;
    db.Exams_Header=db.Exams_Header.filter(function(e){return e.Exam_ID!==id;});
    ['Exam_Parts','Exam_Items_Key','Student_Responses'].forEach(function(k){db[k]=db[k].filter(function(r){return r.Exam_ID!==id;});});
    req.exam_id=null;saveTables_(['Exams','ExamParts','ExamKeys','Responses']);
  } else if(action==='exams/update_targets') {
    var ex=selectedExam_(db,req), val=String(req.payload_value), ids=[];
    if(req.action==='add_room'||req.action==='remove_room') ids=db.Students_Roster.filter(function(s){return s.Room===val && s.Grade_Level===ex.Grade_Level;}).map(function(s){return s.Student_ID;});
    else if(db.Students_Roster.some(function(s){return s.Student_ID===val;})) ids=[val];
    else throw new Error('ไม่พบนักเรียนในปีการศึกษานี้');
    if(req.action==='add_room'||req.action==='add_student') ex.Target_Students=Array.from(new Set(ex.Target_Students.concat(ids)));
    else if(req.action==='remove_room'||req.action==='remove_student')ex.Target_Students=ex.Target_Students.filter(function(s){return ids.indexOf(s)<0;});
    else throw new Error('คำสั่งรายชื่อไม่ถูกต้อง');
    saveTables_(['Exams']);
  } else if(action==='keys/update') {
    var ex=selectedExam_(db,req), existing=db.Exam_Items_Key.filter(function(k){return k.Exam_ID===ex.Exam_ID;}), incoming=req.exam_items_key;
    if(!Array.isArray(incoming)||incoming.length!==existing.length)throw new Error('จำนวนเฉลยไม่ครบตามข้อสอบ');
    var seen={};var keys=incoming.map(function(k){
      var original=existing.find(function(x){return x.Q_Num===Number(k.Q_Num);});
      if(!original || seen[k.Q_Num] || k.Exam_ID!==ex.Exam_ID)throw new Error('ข้อมูลเฉลยไม่ตรงกับข้อสอบ');seen[k.Q_Num]=true;
      var bloom=String(k.Bloom_Taxonomy||'');
      if(['การจำ','ความเข้าใจ','การประยุกต์ใช้','การวิเคราะห์','การประเมินค่า','การสร้างสรรค์'].indexOf(bloom)<0)throw new Error('พฤติกรรม Bloom ไม่ถูกต้อง');
      return Object.assign({},original,{Answer_Key:answer_(k.Answer_Key,original.Choice_Count||5,true),Weight:number_(k.Weight,'น้ำหนักคะแนน',0,10000),Standard_Code:String(k.Standard_Code||'').trim(),Bloom_Taxonomy:bloom});
    });
    ex.Total_Score=keys.reduce(function(s,k){return s+k.Weight;},0);ex.Passing_Score=Math.min(Number(ex.Passing_Score),ex.Total_Score);
    db.Exam_Items_Key=db.Exam_Items_Key.filter(function(k){return k.Exam_ID!==ex.Exam_ID;}).concat(keys);
    db.Exam_Parts.filter(function(p){return p.Exam_ID===ex.Exam_ID;}).forEach(function(p){var pk=keys.filter(function(k){return k.Part_ID===p.Part_ID;});p.Part_Weight=pk.reduce(function(s,k){return s+k.Weight;},0);p.Score_Per_Q=p.Part_Weight/pk.length;});
    saveTables_(['Exams','ExamParts','ExamKeys']);
  } else if(action==='responses/string-entry'||action==='responses/fast-entry') {
    var ex=selectedExam_(db,req),student=requiredText_(req.student_id,'รหัสนักเรียน');
    if(ex.Target_Students.indexOf(student)<0)throw new Error('กรุณาเพิ่มนักเรียนเป็นผู้เข้าสอบก่อน');
    var keys=db.Exam_Items_Key.filter(function(k){return k.Exam_ID===ex.Exam_ID;}),raw=req.raw_answers||{};
    if(action==='responses/string-entry') {var str=String(req.answer_string||'').trim();if(str.length!==keys.length)throw new Error('จำนวนคำตอบไม่ตรงกับข้อสอบ');raw={};Array.from(str).forEach(function(c,i){raw[String(i+1)]=c;});}
    var answers={};keys.forEach(function(k){answers[k.Q_Num]=answer_(raw[k.Q_Num],k.Choice_Count||5,true);});
    var row=db.Student_Responses.find(function(r){return r.Exam_ID===ex.Exam_ID && r.Student_ID_Matched===student;});
    if(!row){row={Submission_ID:id_('SUB'),Exam_ID:ex.Exam_ID,Student_ID_Raw:student,Student_ID_Matched:student};db.Student_Responses.push(row);}
    Object.assign(row,{Is_Verified:true,Raw_Answers:answers,Submission_Type:action==='responses/string-entry'?'HorizontalString':'FastEntry',Timestamp:new Date().toISOString()});saveTables_(['Responses']);
  } else if(action==='responses/delete') {
    var ex=selectedExam_(db,req);db.Student_Responses=db.Student_Responses.filter(function(r){return !(r.Exam_ID===ex.Exam_ID && r.Student_ID_Matched===req.student_id);});saveTables_(['Responses']);
  } else if(action==='reconcile') {
    var ex=selectedExam_(db,req),row=db.Student_Responses.find(function(r){return r.Submission_ID===req.submission_id && r.Exam_ID===ex.Exam_ID;});
    if(!row || ex.Target_Students.indexOf(req.matched_student_id)<0)throw new Error('ไม่พบกระดาษคำตอบหรือนักเรียนผู้เข้าสอบ');
    if(db.Student_Responses.some(function(r){return r!==row && r.Exam_ID===ex.Exam_ID && r.Student_ID_Matched===req.matched_student_id;}))throw new Error('นักเรียนนี้มีคำตอบแล้ว');
    row.Student_ID_Matched=req.matched_student_id;row.Is_Verified=true;saveTables_(['Responses']);
  } else if(action==='exams/subject_overview') {
    return {status:'success',overview:db.Exams_Header.filter(function(e){return e.Subject_Code===req.subject_code;}).map(function(ex){
      var a=snapshot_(Object.assign({},req,{exam_id:ex.Exam_ID})).analysis;
      return {Exam_ID:ex.Exam_ID,Exam_Title:ex.Exam_Title,Total_Questions:ex.Total_Questions,Total_Score:ex.Total_Score,Student_Count:a.summary.student_count,Average_Score:a.summary.mean_score||0,Average_P:a.items_analysis.length?a.items_analysis.reduce(function(s,i){return s+i.Difficulty_p;},0)/a.items_analysis.length:0,KR20:a.summary.reliability_kr20};
    })};
  } else if(action==='export/json') return {data:db};
  else if(action==='export/csv') {
    var rows=[['ข้อที่','เฉลย','น้ำหนัก','ตัวชี้วัด','Bloom','ความยาก p','อำนาจจำแนก r']];
    snapshot_(req).analysis.items_analysis.forEach(function(i){rows.push([i.Q_Num,i.Answer_Key,i.Weight,i.Standard_Code,i.Bloom_Taxonomy,i.Difficulty_p,i.Discrimination_r]);});
    return {csv:rows.map(function(row){return row.map(csvCell_).join(',');}).join('\r\n')};
  } else throw new Error('ไม่พบคำสั่ง '+action);
  return snapshot_(req);
}
function csvCell_(v) {var s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
