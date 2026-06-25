// =================================================================
// ⚙️ ส่วนตั้งค่า URL API ของ ผอ.โหน่ง (นำค่า URL ที่ก๊อปปี้จาก GAS มาวางที่นี่)
// =================================================================
const CORE_DB_URL = "https://script.google.com/macros/s/AKfycbz_Ceh_pOqx1j2ItpnOp6vOPiY4LJxMC9yMtPUXV5BsR1R9tCp-VqURO66AucGJ9P0GTw/exec";
const SUPERVISION_DB_URL = "https://script.google.com/macros/s/AKfycbwa6mtjvLYZVgyl9iQyWBMv1EUWKTXcRc0wWO5iaz1g-n541KWSlhvnuHNRJM95ggN1Hw/exec";


// ตัวแปรส่วนกลางสำหรับเก็บข้อมูลในหน้าเว็บ
let currentSchoolProfile = {};
let allTeachersCache = [];
let currentFormQuestions = [];

// รันฟังก์ชันนี้ทันทีที่หน้าเว็บโหลดเสร็จ
window.addEventListener("DOMContentLoaded", async () => {
    await loadInitialData();
});

// ฟังก์ชันสลับการแสดงผลหน้าจอ (SPA)
function switchView(viewName) {
    if (viewName === 'dashboard') {
        document.getElementById('view-dashboard').classList.remove('hidden');
        document.getElementById('view-evaluation').classList.add('hidden');
    } else if (viewName === 'evaluation') {
        document.getElementById('view-dashboard').classList.add('hidden');
        document.getElementById('view-evaluation').classList.remove('hidden');
    }
}

// =================================================================
// 📥 โหลดข้อมูลเริ่มต้นจาก 2 API (Core DB & Supervision DB) พร้อมกัน
// =================================================================
async function loadInitialData() {
    try {
        // 1. ดึงข้อมูลพื้นฐานโรงเรียนจาก Core DB
        const schoolRes = await fetch(`${CORE_DB_URL}?module=school&action=get`);
        const schoolJson = await schoolRes.json();
        if (schoolJson.status === "success") {
            currentSchoolProfile = schoolJson.data;
            document.getElementById("school-name-display").innerText = currentSchoolProfile.School_Name;
            document.getElementById("form-year").value = currentSchoolProfile.Current_Academic_Year;
            document.getElementById("form-semester").value = currentSchoolProfile.Current_Semester;
        }

        // 2. ดึงข้อมูลรายชื่อครูทุกคนจาก Core DB เพื่อมาใส่ในตาราง Dropdown
        const teacherRes = await fetch(`${CORE_DB_URL}?module=teacher&action=getAll`);
        const teacherJson = await teacherRes.json();
        if (teacherJson.status === "success") {
            allTeachersCache = teacherJson.data;
            populateDropdowns(allTeachersCache);
        }

        // 3. ดึงคลังคำถามนิเทศและตัวชี้วัดที่แมปปิ้งไว้จาก Supervision DB อิงตามปีปัจจุบัน
        if (currentSchoolProfile.Current_Academic_Year) {
            const formRes = await fetch(`${SUPERVISION_DB_URL}?action=getForm&year=${currentSchoolProfile.Current_Academic_Year}`);
            const formJson = await formRes.json();
            if (formJson.status === "success") {
                currentFormQuestions = formJson.data;
                renderDynamicForm(currentFormQuestions);
            }
        }

    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการโหลดข้อมูลโครงสร้างระบบ:", error);
        alert("ไม่สามารถติดต่อเซิร์ฟเวอร์ฐานข้อมูลกลางได้ กรุณาตรวจสอบลิงก์สิทธิ์ Web App API");
    }
}

// ฟังก์ชันกระจายรายชื่อครูลงช่องเลือกในหน้าเว็บ
function populateDropdowns(teachers) {
    const searchSelect = document.getElementById("search-teacher-select");
    const formSelect = document.getElementById("form-teacher-select");
    
    let htmlOptions = `<option value="">-- เลือกรายชื่อครู/บุคลากร --</option>`;
    teachers.forEach(t => {
        htmlOptions += `<option value="${t.Teacher_ID}">${t.Prefix}${t.First_Name} ${t.Last_Name} (${t.Department || 'ไม่ระบุกลุ่มสาระ'})</option>`;
    });
    
    searchSelect.innerHTML = htmlOptions;
    formSelect.innerHTML = htmlOptions;
}

