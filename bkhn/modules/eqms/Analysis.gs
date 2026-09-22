// Pure analysis: no Google services. Tested with known scores.
function calculateExamAnalysis(exam_header, exam_parts, exam_keys, student_responses, students_roster) {
    if (!student_responses || student_responses.length === 0 || !exam_keys || exam_keys.length === 0) {
        return {
            "summary": {"student_count": 0, "total_questions": (exam_keys || []).length,
              "max_possible_score": (exam_keys || []).reduce(function(s,k){return s + Number(k.Weight ?? 1);}, 0),
              "reliability_kr20": null, "reliability": null, "sem": null},
            "parts_summary": [],
            "items_analysis": [],
            "student_scores": [],
            "category_summary": {},
            "indicator_mastery": [],
            "bloom_mastery": []
        };
    }

    var total_q_count = exam_keys.length;
    var max_possible_score = exam_keys.reduce(function(sum, item) { return sum + (item.Weight ?? 1.0); }, 0);

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
            var weight = parseFloat(key_item.Weight ?? 1.0);
            var part_id = key_item.Part_ID;

            var student_ans = String(raw_answers[q_num] || "").trim().toUpperCase();

            var score = 0.0;
            var is_corr = false;
            if (key_ans !== "" && student_ans === key_ans) {
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
            "Item_Correct": item_is_correct,
            "Raw_Answers": raw_answers
        });
    }

    var N = scored_students.length;
    if (N === 0) return calculateExamAnalysis(exam_header, exam_parts, exam_keys, [], students_roster);

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
        var weight = parseFloat(key_item.Weight ?? 1.0);

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
            if (st.Item_Correct[q_num] === true) total_correct++;
        }

        for (var i = 0; i < high_group.length; i++) {
            var st = high_group[i];
            var ans = String(st.Raw_Answers[q_num] || "").trim().toUpperCase();
            freq_high[ans] = (freq_high[ans] || 0) + 1;
            if (st.Item_Correct[q_num] === true) high_correct++;
        }

        for (var i = 0; i < low_group.length; i++) {
            var st = low_group[i];
            var ans = String(st.Raw_Answers[q_num] || "").trim().toUpperCase();
            freq_low[ans] = (freq_low[ans] || 0) + 1;
            if (st.Item_Correct[q_num] === true) low_correct++;
        }

        var p_val = total_correct / N;
        var p_27 = (high_correct + low_correct) / (2 * n_27);
        var r_val = N > 1 ? (high_correct - low_correct) / n_27 : null;

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

        if (N < 2) { disc_label = "ข้อมูลไม่เพียงพอ"; disc_badge = "secondary"; quality_advice = "ต้องมีผู้เข้าสอบอย่างน้อย 2 คน"; }
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
            "Discrimination_r": r_val === null ? null : Math.round(r_val * 1000) / 1000,
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

    var kr20 = null;
    if (total_q_count > 1 && variance > 0) {
        kr20 = (total_q_count / (total_q_count - 1)) * (1.0 - (pq_sum * N / (N - 1) / variance));

    }

    var sem = kr20 !== null && kr20 >= 0 && kr20 <= 1 ? sd_score * Math.sqrt(1.0 - kr20) : null;
    var equalWeights = exam_keys.every(function(k){return Number(k.Weight) === Number(exam_keys[0].Weight);});

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
            "reliability_kr20": equalWeights && kr20 !== null ? Math.round(kr20 * 10000) / 10000 : null,
            "reliability": kr20 === null ? null : Math.round(kr20 * 10000) / 10000,
            "reliability_method": equalWeights ? "KR-20" : "Cronbach α (คะแนนถ่วงน้ำหนัก)",
            "sem": sem === null ? null : Math.round(sem * 100) / 100
        },
        "category_summary": category_summary,
        "parts_summary": parts_summary,
        "items_analysis": items_analysis,
        "student_scores": scored_students,
        "indicator_mastery": indicator_mastery,
        "bloom_mastery": bloom_mastery
    };
}
