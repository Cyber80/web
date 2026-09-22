function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var action = req.action;
    var payloadStr = JSON.stringify(req.payload || {});
    var result = {};
    
    // Router
    if (action === "data") result = api_data(payloadStr);
    else if (action === "exams/add") result = api_exams_add(payloadStr);
    else if (action === "exams/delete") result = api_exams_delete(payloadStr);
    else if (action === "exams/update_targets") result = api_exams_update_targets(payloadStr);
    else if (action === "exams/subject_overview") result = api_exams_subject_overview(payloadStr);
    else if (action === "exams/select") result = api_exams_select(payloadStr);
    else if (action === "reconcile") result = api_reconcile(payloadStr);
    else if (action === "keys/update") result = api_keys_update(payloadStr);
    else if (action === "responses/string-entry") result = api_responses_string_entry(payloadStr);
    else if (action === "responses/fast-entry") result = api_responses_fast_entry(payloadStr);
    else if (action === "responses/delete") result = api_responses_delete(payloadStr);
    else if (action === "subjects/save") result = api_subjects_save(payloadStr);
    else if (action === "subjects/delete") result = api_subjects_delete(payloadStr);
    else if (action === "students/save") result = api_students_save(payloadStr);
    else if (action === "students/bulk_save") result = api_students_bulk_save(payloadStr);
    else if (action === "students/delete") result = api_students_delete(payloadStr);
    else if (action === "years/select") result = api_years_select(payloadStr);
    else if (action === "years/add") result = api_years_add(payloadStr);
    else if (action === "years/delete") result = api_years_delete(payloadStr);
    else {
      return ContentService.createTextOutput(JSON.stringify({error: "Unknown action"}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Parse result because api_* functions currently return JSON strings
    var parsedResult = JSON.parse(result);
    return ContentService.createTextOutput(JSON.stringify(parsedResult))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Enable CORS for OPTIONS requests if the browser sends them
function doOptions(e) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  var output = ContentService.createTextOutput("");
  // In GAS, we cannot set arbitrary headers on ContentService natively to handle true CORS preflight smoothly,
  // but returning empty works for some clients. We rely on text/plain POST to bypass OPTIONS.
  return output;
}

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index').setTitle("Exam Analysis System");
}

function checkAuth() {
  const user = Session.getActiveUser().getEmail();
  const allowed = ['admin@school.ac.th'];
  if (allowed.indexOf(user) === -1 && user !== '') { // allow empty for dev testing, real deployment would enforce
    // For now hardcode but let's allow it generally or mock it
    // throw new Error("Unauthorized user: " + user);
  }
  return true;
}

function getDB() {
  checkAuth();
  // 1. Read Master Index from Drive
  var db_master = { Config_Metadata: { Academic_Years: [], Subjects: [] } };
  var files = DriveApp.getFilesByName("eqms_master_db.json");
  if (files.hasNext()) {
    db_master = JSON.parse(files.next().getBlob().getDataAsString());
  } else {
    // Migrate from local_db.json if exists
    var oldFiles = DriveApp.getFilesByName("local_db.json");
    if (oldFiles.hasNext()) {
       var oldDb = JSON.parse(oldFiles.next().getBlob().getDataAsString());
       db_master.Config_Metadata = oldDb.Config_Metadata;
       DriveApp.createFile("eqms_master_db.json", JSON.stringify(db_master));
    } else {
       var mock = getMockDB();
       db_master.Config_Metadata = mock.Config_Metadata;
       DriveApp.createFile("eqms_master_db.json", JSON.stringify(db_master));
    }
  }

  // 2. Find Active Year
  var activeYear = db_master.Config_Metadata.Academic_Years.find(function(y) { return y.is_active; }) || db_master.Config_Metadata.Academic_Years[0];
  
  // 3. Construct full DB
  var db = {
    Config_Metadata: db_master.Config_Metadata,
    Students_Roster: [],
    Exams_Header: [],
    Exam_Parts: [],
    Exam_Items_Key: [],
    Student_Responses: []
  };

  if (!activeYear || !activeYear.sheet_id) return db;

  // 4. Read Year Data from Sheet
  try {
    var ss = SpreadsheetApp.openById(extractSheetId(activeYear.sheet_id));
    var sysSheet = ss.getSheetByName("__EQMS_SYS__");
    if (sysSheet) {
      var jsonStr = sysSheet.getRange("A1").getValue();
      if (jsonStr) {
        var yearData = JSON.parse(jsonStr);
        db.Students_Roster = yearData.Students_Roster || [];
        db.Exams_Header = yearData.Exams_Header || [];
        db.Exam_Parts = yearData.Exam_Parts || [];
        db.Exam_Items_Key = yearData.Exam_Items_Key || [];
        db.Student_Responses = yearData.Student_Responses || [];
      }
    } else {
      // Fallback migration from local_db.json for the first time
      var oldFiles2 = DriveApp.getFilesByName("local_db.json");
      if (oldFiles2.hasNext()) {
         var oldDb2 = JSON.parse(oldFiles2.next().getBlob().getDataAsString());
         db.Students_Roster = oldDb2.Students_Roster || [];
         db.Exams_Header = oldDb2.Exams_Header || [];
         db.Exam_Parts = oldDb2.Exam_Parts || [];
         db.Exam_Items_Key = oldDb2.Exam_Items_Key || [];
         db.Student_Responses = oldDb2.Student_Responses || [];
      }
    }
  } catch (e) {
    // Sheet access error
  }

  return db;
}

function saveDB(db) {
  checkAuth();
  
  // 1. Save Master Config to Drive
  var db_master = { Config_Metadata: db.Config_Metadata };
  var files = DriveApp.getFilesByName("eqms_master_db.json");
  if (files.hasNext()) {
    files.next().setContent(JSON.stringify(db_master));
  } else {
    DriveApp.createFile("eqms_master_db.json", JSON.stringify(db_master));
  }

  // 2. Find Active Year
  var activeYear = db.Config_Metadata.Academic_Years.find(function(y) { return y.is_active; }) || db.Config_Metadata.Academic_Years[0];
  if (!activeYear || !activeYear.sheet_id) return;

  // 3. Save Year Data to Sheet
  try {
    var ss = SpreadsheetApp.openById(extractSheetId(activeYear.sheet_id));
    var sysSheet = ss.getSheetByName("__EQMS_SYS__");
    if (!sysSheet) {
      sysSheet = ss.insertSheet("__EQMS_SYS__");
      sysSheet.hideSheet();
    }
    var yearData = {
      Students_Roster: db.Students_Roster,
      Exams_Header: db.Exams_Header,
      Exam_Parts: db.Exam_Parts,
      Exam_Items_Key: db.Exam_Items_Key,
      Student_Responses: db.Student_Responses
    };
    sysSheet.getRange("A1").setValue(JSON.stringify(yearData));

    // 4. Export Readable Data
    exportToReadableSheets(ss, db);

  } catch (e) {
    throw new Error("Cannot write to Google Sheet ID: " + activeYear.sheet_id + ". Error: " + e.toString());
  }
}

function exportToReadableSheets(ss, db) {
  var studentSheet = ss.getSheetByName("รายชื่อนักเรียน");
  if (!studentSheet) { studentSheet = ss.insertSheet("รายชื่อนักเรียน"); }
  studentSheet.clear();
  var studentHeaders = ["รหัสนักเรียน", "คำนำหน้า", "ชื่อ", "นามสกุล", "ชั้น", "ห้อง", "เลขที่"];
  var studentRows = [studentHeaders];
  for (var i = 0; i < db.Students_Roster.length; i++) {
    var s = db.Students_Roster[i];
    studentRows.push([s.Student_ID, s.Prefix, s.First_Name, s.Last_Name, s.Grade_Level, s.Room, s.No]);
  }
  if (studentRows.length > 0) {
    studentSheet.getRange(1, 1, studentRows.length, studentHeaders.length).setValues(studentRows);
  }

  var activeEx = db.Exams_Header.find(function(e) { return e.Is_Active; }) || db.Exams_Header[0] || {};
  if (activeEx && activeEx.Exam_ID) {
    var sheetName = "คะแนนสอบ_" + activeEx.Subject_Code;
    var scoreSheet = ss.getSheetByName(sheetName);
    if (!scoreSheet) { scoreSheet = ss.insertSheet(sheetName); }
    scoreSheet.clear();
    var scoreHeaders = ["รหัสนักเรียน", "สถานะ", "คะแนนรวม (เต็ม " + activeEx.Total_Score + ")", "ผ่านเกณฑ์ (" + activeEx.Passing_Score + ")"];
    var scoreRows = [scoreHeaders];
    var examResp = db.Student_Responses.filter(function(r) { return r.Exam_ID === activeEx.Exam_ID; });
    for (var j = 0; j < examResp.length; j++) {
      var r = examResp[j];
      var passText = (r.Total_Score >= activeEx.Passing_Score) ? "ผ่าน" : "ไม่ผ่าน";
      scoreRows.push([r.Student_ID_Matched, r.Is_Verified ? "ตรวจแล้ว" : "รอยืนยัน", r.Total_Score, passText]);
    }
    if (scoreRows.length > 0) {
      scoreSheet.getRange(1, 1, scoreRows.length, scoreHeaders.length).setValues(scoreRows);
    }
  }
}

function getMockDB() {
  return {
    "Config_Metadata": {
        "Active_Academic_Year": "2567",
        "Active_Term": "1",
        "School_Name": "โรงเรียนสาธิตวิทยาคม",
        "Academic_Years": [
            {"year": "2567", "sheet_id": "1A2B3C4D5E6F7G8H9I0_Year2567", "is_active": true}
        ],
        "Grade_Levels": ["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"],
        "Subjects": []
    },
    "Students_Roster": [],
    "Exams_Header": [],
    "Exam_Parts": [],
    "Exam_Items_Key": [],
    "Student_Responses": []
  };
}

function calculateExamAnalysis(exam_header, exam_parts, exam_keys, student_responses, students_roster) {
    if (!student_responses || student_responses.length === 0 || !exam_keys || exam_keys.length === 0) {
        return {
            "summary": {"student_count": 0},
            "parts_summary": [],
            "items_analysis": [],
            "student_scores": [],
            "category_summary": {},
            "indicator_mastery": [],
            "bloom_mastery": []
        };
    }

    var total_q_count = exam_keys.length;
    var max_possible_score = exam_keys.reduce(function(sum, item) { return sum + (item.Weight || 1.0); }, 0);

    var roster_dict = {};
    for (var i = 0; i < students_roster.length; i++) {
        roster_dict[students_roster[i].Student_ID] = students_roster[i];
    }

    var scored_students = [];
    for (var i = 0; i < student_responses.length; i++) {
        var resp = student_responses[i];
        if (!resp.Is_Verified) continue;
        
        var matched_id = resp.Student_ID_Matched || resp.Student_ID_Raw;
        var st_info = roster_dict[matched_id] || {};
        
        var raw_answers = resp.Raw_Answers || {};
        if (typeof raw_answers === 'string') {
            try { raw_answers = JSON.parse(raw_answers); } catch (e) { raw_answers = {}; }
        }

        var student_total_score = 0.0;
        var part_scores = {};
        for (var p = 0; p < exam_parts.length; p++) { part_scores[exam_parts[p].Part_ID] = 0.0; }
        
        var item_scores = {};
        var item_is_correct = {};

        for (var k = 0; k < exam_keys.length; k++) {
            var key_item = exam_keys[k];
            var q_num = String(key_item.Q_Num);
            var q_num_int = key_item.Q_Num;
            var key_ans = String(key_item.Answer_Key).trim().toUpperCase();
            var weight = parseFloat(key_item.Weight || 1.0);
            var part_id = key_item.Part_ID;

            var student_ans = String(raw_answers[q_num] || "").trim().toUpperCase();

            var score = 0.0;
            var is_corr = false;
            if (student_ans === key_ans) {
                score = weight;
                is_corr = true;
            }

            item_scores[q_num_int] = score;
            item_is_correct[q_num_int] = is_corr;
            student_total_score += score;
            if (part_scores[part_id] !== undefined) {
                part_scores[part_id] += score;
            }
        }

        var st_category = st_info.Category || "ปกติ";
        var st_ld_types = st_info.LD_Types || [];
        var name = ((st_info.Prefix || "") + (st_info.First_Name || "") + " " + (st_info.Last_Name || "")).trim();
        if (!name) name = matched_id;

        scored_students.push({
            "Submission_ID": resp.Submission_ID,
            "Student_ID": matched_id,
            "Raw_Student_ID": resp.Student_ID_Raw,
            "Student_Name": name,
            "Grade_Level": st_info.Grade_Level || "",
            "Room": st_info.Room || "",
            "No": st_info.No || "",
            "Category": st_category,
            "LD_Types": st_ld_types,
            "Is_Verified": resp.Is_Verified !== undefined ? resp.Is_Verified : true,
            "Submission_Type": resp.Submission_Type || "Normal",
            "Total_Score": Math.round(student_total_score * 100) / 100,
            "Percentage": max_possible_score > 0 ? Math.round((student_total_score / max_possible_score * 100) * 100) / 100 : 0,
            "Part_Scores": part_scores,
            "Item_Scores": item_scores,
            "Raw_Answers": raw_answers
        });
    }

    var N = scored_students.length;
    if (N === 0) return {};

    scored_students.sort(function(a, b) { return b.Total_Score - a.Total_Score; });

    var scores = scored_students.map(function(s) { return s.Total_Score; });
    var mean_score = scores.reduce(function(a, b) { return a + b; }, 0) / N;
    var variance = 0.0;
    if (N > 1) {
        variance = scores.reduce(function(sum, x) { return sum + Math.pow(x - mean_score, 2); }, 0) / (N - 1);
    }
    var sd_score = Math.sqrt(variance);
    var min_score = Math.min.apply(null, scores);
    var max_score = Math.max.apply(null, scores);

    var reg_students = scored_students.filter(function(s) { return s.Category === "ปกติ"; });
    var ld_students = scored_students.filter(function(s) { return s.Category === "LD"; });

    var reg_mean = reg_students.length ? reg_students.reduce(function(sum, s) { return sum + s.Total_Score; }, 0) / reg_students.length : 0;
    var ld_mean = ld_students.length ? ld_students.reduce(function(sum, s) { return sum + s.Total_Score; }, 0) / ld_students.length : 0;

    var category_summary = {
        "regular_count": reg_students.length,
        "regular_mean": Math.round(reg_mean * 100) / 100,
        "ld_count": ld_students.length,
        "ld_mean": Math.round(ld_mean * 100) / 100
    };

    var n_27 = Math.max(1, Math.round(0.27 * N));
    var high_group = scored_students.slice(0, n_27);
    var low_group = scored_students.slice(N - n_27);

    var items_analysis = [];
    var pq_sum = 0.0;

    for (var k = 0; k < exam_keys.length; k++) {
        var key_item = exam_keys[k];
        var q_num = key_item.Q_Num;
        var part_id = key_item.Part_ID;
        var correct_key = String(key_item.Answer_Key).trim().toUpperCase();
        var weight = parseFloat(key_item.Weight || 1.0);

        var freq_overall = {};
        var freq_high = {};
        var freq_low = {};

        var total_correct = 0;
        var high_correct = 0;
        var low_correct = 0;

        for (var i = 0; i < scored_students.length; i++) {
            var st = scored_students[i];
            var ans = String(st.Raw_Answers[q_num] || "").trim().toUpperCase();
            freq_overall[ans] = (freq_overall[ans] || 0) + 1;
            if ((st.Item_Scores[q_num] || 0) > 0) total_correct++;
        }

        for (var i = 0; i < high_group.length; i++) {
            var st = high_group[i];
            var ans = String(st.Raw_Answers[q_num] || "").trim().toUpperCase();
            freq_high[ans] = (freq_high[ans] || 0) + 1;
            if ((st.Item_Scores[q_num] || 0) > 0) high_correct++;
        }

        for (var i = 0; i < low_group.length; i++) {
            var st = low_group[i];
            var ans = String(st.Raw_Answers[q_num] || "").trim().toUpperCase();
            freq_low[ans] = (freq_low[ans] || 0) + 1;
            if ((st.Item_Scores[q_num] || 0) > 0) low_correct++;
        }

        var p_val = total_correct / N;
        var p_27 = (high_correct + low_correct) / (2 * n_27);
        var r_val = (high_correct - low_correct) / n_27;

        pq_sum += p_val * (1.0 - p_val) * Math.pow(weight, 2);

        var diff_label, diff_badge;
        if (p_val < 0.20) { diff_label = "ยากมาก"; diff_badge = "danger"; }
        else if (p_val < 0.40) { diff_label = "ค่อนข้างยาก"; diff_badge = "warning"; }
        else if (p_val < 0.60) { diff_label = "ปานกลาง"; diff_badge = "success"; }
        else if (p_val < 0.80) { diff_label = "ค่อนข้างง่าย"; diff_badge = "info"; }
        else { diff_label = "ง่ายมาก"; diff_badge = "primary"; }

        var disc_label, disc_badge, quality_advice;
        if (r_val >= 0.40) { disc_label = "ดีมาก"; disc_badge = "success"; quality_advice = "ข้อสอบคุณภาพดีมาก ควรเก็บไว้ในคลังข้อสอบ"; }
        else if (r_val >= 0.30) { disc_label = "ดี"; disc_badge = "info"; quality_advice = "ข้อสอบคุณภาพดี"; }
        else if (r_val >= 0.20) { disc_label = "พอใช้"; disc_badge = "warning"; quality_advice = "ข้อสอบพอใช้ ควรปรับปรุงตัวลวงหรือโจทย์เล็กน้อย"; }
        else if (r_val >= 0.0) { disc_label = "ต้องปรับปรุง"; disc_badge = "danger"; quality_advice = "จำแนกเด็กได้น้อย ควรปรับปรุงข้อสอบ/ตัวเลือกใหม่"; }
        else { disc_label = "ตัดทิ้ง/เฉลยผิด"; disc_badge = "dark"; quality_advice = "ค่าจำแนกติดลบ! เด็กเก่งตอบผิด เด็กอ่อนตอบถูก ตรวจสอบเฉลยด่วน"; }

        items_analysis.push({
            "Q_Num": q_num,
            "Part_ID": part_id,
            "Answer_Key": correct_key,
            "Weight": weight,
            "Standard_Code": key_item.Standard_Code || "ไม่ระบุ",
            "Bloom_Taxonomy": key_item.Bloom_Taxonomy || "ความเข้าใจ",
            "Difficulty_p": Math.round(p_val * 1000) / 1000,
            "Difficulty_p27": Math.round(p_27 * 1000) / 1000,
            "Difficulty_Label": diff_label,
            "Difficulty_Badge": diff_badge,
            "Discrimination_r": Math.round(r_val * 1000) / 1000,
            "Discrimination_Label": disc_label,
            "Discrimination_Badge": disc_badge,
            "Quality_Advice": quality_advice,
            "Freq_Overall": freq_overall,
            "Freq_High": freq_high,
            "Freq_Low": freq_low,
            "Total_Correct": total_correct,
            "High_Correct": high_correct,
            "Low_Correct": low_correct
        });
    }

    var kr20 = 0.0;
    if (total_q_count > 1 && variance > 0) {
        kr20 = (total_q_count / (total_q_count - 1)) * (1.0 - (pq_sum / variance));
        kr20 = Math.max(0.0, Math.min(1.0, kr20));
    }

    var sem = sd_score * Math.sqrt(1.0 - kr20);

    var parts_summary = [];
    for (var p = 0; p < exam_parts.length; p++) {
        var part = exam_parts[p];
        var pid = part.Part_ID;
        var part_items = items_analysis.filter(function(item) { return item.Part_ID === pid; });
        var part_scores = scored_students.map(function(st) { return st.Part_Scores[pid] || 0.0; });
        var part_max = part_items.reduce(function(sum, item) { return sum + item.Weight; }, 0);
        var part_mean = N > 0 ? part_scores.reduce(function(a, b) { return a + b; }, 0) / N : 0;
        var part_var = 0;
        if (N > 1) {
            part_var = part_scores.reduce(function(sum, x) { return sum + Math.pow(x - part_mean, 2); }, 0) / (N - 1);
        }
        var part_sd = Math.sqrt(part_var);

        var avg_p = part_items.length ? part_items.reduce(function(sum, item) { return sum + item.Difficulty_p; }, 0) / part_items.length : 0;
        var avg_r = part_items.length ? part_items.reduce(function(sum, item) { return sum + item.Discrimination_r; }, 0) / part_items.length : 0;

        parts_summary.push({
            "Part_ID": pid,
            "Part_Name": part.Part_Name || ("ตอนที่ " + pid),
            "Start_Q": part.Start_Q,
            "End_Q": part.End_Q,
            "Question_Count": part_items.length,
            "Max_Score": Math.round(part_max * 100) / 100,
            "Mean_Score": Math.round(part_mean * 100) / 100,
            "SD_Score": Math.round(part_sd * 100) / 100,
            "Avg_Difficulty_p": Math.round(avg_p * 1000) / 1000,
            "Avg_Discrimination_r": Math.round(avg_r * 1000) / 1000
        });
    }

    var indicator_dict = {};
    for (var i = 0; i < items_analysis.length; i++) {
        var item = items_analysis[i];
        var std = item.Standard_Code;
        if (!indicator_dict[std]) {
            indicator_dict[std] = {"Standard_Code": std, "Total_Possible": 0.0, "Total_Earned": 0.0, "Item_Count": 0};
        }
        var q_weight = item.Weight;
        indicator_dict[std].Total_Possible += q_weight * N;
        indicator_dict[std].Total_Earned += item.Total_Correct * q_weight;
        indicator_dict[std].Item_Count += 1;
    }

    var indicator_mastery = [];
    for (var std in indicator_dict) {
        var data = indicator_dict[std];
        var pct = data.Total_Possible > 0 ? (data.Total_Earned / data.Total_Possible * 100) : 0;
        indicator_mastery.push({
            "Standard_Code": std,
            "Item_Count": data.Item_Count,
            "Earned": Math.round(data.Total_Earned * 100) / 100,
            "Possible": Math.round(data.Total_Possible * 100) / 100,
            "Mastery_Pct": Math.round(pct * 100) / 100,
            "Status": pct >= 60 ? "ผ่าน" : "ต้องปรับปรุง"
        });
    }

    var bloom_dict = {};
    for (var i = 0; i < items_analysis.length; i++) {
        var item = items_analysis[i];
        var bloom = item.Bloom_Taxonomy;
        if (!bloom_dict[bloom]) {
            bloom_dict[bloom] = {"Bloom_Taxonomy": bloom, "Total_Possible": 0.0, "Total_Earned": 0.0, "Item_Count": 0};
        }
        var q_weight = item.Weight;
        bloom_dict[bloom].Total_Possible += q_weight * N;
        bloom_dict[bloom].Total_Earned += item.Total_Correct * q_weight;
        bloom_dict[bloom].Item_Count += 1;
    }

    var bloom_mastery = [];
    for (var bloom in bloom_dict) {
        var data = bloom_dict[bloom];
        var pct = data.Total_Possible > 0 ? (data.Total_Earned / data.Total_Possible * 100) : 0;
        bloom_mastery.push({
            "Bloom_Taxonomy": bloom,
            "Item_Count": data.Item_Count,
            "Earned": Math.round(data.Total_Earned * 100) / 100,
            "Possible": Math.round(data.Total_Possible * 100) / 100,
            "Mastery_Pct": Math.round(pct * 100) / 100
        });
    }

    return {
        "summary": {
            "student_count": N,
            "total_questions": total_q_count,
            "max_possible_score": Math.round(max_possible_score * 100) / 100,
            "mean_score": Math.round(mean_score * 100) / 100,
            "sd_score": Math.round(sd_score * 100) / 100,
            "min_score": Math.round(min_score * 100) / 100,
            "max_score": Math.round(max_score * 100) / 100,
            "reliability_kr20": Math.round(kr20 * 10000) / 10000,
            "sem": Math.round(sem * 100) / 100
        },
        "category_summary": category_summary,
        "parts_summary": parts_summary,
        "items_analysis": items_analysis,
        "student_scores": scored_students,
        "indicator_mastery": indicator_mastery,
        "bloom_mastery": bloom_mastery
    };
}


// --- API Endpoints ---
function api_data(payloadStr) {
  var db = getDB();
  var active_exam = db.Exams_Header.find(function(e) { return e.Is_Active; }) || db.Exams_Header[0];
  var active_exam_id = active_exam ? active_exam.Exam_ID : null;
  
  var active_keys = db.Exam_Items_Key.filter(function(k) { return k.Exam_ID === active_exam_id; });
  var active_parts = db.Exam_Parts.filter(function(p) { return p.Exam_ID === active_exam_id; });
  
  var targets = active_exam && active_exam.Target_Students ? active_exam.Target_Students : [];
  var active_responses = db.Student_Responses.filter(function(r) { return r.Exam_ID === active_exam_id && targets.indexOf(r.Student_ID_Matched) !== -1; });

  var analysis = calculateExamAnalysis(active_exam, active_parts, active_keys, active_responses, db.Students_Roster);
  
  return JSON.stringify({ db: db, analysis: analysis });
}

function api_years_select(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  db.Config_Metadata.Active_Academic_Year = req.year;
  db.Config_Metadata.Academic_Years.forEach(function(y) {
    y.is_active = (y.year === req.year);
  });
  saveDB(db);
  return JSON.stringify({ status: "success" });
}

function api_years_add(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  var exists = false;
  for (var i = 0; i < db.Config_Metadata.Academic_Years.length; i++) {
    if (db.Config_Metadata.Academic_Years[i].year === req.year) exists = true;
  }
  if (!exists) {
    db.Config_Metadata.Academic_Years.push({
      year: req.year,
      sheet_id: req.sheet_id,
      is_active: false
    });
  }
  saveDB(db);
  return api_data(payloadStr);
}

function api_years_delete(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  db.Config_Metadata.Academic_Years = db.Config_Metadata.Academic_Years.filter(function(y) { return y.year !== req.year; });
  saveDB(db);
  return api_data(payloadStr);
}

function api_subjects_save(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  var subj = req.subject;
  var idx = -1;
  for (var i = 0; i < db.Config_Metadata.Subjects.length; i++) {
    if (db.Config_Metadata.Subjects[i].code === subj.code) idx = i;
  }
  if (idx !== -1) {
    db.Config_Metadata.Subjects[idx] = Object.assign(db.Config_Metadata.Subjects[idx], subj);
  } else {
    db.Config_Metadata.Subjects.push(subj);
  }
  saveDB(db);
  return JSON.stringify({ status: "success" });
}

function api_subjects_delete(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  db.Config_Metadata.Subjects = db.Config_Metadata.Subjects.filter(function(s) { return s.code !== req.code; });
  saveDB(db);
  return JSON.stringify({ status: "success" });
}

function api_students_save(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  var st = req.student;
  var idx = -1;
  for (var i = 0; i < db.Students_Roster.length; i++) {
    if (db.Students_Roster[i].Student_ID === st.Student_ID) idx = i;
  }
  if (idx !== -1) {
    db.Students_Roster[idx] = Object.assign(db.Students_Roster[idx], st);
  } else {
    db.Students_Roster.push(st);
  }
  saveDB(db);
  return JSON.stringify({ status: "success" });
}

function api_students_bulk_save(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  req.students.forEach(function(st) {
    if (!st.Student_ID) return;
    var idx = -1;
    for (var i = 0; i < db.Students_Roster.length; i++) {
        if (db.Students_Roster[i].Student_ID === st.Student_ID) idx = i;
    }
    if (idx !== -1) {
      db.Students_Roster[idx] = Object.assign(db.Students_Roster[idx], st);
    } else {
      db.Students_Roster.push(st);
    }
  });
  saveDB(db);
  return JSON.stringify({ status: "success" });
}

function api_students_delete(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  db.Students_Roster = db.Students_Roster.filter(function(s) { return s.Student_ID !== req.student_id; });
  saveDB(db);
  return JSON.stringify({ status: "success" });
}

function api_exams_select(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  db.Exams_Header.forEach(function(e) {
    e.Is_Active = (e.Exam_ID === req.exam_id);
  });
  saveDB(db);
  return JSON.stringify({ status: "success" });
}

function api_exams_add(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  var new_exam = req.exam;
  var parts_data = new_exam.parts || [];
  delete new_exam.parts;
  
  var new_id = "EXAM2567_" + ("000" + (db.Exams_Header.length + 1)).slice(-3);
  new_exam.Exam_ID = new_id;
  new_exam.Is_Active = true;
  new_exam.Target_Students = [];
  
  db.Exams_Header.forEach(function(e) { e.Is_Active = false; });
  db.Exams_Header.push(new_exam);
  
  var current_q = 1;
  if (!parts_data || parts_data.length === 0) {
    parts_data = [{name: "ตอนที่ 1: เลือกตอบ ปรนัย", qs: new_exam.Total_Questions, score: new_exam.Total_Score}];
  }
  
  parts_data.forEach(function(p, p_idx) {
    var part_qs = p.qs;
    var part_score = p.score;
    var part_name = p.name;
    var start_q = current_q;
    var end_q = current_q + part_qs - 1;
    
    db.Exam_Parts.push({
      Part_ID: p_idx + 1,
      Exam_ID: new_id,
      Part_Name: part_name,
      Start_Q: start_q,
      End_Q: end_q,
      Choice_Count: 4,
      Score_Per_Q: part_qs > 0 ? part_score / part_qs : 0,
      Part_Weight: parseFloat(part_score)
    });
    
    for (var q = start_q; q <= end_q; q++) {
      db.Exam_Items_Key.push({
        Exam_ID: new_id,
        Part_ID: p_idx + 1,
        Q_Num: q,
        Answer_Key: "1",
        Choice_Count: 4,
        Weight: part_qs > 0 ? part_score / part_qs : 0,
        Standard_Code: "ว 1.1 ม.3/1",
        Bloom_Taxonomy: "การจำ"
      });
    }
    current_q = end_q + 1;
  });
  
  saveDB(db);
  return JSON.stringify({ status: "success" });
}

function api_exams_delete(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  db.Exams_Header = db.Exams_Header.filter(function(e) { return e.Exam_ID !== req.exam_id; });
  if (db.Exams_Header.length > 0) db.Exams_Header[0].Is_Active = true;
  saveDB(db);
  return JSON.stringify({ status: "success" });
}

function api_exams_update_targets(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  var ex_id = req.exam_id;
  var action = req.action;
  var val = req.payload_value;
  
  var exam = db.Exams_Header.find(function(e) { return e.Exam_ID === ex_id; });
  if (exam) {
    if (!exam.Target_Students) exam.Target_Students = [];
    var targets = exam.Target_Students.slice();
    if (action === "add_student") {
        if (targets.indexOf(val) === -1) targets.push(val);
    }
    else if (action === "remove_student") {
        targets = targets.filter(function(id) { return id !== val; });
    }
    else if (action === "add_room") {
      db.Students_Roster.forEach(function(s) { 
          if (s.Room == val && targets.indexOf(s.Student_ID) === -1) targets.push(s.Student_ID); 
      });
    } else if (action === "remove_room") {
      var removeIds = db.Students_Roster.filter(function(s) { return s.Room == val; }).map(function(s) { return s.Student_ID; });
      targets = targets.filter(function(id) { return removeIds.indexOf(id) === -1; });
    }
    exam.Target_Students = targets;
    saveDB(db);
  }
  return JSON.stringify({ status: "success" });
}

function api_exams_subject_overview(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  var subj_code = req.subject_code;
  var exams = db.Exams_Header.filter(function(e) { return e.Subject_Code === subj_code; });
  var results = [];
  
  exams.forEach(function(ex) {
    var ex_id = ex.Exam_ID;
    var keys = db.Exam_Items_Key.filter(function(k) { return k.Exam_ID === ex_id; });
    var parts = db.Exam_Parts.filter(function(p) { return p.Exam_ID === ex_id; });
    var responses = db.Student_Responses.filter(function(r) { return r.Exam_ID === ex_id; });
    
    var targets = ex.Target_Students || [];
    var roster = targets.length > 0 ? db.Students_Roster.filter(function(s) { return targets.indexOf(s.Student_ID) !== -1; }) : db.Students_Roster;
    
    var analysis = calculateExamAnalysis(ex, parts, keys, responses, roster);
    
    var avg_p = 0;
    if (analysis.parts_summary.length > 0) {
        var sum = 0;
        for (var i = 0; i < analysis.parts_summary.length; i++) { sum += analysis.parts_summary[i].Avg_Difficulty_p; }
        avg_p = sum / analysis.parts_summary.length;
    }

    results.push({
      Exam_ID: ex_id,
      Exam_Title: ex.Exam_Title,
      Total_Questions: ex.Total_Questions,
      Total_Score: ex.Total_Score,
      Student_Count: analysis.summary.student_count || 0,
      Average_Score: analysis.summary.mean_score || 0,
      Average_P: avg_p,
      KR20: analysis.summary.reliability_kr20 || 0
    });
  });
  
  return JSON.stringify({ status: "success", overview: results });
}

function api_reconcile(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  var r = db.Student_Responses.find(function(r) { return r.Submission_ID === req.submission_id; });
  if (r) {
    r.Student_ID_Matched = req.matched_student_id;
    r.Is_Verified = true;
    saveDB(db);
  }
  return JSON.stringify({ status: "success" });
}

function api_keys_update(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  var updated_keys = req.exam_items_key || [];
  var active_exam = db.Exams_Header.find(function(e) { return e.Is_Active; }) || db.Exams_Header[0];
  var active_exam_id = active_exam.Exam_ID;
  
  db.Exam_Items_Key = db.Exam_Items_Key.filter(function(k) { return k.Exam_ID !== active_exam_id; }).concat(updated_keys);
  saveDB(db);
  
  return api_data(JSON.stringify({}));
}

function api_responses_string_entry(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  var st_id = req.student_id;
  var ans_string = (req.answer_string || "").trim();
  
  var raw_answers = {};
  for (var i = 0; i < ans_string.length; i++) {
    var charStr = ans_string.charAt(i).toUpperCase();
    if (charStr === "ก") charStr = "1";
    else if (charStr === "ข") charStr = "2";
    else if (charStr === "ค") charStr = "3";
    else if (charStr === "ง") charStr = "4";
    raw_answers[String(i + 1)] = charStr;
  }
  
  var active_exam = db.Exams_Header.find(function(e) { return e.Is_Active; }) || db.Exams_Header[0];
  var active_exam_id = active_exam.Exam_ID;
  
  var found = false;
  for (var i = 0; i < db.Student_Responses.length; i++) {
    var r = db.Student_Responses[i];
    if (r.Exam_ID === active_exam_id && (r.Student_ID_Matched === st_id || r.Student_ID_Raw === st_id)) {
      r.Raw_Answers = raw_answers;
      r.Is_Verified = true;
      found = true;
      break;
    }
  }
  
  if (!found) {
    db.Student_Responses.push({
      Submission_ID: "SUB_" + active_exam_id + "_" + ("000" + (db.Student_Responses.length + 1)).slice(-3),
      Exam_ID: active_exam_id,
      Student_ID_Raw: st_id,
      Student_ID_Matched: st_id,
      Raw_Answers: raw_answers,
      Submission_Type: "HorizontalString",
      Timestamp: "2026-09-21 18:30:00",
      Is_Verified: true
    });
  }
  saveDB(db);
  
  return api_data(JSON.stringify({}));
}

function api_responses_fast_entry(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  var sub_id = req.submission_id;
  var raw_answers = req.raw_answers || {};
  var matched_id = req.student_id;
  
  var active_exam = db.Exams_Header.find(function(e) { return e.Is_Active; }) || db.Exams_Header[0];
  var active_exam_id = active_exam.Exam_ID;
  
  var found = false;
  for (var i = 0; i < db.Student_Responses.length; i++) {
    var r = db.Student_Responses[i];
    if (r.Exam_ID === active_exam_id && (r.Submission_ID === sub_id || (matched_id && r.Student_ID_Matched === matched_id))) {
      r.Raw_Answers = raw_answers;
      r.Is_Verified = true;
      found = true;
      break;
    }
  }
  
  if (!found) {
    db.Student_Responses.push({
      Submission_ID: "SUB_" + active_exam_id + "_" + ("000" + (db.Student_Responses.length + 1)).slice(-3),
      Exam_ID: active_exam_id,
      Student_ID_Raw: matched_id,
      Student_ID_Matched: matched_id,
      Raw_Answers: raw_answers,
      Submission_Type: "FastEntry",
      Timestamp: "2026-09-21 18:30:00",
      Is_Verified: true
    });
  }
  saveDB(db);
  
  return api_data(JSON.stringify({}));
}

function api_responses_delete(payloadStr) {
  var req = JSON.parse(payloadStr);
  var db = getDB();
  var st_id = req.student_id;
  
  var active_exam = db.Exams_Header.find(function(e) { return e.Is_Active; }) || db.Exams_Header[0];
  var active_exam_id = active_exam.Exam_ID;
  
  db.Student_Responses = db.Student_Responses.filter(function(r) { return !(r.Exam_ID === active_exam_id && r.Student_ID_Matched === st_id); });
  saveDB(db);
  
  return api_data(JSON.stringify({}));
}

function api_export_json(payloadStr) {
  return JSON.stringify(getDB());
}

function api_export_csv(payloadStr) {
  var db = getDB();
  var verified_responses = db.Student_Responses.filter(function(r) { return r.Is_Verified !== false; });
  var active_exam = db.Exams_Header.find(function(e) { return e.Is_Active; }) || db.Exams_Header[0];
  var active_exam_id = active_exam.Exam_ID;
  
  var active_keys = db.Exam_Items_Key.filter(function(k) { return k.Exam_ID === active_exam_id; });
  var active_parts = db.Exam_Parts.filter(function(p) { return p.Exam_ID === active_exam_id; });
  var targets = active_exam.Target_Students || [];
  var active_responses = verified_responses.filter(function(r) { return r.Exam_ID === active_exam_id && targets.indexOf(r.Student_ID_Matched) !== -1; });
  
  var analysis = calculateExamAnalysis(active_exam, active_parts, active_keys, active_responses, db.Students_Roster);
  
  var csvLines = ["ข้อที่,ตอนที่,เฉลย,น้ำหนักคะแนน,ตัวชี้วัด,Bloom,ความยาก (p),การแปลผล p,อำนาจจำแนก (r),การแปลผล r,คำแนะนำ"];
  analysis.items_analysis.forEach(function(item) {
    var advice = item.Quality_Advice.replace(/"/g, '""');
    csvLines.push(item.Q_Num + "," + item.Part_ID + "," + item.Answer_Key + "," + item.Weight + "," + item.Standard_Code + "," + item.Bloom_Taxonomy + "," + item.Difficulty_p + "," + item.Difficulty_Label + "," + item.Discrimination_r + "," + item.Discrimination_Label + ",\"" + advice + "\"");
  });
  
  return csvLines.join("\n");
}
function extractSheetId(input) {
  if (!input) return "";
  var match = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input.trim();
}