// =================================================================
// 🎨 วาดฟอร์มคำถามนิเทศแบบ Dynamic พร้อมโชว์ป้ายกำกับตัวชี้วัดสากล (PA/สมศ)
// =================================================================
function renderDynamicForm(questions) {
    const container = document.getElementById("dynamic-questions-container");
    if (questions.length === 0) {
        container.innerHTML = `<div class="text-center py-6 text-red-500 bg-white rounded-xl border border-slate-200">ไม่พบข้อคำถามการนิเทศสำหรับปีการศึกษานี้ในคลังคำถาม</div>`;
        return;
    }

    let html = "";
    questions.forEach((q, index) => {
        // สร้าง Badge ป้ายกำกับตัวชี้วัดข้ามมิติ
        let kpiBadges = "";
        if (q.Mapped_KPIs && q.Mapped_KPIs.length > 0) {
            q.Mapped_KPIs.forEach(kpi => {
                let colorClass = "bg-slate-100 text-slate-700";
                if (kpi.category === "PA") colorClass = "bg-sky-100 text-sky-800 border border-sky-200";
                if (kpi.category === "สมศ") colorClass = "bg-emerald-100 text-emerald-800 border border-emerald-200";
                if (kpi.category === "SAR") colorClass = "bg-purple-100 text-purple-800 border border-purple-200";
                if (kpi.category === "มาตรฐานชาติ") colorClass = "bg-rose-100 text-rose-800 border border-rose-200";

                kpiBadges += `<span class="text-xs px-2 py-0.5 rounded-md font-medium mr-1 inline-block mt-1 ${colorClass}" title="${kpi.name}">#${kpi.category}: ${kpi.code}</span>`;
            });
        } else {
            kpiBadges = `<span class="text-xs text-slate-400 italic">ไม่ได้ผูกตัวชี้วัดส่วนกลาง</span>`;
        }

        html += `
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
            <div class="flex justify-between items-start gap-4">
                <div class="space-y-1">
                    <span class="text-xs font-semibold text-indigo-600 uppercase tracking-wider">${q.Section || 'หมวดทั่วไป'}</span>
                    <h3 class="font-medium text-slate-900">${index + 1}. ${q.Question_Text}</h3>
                    <div class="pt-1">${kpiBadges}</div>
                </div>
                <!-- ส่วนเลือกคะแนน (1 ถึง Max_Score) -->
                <div class="flex items-center space-x-1 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                    ${Array.from({ length: q.Max_Score || 5 }, (_, i) => i + 1).map(num => `
                        <label class="cursor-pointer">
                            <input type="radio" name="score_${q.Question_ID}" value="${num}" required class="sr-only peer">
                            <div class="w-8 h-8 flex items-center justify-center rounded-md text-sm font-semibold text-slate-400 peer-checked:bg-indigo-600 peer-checked:text-white hover:bg-slate-200 transition">
                                ${num}
                            </div>
                        </label>
                    `).join('')}
                </div>
            </div>
            <!-- ส่วนบันทึกเพิ่มเติมเชิงประจักษ์ -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <input type="url" id="link_${q.Question_ID}" placeholder="🔗 แนบลิงก์หลักฐานดิจิทัล/รูปภาพ/แผนการสอน (ถ้ามี)" class="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <input type="text" id="comment_${q.Question_ID}" placeholder="✍️ บันทึกข้อเสนอแนะเพิ่มเติมจากผู้ประเมินชิ้นงานในข้อนี้" class="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500">
            </div>
        </div>
        `;
    });

    container.innerHTML = html;
}

// =================================================================
// 📤 ส่งข้อมูลผลคะแนนแบบกลุ่มกลับไปบันทึกที่ Supervision DB (POST)
// =================================================================
async function submitAssessment(event) {
    event.preventDefault();

    const teacherId = document.getElementById("form-teacher-select").value;
    const supervisorId = document.getElementById("form-supervisor-id").value;
    const year = document.getElementById("form-year").value;
    const semester = document.getElementById("form-semester").value;

    if (!teacherId || !supervisorId) {
        alert("กรุณาเลือกครูผู้รับการนิเทศและระบุรหัสผู้ประเมินให้ครบถ้วนก่อนส่งข้อมูล");
        return;
    }

    // จัดระเบียบชุดข้อมูลแบบละเอียดลายข้อ
    const assessmentData = currentFormQuestions.map(q => {
        const scoreRadio = document.querySelector(`input[name="score_${q.Question_ID}"]:checked`);
        return {
            academic_year: year,
            semester: semester,
            teacher_id: teacherId,
            supervisor_id: supervisorId,
            question_id: q.Question_ID,
            score: scoreRadio ? parseInt(scoreRadio.value) : 0,
            evidence_link: document.getElementById(`link_${q.Question_ID}`).value,
            comment: document.getElementById(`comment_${q.Question_ID}`).value
        };
    });

    try {
        const payload = {
            action: "saveAssessment",
            assessment_data: assessmentData
        };

        const response = await fetch(SUPERVISION_DB_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.status === "success") {
            alert("✨ บันทึกข้อมูลการนิเทศลงระบบคลาวด์สำเร็จ! ข้อมูลถูกกระจายเข้าสู่ตัวชี้วัดเรียบร้อยแล้ว");
            document.getElementById("evaluation-dynamic-form").reset();
            switchView('dashboard');
            loadInitialData(); // รีเฟรชโครงข้อมูลลื่นไหล
        } else {
            alert("ระบบบันทึกล้มเหลว: " + result.message);
        }

    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการกดส่งข้อมูล:", error);
        alert("ไม่สามารถบันทึกข้อมูลได้เนื่องจากเครือข่ายมีปัญหาขัดข้อง");
    }
}

// =================================================================
// 📊 เรียกดูประวัติรายงานและประมวลผลเปรียบเทียบการพัฒนาครู
// =================================================================
async function loadTeacherHistory() {
    const teacherId = document.getElementById("search-teacher-select").value;
    if (!teacherId) {
        alert("กรุณาเลือกรายชื่อครูที่ต้องการเรียกดูรายงาน");
        return;
    }

    const teacherObj = allTeachersCache.find(t => t.Teacher_ID.toString() === teacherId.toString());
    const reportArea = document.getElementById("history-report-area");
    const tableBody = document.getElementById("history-table-body");

    try {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังประมวลผลคะแนนและจัดคู่ตัวชี้วัด...</td></tr>`;
        reportArea.classList.remove("hidden");

        // ดึงประวัติคะแนนดิบทั้งหมดจาก Supervision DB
        const response = await fetch(`${SUPERVISION_DB_URL}?action=getTeacherHistory&teacher_id=${teacherId}`);
        const json = await response.json();

        if (json.status === "success" && json.data.length > 0) {
            document.getElementById("report-meta").innerText = `ครูผู้รับการนิเทศ: ${teacherObj.Prefix}${teacherObj.First_Name} ${teacherObj.Last_Name} | สังกัด: ${teacherObj.Department} | วิทยฐานะ: ${teacherObj.Academic_Standing || 'ไม่มีวิทยฐานะ'}`;
            
            let html = "";
            json.data.forEach(row => {
                // ค้นหาข้อความคำถาม และ ป้ายตัวชี้วัดจากคำถามที่เรามีในระบบปัจจุบัน
                const matchedQ = currentFormQuestions.find(q => q.Question_ID.toString() === row.Question_ID.toString());
                const questionText = matchedQ ? matchedQ.Question_Text : `รหัสข้อคำถามเก่าในระบบ (${row.Question_ID})`;
                
                let kpiBadges = "";
                if (matchedQ && matchedQ.Mapped_KPIs) {
                    matchedQ.Mapped_KPIs.forEach(kpi => {
                        kpiBadges += `<span class="block text-xs font-medium text-indigo-700 mb-0.5">▪️ [${kpi.category}] ${kpi.code} : ${kpi.name.substring(0, 40)}...</span>`;
                    });
                } else {
                    kpiBadges = `<span class="text-slate-400 italic text-xs">ไม่ได้ผูกตัวชี้วัดหรือเกณฑ์ถูกอัปเดต</span>`;
                }

                const dateFormatted = new Date(row.Timestamp).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });

                html += `
                <tr class="hover:bg-slate-50 transition border-b border-slate-100">
                    <td class="p-3 font-medium text-slate-600">${row.Academic_Year} / เทอม ${row.Semester}<br><span class="text-xs text-slate-400">${dateFormatted}</span></td>
                    <td class="p-3 max-w-xs font-medium text-slate-900">${questionText}</td>
                    <td class="p-3">${kpiBadges}</td>
                    <td class="p-3 text-center"><span class="inline-block px-2.5 py-1 text-xs font-bold rounded-full ${row.Score >= 4 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">${row.Score} คะแนน</span></td>
                    <td class="p-3 space-y-1">
                        <p class="text-slate-700 italic">${row.Comment ? `"${row.Comment}"` : '-'}</p>
                        ${row.Evidence_Link ? `<a href="${row.Evidence_Link}" target="_blank" class="inline-flex items-center text-xs text-indigo-600 hover:underline font-medium"><i class="fa-solid fa-link mr-1"></i> เปิดดูหลักฐานเชิงประจักษ์</a>` : ''}
                    </td>
                </tr>
                `;
            });

            tableBody.innerHTML = html;
        } else {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-amber-600 font-medium bg-amber-50 rounded-xl">ไม่พบประวัติผลการนิเทศภายในของบุคลากรท่านนี้ในระบบฐานข้อมูลดิจิทัล</td></tr>`;
        }

    } catch (error) {
        console.error("เรียกรายงานล้มเหลว:", error);
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-red-500">เกิดข้อผิดพลาดในการโหลดผลรายงานสถิติ</td></tr>`;
    }
}

// เพิ่มฟังก์ชันส่งบันทึกคะแนนเข้าสู่ฐานข้อมูลประเมินลงในไฟล์ app.js หลัก
async function saveAssessmentToCloud(assessmentData) {
    try {
        const payload = {
            action: "saveAssessment",
            assessment_data: assessmentData
        };
        const response = await fetch(SUPERVISION_DB_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        console.error("การส่งบันทึกคลาวด์ขัดข้อง:", error);
        return { status: "error", message: error.toString() };
    }
}