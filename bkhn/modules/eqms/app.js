        let GLOBAL_DB = null;
        let GLOBAL_ANALYSIS = null;
        let scoreChart = null;
        let scatterChartObj = null;

        document.addEventListener("DOMContentLoaded", startApp);

        function isAnonymized() {
            return document.getElementById("anonymizeToggle").checked;
        }

        function formatStudentName(st) {
            if (isAnonymized()) {
                return `นักเรียน #${st.No || st.Student_ID}`;
            }
            return escapeHTML(st.Student_Name || `${escapeHTML(st.Prefix || '')}${escapeHTML(st.First_Name || '')} ${escapeHTML(st.Last_Name || '')}`);
        }

        function safeRender(fn) { fn(); }

        function renderAll() {
            if (!GLOBAL_DB || !GLOBAL_ANALYSIS) return;
            if (!GLOBAL_ANALYSIS.summary) GLOBAL_ANALYSIS.summary = {};
            if (!GLOBAL_ANALYSIS.parts_summary) GLOBAL_ANALYSIS.parts_summary = [];
            if (!GLOBAL_ANALYSIS.items_analysis) GLOBAL_ANALYSIS.items_analysis = [];

            resetTables();
            safeRender(renderHeaderInfo);
            safeRender(renderUnverifiedAlert);
            safeRender(renderSummaryTab);
            safeRender(renderLDTab);
            safeRender(renderCTTTab);
            safeRender(renderMasteryTab);
            safeRender(renderFastEntryTab);
            safeRender(renderKeyEditorTab);
            safeRender(renderReconcileTab);
            safeRender(renderModalsData);
            safeRender(populateSubjectOverviewSelect);
            activateTables();
            showAnalysisState();
        }

        function populateSubjectOverviewSelect() {
            const sel = document.getElementById("subjectOverviewSelect");
            const currentVal = sel.value;
            sel.innerHTML = '<option value="">-- เลือกรายวิชา --</option>';
            GLOBAL_DB.Config_Metadata.Subjects.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s.code;
                opt.innerText = `${escapeHTML(s.code)} - ${escapeHTML(s.name)}`;
                sel.appendChild(opt);
            });
            if (currentVal) sel.value = currentVal;
        }

        async function renderSubjectOverview() {
            const subjCode = document.getElementById("subjectOverviewSelect").value;
            const tbody = document.getElementById("subjectOverviewBody");

            if (!subjCode) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-muted">กรุณาเลือกรายวิชาเพื่อดูภาพรวม</td></tr>';
                return;
            }

            tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="spinner-border text-primary spinner-border-sm"></div> กำลังโหลดข้อมูล...</td></tr>';

            const res = await apiFetch("/api/exams/subject_overview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subject_code: subjCode })
            });
            const result = await res.json();

            if (result.status === "success") {
                tbody.innerHTML = "";
                if (result.overview.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" class="text-muted">ไม่มีรายการข้อสอบสำหรับวิชานี้</td></tr>';
                    return;
                }

                result.overview.forEach(ex => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td class="text-start fw-bold text-primary">${escapeHTML(ex.Exam_Title)}</td>
                        <td>${ex.Total_Questions} ข้อ</td>
                        <td>${ex.Total_Score}</td>
                        <td>${ex.Student_Count}</td>
                        <td class="fw-bold">${ex.Average_Score.toFixed(2)}</td>
                        <td>${ex.Average_P.toFixed(2)}</td>
                        <td>${ex.KR20 == null ? "—" : ex.KR20.toFixed(2)}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }

        function renderHeaderInfo() {
            const meta = GLOBAL_DB.Config_Metadata;
            document.getElementById("headerYear").innerText = `ปีการศึกษา ${meta.Active_Academic_Year}`;

            const examSel = document.getElementById("examSessionSelect");
            examSel.innerHTML = "";
            GLOBAL_DB.Exams_Header.forEach(ex => {
                const opt = document.createElement("option");
                opt.value = ex.Exam_ID;
                opt.innerText = `${escapeHTML(ex.Subject_Code)} - ${escapeHTML(ex.Exam_Title)}`;
                if (ex.Is_Active) {
                    opt.selected = true;
                    document.getElementById("activeExamTitleBadge").innerText = ex.Exam_Title;
                }
                examSel.appendChild(opt);
            });
        }

        async function switchExamSession() {
            const exId = document.getElementById("examSessionSelect").value;
            const res = await apiFetch("/api/exams/select", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ exam_id: exId })
            });
            const result = await res.json();
            await fetchData(); // Full reload to ensure state consistency after mutation (Optimized by caching on backend)
        }

        function renderUnverifiedAlert() {
            const unverified = GLOBAL_DB.Student_Responses.filter(r => !r.Is_Verified);
            const count = unverified.length;
            const alertEl = document.getElementById("unverifiedAlert");
            const badgeEl = document.getElementById("reconcileBadge");
            const countEl = document.getElementById("unverifiedCount");

            if (count > 0) {
                alertEl.classList.remove("d-none");
                badgeEl.classList.remove("d-none");
                badgeEl.innerText = count;
                countEl.innerText = count;
            } else {
                alertEl.classList.add("d-none");
                badgeEl.classList.add("d-none");
            }
        }

        // TAB 1: SUMMARY
        function renderSummaryTab() {
            const sum = GLOBAL_ANALYSIS.summary;
            const exHeader = GLOBAL_DB.Exams_Header.find(e => e.Is_Active) || GLOBAL_DB.Exams_Header[0] || {};

            document.getElementById("statN").innerText = sum.student_count || 0;
            document.getElementById("statMean").innerText = sum.mean_score || 0;
            document.getElementById("statMaxPossible").innerText = sum.max_possible_score || 0;
            document.getElementById("statSD").innerText = sum.sd_score || 0;
            document.getElementById("statKR20").innerText = sum.reliability ?? "—";
            document.getElementById("statSEM").innerText = sum.sem ?? "—";
            document.getElementById("statMin").innerText = sum.min_score || 0;
            document.getElementById("statMax").innerText = sum.max_score || 0;
            document.getElementById("statPassing").innerText = exHeader.Passing_Score || 0;

            const partsBody = document.getElementById("partsTableBody");
            partsBody.innerHTML = "";

            GLOBAL_ANALYSIS.parts_summary.forEach(p => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td class="fw-bold">ตอนที่ ${p.Part_ID}</td>
                    <td>${escapeHTML(p.Part_Name)}</td>
                    <td class="text-center">${p.Question_Count} ข้อ</td>
                    <td class="text-center">${p.Max_Score}</td>
                    <td class="text-center fw-bold text-success">${p.Mean_Score}</td>
                    <td class="text-center">${p.SD_Score}</td>
                    <td class="text-center"><span class="badge bg-secondary">${p.Avg_Difficulty_p}</span></td>
                    <td class="text-center"><span class="badge bg-info text-dark">${p.Avg_Discrimination_r}</span></td>
                `;
                partsBody.appendChild(tr);
            });

            renderScoreChart();

            // 1) Update Table Header dynamically based on Exam Parts
            const thead = document.getElementById("studentScoresHead");
            const activeParts = GLOBAL_DB.Exam_Parts.filter(p => p.Exam_ID === exHeader.Exam_ID).sort((a,b) => a.Part_ID - b.Part_ID);

            let headHTML = `
                <tr>
                    <th class="text-center">อันดับ</th>
                    <th>รหัสนักเรียน</th>
                    <th>ชื่อ-นามสกุล</th>
                    <th class="text-center">กลุ่ม</th>`;

            activeParts.forEach(p => {
                headHTML += `<th class="text-center">${escapeHTML(p.Part_Name)}</th>`;
            });

            headHTML += `
                    <th class="text-center">คะแนนรวม</th>
                    <th class="text-center">คิดเป็น %</th>
                    <th class="text-center">ผลการประเมิน</th>
                </tr>
            `;
            thead.innerHTML = headHTML;

            // 2) Update Table Body
            const stBody = document.getElementById("studentScoresBody");
            stBody.innerHTML = "";
            document.getElementById("studentCountBadge").innerText = `${GLOBAL_ANALYSIS.student_scores.length} คน`;

            GLOBAL_ANALYSIS.student_scores.forEach((st, idx) => {
                const pass = st.Total_Score >= exHeader.Passing_Score;
                const tr = document.createElement("tr");
                const catBadge = st.Category === 'LD' ? '<span class="badge bg-warning text-dark">LD</span>' : '<span class="badge bg-success">ปกติ</span>';

                let rowHTML = `
                    <td class="text-center fw-bold">${idx + 1}</td>
                    <td><code>${st.Student_ID}</code></td>
                    <td class="fw-bold">${formatStudentName(st)}</td>
                    <td class="text-center">${catBadge}</td>
                `;

                activeParts.forEach(p => {
                    const ps = st.Part_Scores[p.Part_ID] !== undefined ? st.Part_Scores[p.Part_ID] : 0;
                    rowHTML += `<td class="text-center text-secondary">${ps}</td>`;
                });

                rowHTML += `
                    <td class="text-center fw-bold fs-6 text-primary">${st.Total_Score}</td>
                    <td class="text-center">${st.Percentage}%</td>
                    <td class="text-center">
                        <span class="badge ${pass ? 'bg-success' : 'bg-danger'}">${pass ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}</span>
                    </td>
                `;
                tr.innerHTML = rowHTML;
                stBody.appendChild(tr);
            });
        }

        function renderScoreChart() {
            const ctx = document.getElementById("scoreDistributionChart").getContext("2d");
            const scores = GLOBAL_ANALYSIS.student_scores.map(s => s.Total_Score);
            const maxScore = GLOBAL_ANALYSIS.summary.max_possible_score || 30;
            const step = maxScore / 5;
            const labels = [];
            const counts = [0, 0, 0, 0, 0];

            for (let i = 0; i < 5; i++) {
                labels.push(`${(i * step).toFixed(1)} - ${((i + 1) * step).toFixed(1)}`);
            }

            scores.forEach(sc => {
                let bin = Math.min(4, Math.floor(sc / step));
                counts[bin]++;
            });

            if (scoreChart) scoreChart.destroy();
            scoreChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{ label: 'จำนวนนักเรียน (คน)', data: counts, backgroundColor: '#0d6efd', borderRadius: 6 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }

        // TAB 2: LD TAB
        function renderLDTab() {
            const catSum = GLOBAL_ANALYSIS.category_summary || {};
            document.getElementById("ldRegCount").innerText = `${catSum.regular_count || 0} คน`;
            document.getElementById("ldRegMean").innerText = catSum.regular_mean || 0;
            document.getElementById("ldLdCount").innerText = `${catSum.ld_count || 0} คน`;
            document.getElementById("ldLdMean").innerText = catSum.ld_mean || 0;

            const body = document.getElementById("ldTableBody");
            body.innerHTML = "";

            GLOBAL_ANALYSIS.student_scores.forEach(st => {
                const tr = document.createElement("tr");
                const catBadge = st.Category === 'LD' ? '<span class="badge bg-warning text-dark fw-bold">LD</span>' : '<span class="badge bg-success">ปกติ</span>';

                let ldTagsHtml = "-";
                if (st.Category === 'LD' && st.LD_Types && st.LD_Types.length > 0) {
                    ldTagsHtml = st.LD_Types.map(t => `<span class="badge bg-secondary me-1">${t}</span>`).join("");
                }

                tr.innerHTML = `
                    <td><code>${st.Student_ID}</code></td>
                    <td class="fw-bold">${formatStudentName(st)}</td>
                    <td class="text-center">${catBadge}</td>
                    <td>${ldTagsHtml}</td>
                    <td class="text-center fw-bold text-primary">${st.Total_Score}</td>
                    <td class="text-center">${st.Percentage}%</td>
                `;
                body.appendChild(tr);
            });
        }

        // TAB 3: CTT
        function renderCTTTab() {
            const cttBody = document.getElementById("cttTableBody");
            cttBody.innerHTML = "";

            let goodCount = 0, fairCount = 0, badCount = 0;

            GLOBAL_ANALYSIS.items_analysis.forEach(item => {
                if (item.Discrimination_r >= 0.3) goodCount++;
                else if (item.Discrimination_r >= 0.2) fairCount++;
                else badCount++;

                const tr = document.createElement("tr");
                let choicesStr = "";
                for (let c = 1; c <= 4; c++) {
                    const cStr = c.toString();
                    const cnt = item.Freq_Overall[cStr] || 0;
                    const isKey = cStr === item.Answer_Key;
                    choicesStr += `<span class="${isKey ? 'fw-bold text-success' : 'text-muted'} me-2">${cStr}: ${cnt}${isKey ? '✓' : ''}</span> `;
                }

                tr.innerHTML = `
                    <td class="text-center fw-bold">${item.Q_Num}</td>
                    <td class="text-center">ตอนที่ ${item.Part_ID}</td>
                    <td class="text-center fw-bold text-success fs-6">${item.Answer_Key}</td>
                    <td class="text-center fw-bold">${item.Difficulty_p}</td>
                    <td class="text-center"><span class="badge badge-p-${item.Difficulty_Badge}">${item.Difficulty_Label}</span></td>
                    <td class="text-center fw-bold">${item.Discrimination_r}</td>
                    <td class="text-center"><span class="badge bg-${item.Discrimination_Badge}">${item.Discrimination_Label}</span></td>
                    <td class="small">${choicesStr}</td>
                    <td class="small text-muted">${item.Quality_Advice}</td>
                `;
                cttBody.appendChild(tr);
            });

            document.getElementById("qualityBoxes").innerHTML = `
                <div class="col-4">
                    <div class="p-3 bg-success-subtle border border-success rounded text-center">
                        <div class="fs-3 fw-bold text-success">${goodCount} ข้อ</div>
                        <div class="small fw-bold">คุณภาพดีมาก (r ≥ 0.30)</div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="p-3 bg-warning-subtle border border-warning rounded text-center">
                        <div class="fs-3 fw-bold text-warning">${fairCount} ข้อ</div>
                        <div class="small fw-bold">พอใช้ (0.20 ≤ r < 0.30)</div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="p-3 bg-danger-subtle border border-danger rounded text-center">
                        <div class="fs-3 fw-bold text-danger">${badCount} ข้อ</div>
                        <div class="small fw-bold">ควรปรับปรุง/ตัดทิ้ง (r < 0.20)</div>
                    </div>
                </div>
            `;

            renderScatterPlot();
        }

        function renderScatterPlot() {
            const ctx = document.getElementById("scatterChart").getContext("2d");
            const dataPoints = GLOBAL_ANALYSIS.items_analysis.map(item => ({
                x: item.Difficulty_p,
                y: item.Discrimination_r,
                q: item.Q_Num
            }));

            if (scatterChartObj) scatterChartObj.destroy();
            scatterChartObj = new Chart(ctx, {
                type: 'scatter',
                data: { datasets: [{ label: 'ข้อสอบ', data: dataPoints, backgroundColor: '#198754' }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        // TAB 4: MASTERY
        function renderMasteryTab() {
            const indBody = document.getElementById("indicatorTableBody");
            indBody.innerHTML = "";
            GLOBAL_ANALYSIS.indicator_mastery.forEach(ind => {
                const tr = document.createElement("tr");
                const isPass = ind.Mastery_Pct >= 60;
                tr.innerHTML = `
                    <td class="fw-bold">${escapeHTML(ind.Standard_Code)}</td>
                    <td class="text-center">${ind.Item_Count} ข้อ</td>
                    <td class="text-center">${ind.Earned} / ${ind.Possible}</td>
                    <td class="text-center fw-bold fs-6 ${isPass ? 'text-success' : 'text-danger'}">${ind.Mastery_Pct}%</td>
                    <td class="text-center"><span class="badge ${isPass ? 'bg-success' : 'bg-danger'}">${ind.Status}</span></td>
                `;
                indBody.appendChild(tr);
            });

            const bloomBody = document.getElementById("bloomTableBody");
            bloomBody.innerHTML = "";
            GLOBAL_ANALYSIS.bloom_mastery.forEach(b => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td class="fw-bold">${escapeHTML(b.Bloom_Taxonomy)}</td>
                    <td class="text-center">${b.Item_Count} ข้อ</td>
                    <td class="text-center">${b.Earned} / ${b.Possible}</td>
                    <td class="text-center fw-bold text-primary">${b.Mastery_Pct}%</td>
                `;
                bloomBody.appendChild(tr);
            });
        }

        // TAB 5: ADVANCED DATA ENTRY (3 MODES)
        function renderFastEntryTab() {
            const sel1 = document.getElementById("stringStudentSelect");
            const sel2 = document.getElementById("fastStudentSelect");
            const roomSel = document.getElementById("roomFilterSelect");
            const currentRoom = roomSel.value;

            const selected1 = sel1.value, selected2 = sel2.value;
            sel1.innerHTML = "";
            sel2.innerHTML = "";

            const activeEx = GLOBAL_DB.Exams_Header.find(e => e.Is_Active) || GLOBAL_DB.Exams_Header[0] || {};
            const targetStudents = activeEx.Target_Students || [];

            const rooms = new Set();
            GLOBAL_DB.Students_Roster.forEach(st => {
                if (targetStudents.includes(st.Student_ID) && st.Room) rooms.add(st.Room);
            });

            const prevRoom = roomSel.value;
            roomSel.innerHTML = '<option value="ALL">เลือกห้อง (แสดงทั้งหมด)</option>';
            Array.from(rooms).sort().forEach(r => {
                const opt = document.createElement("option");
                opt.value = r;
                opt.innerText = `ห้อง ${r}`;
                if (r === prevRoom) opt.selected = true;
                roomSel.appendChild(opt);
            });

            GLOBAL_DB.Students_Roster.forEach(st => {
                if (!targetStudents.includes(st.Student_ID)) return;
                if (roomSel.value !== "ALL" && st.Room !== roomSel.value) return;
                const nameStr = `${st.No || '-'} - ${formatStudentName(st)} (${st.Category})`;
                const opt1 = document.createElement("option"); opt1.value = st.Student_ID; opt1.innerText = nameStr;
                const opt2 = document.createElement("option"); opt2.value = st.Student_ID; opt2.innerText = nameStr;
                sel1.appendChild(opt1);
                sel2.appendChild(opt2);
            });

            if ([...sel1.options].some(o => o.value === selected1)) sel1.value = selected1;
            if ([...sel2.options].some(o => o.value === selected2)) sel2.value = selected2;
            loadStringModeData();
            loadFastEntryForStudent();
            renderEntryTracking();
        }

        function applyRoomFilter() {
            renderFastEntryTab();
        }

        function renderEntryTracking() {
            const tbody = document.getElementById("entryTrackingTableBody");
            const roomSel = document.getElementById("roomFilterSelect");
            tbody.innerHTML = "";

            let enteredCount = 0;
            let pendingCount = 0;

            const activeEx = GLOBAL_DB.Exams_Header.find(e => e.Is_Active) || GLOBAL_DB.Exams_Header[0] || {};
            const examResponses = GLOBAL_DB.Student_Responses.filter(r => r.Exam_ID === activeEx.Exam_ID && r.Is_Verified);
            const respondedIds = new Set(examResponses.map(r => r.Student_ID_Matched));

            const targetStudents = activeEx.Target_Students || [];

            GLOBAL_DB.Students_Roster.forEach(st => {
                if (!targetStudents.includes(st.Student_ID)) return;
                if (roomSel.value !== "ALL" && st.Room !== roomSel.value) return;

                const hasEntered = respondedIds.has(st.Student_ID);
                if (hasEntered) enteredCount++; else pendingCount++;

                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${st.No || '-'}</td>
                    <td>${formatStudentName(st)} <small class="text-muted">(${st.Category})</small></td>
                    <td class="text-center">
                        ${hasEntered ?
                            `<span class="badge bg-success"><i class="fa-solid fa-check"></i> เรียบร้อย</span>
                             <button class="btn btn-sm btn-outline-danger ms-1 py-0 px-1" onclick="deleteResponse('${st.Student_ID}')" title="ลบคำตอบ / ไม่นำมาวิเคราะห์"><i class="fa-solid fa-trash"></i></button>`
                            :
                            `<span class="badge bg-warning text-dark"><i class="fa-solid fa-clock"></i> รอข้อมูล</span>`
                        }
                    </td>
                `;
                tbody.appendChild(tr);
            });

            document.getElementById("enteredCountBadge").innerText = `กรอกแล้ว: ${enteredCount}`;
            document.getElementById("pendingCountBadge").innerText = `ยังไม่กรอก: ${pendingCount}`;
        }

        async function deleteResponse(studentId) {
            if (!confirm(`ต้องการลบคำตอบของนักเรียนรหัส ${studentId} และนำออกจากผู้เข้าสอบใช่หรือไม่?`)) return;

            // Delete response
            await apiFetch("/api/responses/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ student_id: studentId })
            });

            // Remove from examinees
            const activeEx = GLOBAL_DB.Exams_Header.find(e => e.Is_Active) || GLOBAL_DB.Exams_Header[0] || {};
            const res = await apiFetch("/api/exams/update_targets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ exam_id: activeEx.Exam_ID, action: "remove_student", payload_value: studentId })
            });
            if (res.ok) {
                const result = await res.json();
                applySnapshot(result);
                renderAll();
            }
        }

        function openExamineeManager() {
            const addRoomSel = document.getElementById("examineeAddRoomSelect");
            const rmRoomSel = document.getElementById("examineeRemoveRoomSelect");
            const addStSel = document.getElementById("examineeAddStudentSelect");

            addRoomSel.innerHTML = '<option value="">-- เลือกห้องเรียน (เพิ่มยกห้อง) --</option>';
            rmRoomSel.innerHTML = '<option value="">-- เลือกห้องเรียน (ลบยกห้อง) --</option>';
            addStSel.innerHTML = '<option value="">-- เลือกนักเรียนรายบุคคล --</option>';

            const rooms = new Set();
            GLOBAL_DB.Students_Roster.forEach(st => { if (st.Room && st.Grade_Level === activeExam().Grade_Level) rooms.add(st.Room); });
            Array.from(rooms).sort().forEach(r => {
                addRoomSel.innerHTML += `<option value="${r}">ห้อง ${r}</option>`;
                rmRoomSel.innerHTML += `<option value="${r}">ห้อง ${r}</option>`;
            });

            GLOBAL_DB.Students_Roster.forEach(st => {
                addStSel.innerHTML += `<option value="${st.Student_ID}">${st.No||'-'} - ${formatStudentName(st)} (ห้อง ${st.Room})</option>`;
            });

            new bootstrap.Modal(document.getElementById('examineeManagerModal')).show();
        }

        async function updateExaminees(action) {
            let val = "";
            if (action === 'add_room') val = document.getElementById("examineeAddRoomSelect").value;
            else if (action === 'remove_room') val = document.getElementById("examineeRemoveRoomSelect").value;
            else if (action === 'add_student') val = document.getElementById("examineeAddStudentSelect").value;

            if (!val) {
                alert("กรุณาเลือกข้อมูลที่ต้องการดำเนินการ");
                return;
            }

            const activeEx = GLOBAL_DB.Exams_Header.find(e => e.Is_Active) || GLOBAL_DB.Exams_Header[0] || {};
            const res = await apiFetch("/api/exams/update_targets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ exam_id: activeEx.Exam_ID, action: action, payload_value: val })
            });

            if (res.ok) {
                const result = await res.json();
                applySnapshot(result);
                alert("อัปเดตรายชื่อผู้เข้าสอบเรียบร้อยแล้ว");
                bootstrap.Modal.getInstance(document.getElementById('examineeManagerModal')).hide();
                renderAll();
            }
        }

        function loadStringModeData() {
            const stId = document.getElementById("stringStudentSelect").value;
            const activeEx = GLOBAL_DB.Exams_Header.find(e => e.Is_Active) || GLOBAL_DB.Exams_Header[0] || {};
            const resp = GLOBAL_DB.Student_Responses.find(r => r.Exam_ID === activeEx.Exam_ID && (r.Student_ID_Matched === stId || r.Student_ID_Raw === stId) && r.Is_Verified);

            let str = "";
            if (resp && resp.Raw_Answers) {
                for (let q = 1; q <= GLOBAL_ANALYSIS.summary.total_questions; q++) {
                    str += (resp.Raw_Answers[q.toString()] || "-");
                }
            }
            document.getElementById("stringInput").value = str;
            validateStringLength();
        }

        function validateStringLength() {
            const val = document.getElementById("stringInput").value.trim();
            const totalQ = editableKeys().length;
            const badge = document.getElementById("stringLenBadge");
            const err = document.getElementById("stringLenError");

            badge.innerText = `${val.length} / ${totalQ} ตัว`;

            if (val.length === totalQ) {
                badge.className = "badge fs-6 bg-success";
                err.classList.add("d-none");
            } else if (val.length === 0) {
                badge.className = "badge fs-6 bg-secondary";
                err.classList.add("d-none");
            } else {
                badge.className = "badge fs-6 bg-danger";
                err.classList.remove("d-none");
            }
        }

        async function saveStringMode() {
            const stId = document.getElementById("stringStudentSelect").value;
            const val = document.getElementById("stringInput").value.trim();
            const totalQ = editableKeys().length;

            if (val.length !== totalQ) {
                alert(`จำนวนข้อไม่ตรง! ความยาวต้องเท่ากับ ${totalQ} ตัวพอดี (ปัจจุบันกรอก ${val.length} ตัว)`);
                return;
            }

            const res = await apiFetch("/api/responses/string-entry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ student_id: stId, answer_string: val })
            });

            const result = await res.json();
            await fetchData(); // Full reload to ensure state consistency after mutation (Optimized by caching on backend)

            if (document.getElementById("autoNextStudentToggle").checked) {
                const sel = document.getElementById("stringStudentSelect");
                if (sel.selectedIndex < sel.options.length - 1) {
                    sel.selectedIndex += 1;
                    loadStringModeData();
                }
            }
            alert("บันทึกข้อมูลคำตอบเรียบร้อยแล้ว!");
        }

        function loadFastEntryForStudent() {
            const stId = document.getElementById("fastStudentSelect").value;
            const activeEx = GLOBAL_DB.Exams_Header.find(e => e.Is_Active) || GLOBAL_DB.Exams_Header[0] || {};
            const resp = GLOBAL_DB.Student_Responses.find(r => r.Exam_ID === activeEx.Exam_ID && (r.Student_ID_Matched === stId || r.Student_ID_Raw === stId) && r.Is_Verified);
            const answers = resp ? resp.Raw_Answers : {};

            const container = document.getElementById("fastGridContainer");
            container.innerHTML = "";

            for (let q = 1; q <= (editableKeys().length); q++) {
                const val = answers[q.toString()] || "";
                const col = document.createElement("div");
                col.className = "col-md-2 col-4";
                col.innerHTML = `
                    <div class="q-fast-box" id="qBox_${q}">
                        <div class="small text-muted fw-bold mb-1">ข้อที่ ${q}</div>
                        <input type="text" maxlength="1" id="qInput_${q}" value="${val}"
                               onfocus="highlightQBox(${q})"
                               onkeydown="handleFastKey(event, ${q})"
                               oninput="autoNextFastKey(${q})">
                    </div>
                `;
                container.appendChild(col);
            }
        }

        function highlightQBox(q) {
            document.querySelectorAll(".q-fast-box").forEach(b => b.classList.remove("active"));
            const box = document.getElementById(`qBox_${q}`);
            if (box) box.classList.add("active");
        }

        function handleFastKey(evt, q) {
            if (evt.key === "Enter" || evt.key === "ArrowRight") {
                evt.preventDefault();
                const next = document.getElementById(`qInput_${q + 1}`);
                if (next) { next.focus(); next.select(); }
            } else if (evt.key === "ArrowLeft") {
                evt.preventDefault();
                const prev = document.getElementById(`qInput_${q - 1}`);
                if (prev) { prev.focus(); prev.select(); }
            }
        }

        function autoNextFastKey(q) {
            const input = document.getElementById(`qInput_${q}`);
            let val = input.value.trim().toUpperCase();
            if (val === "ก") val = "1"; if (val === "ข") val = "2"; if (val === "ค") val = "3"; if (val === "ง") val = "4";
            input.value = val;
            if (val.length === 1) {
                const next = document.getElementById(`qInput_${q + 1}`);
                if (next) { next.focus(); next.select(); }
            }
        }

        function resetFastGrid() {
            for (let q = 1; q <= editableKeys().length; q++) {
                const el = document.getElementById(`qInput_${q}`);
                if (el) el.value = "";
            }
        }

        async function saveFastEntry() {
            const stId = document.getElementById("fastStudentSelect").value;
            const answers = {};
            for (let q = 1; q <= editableKeys().length; q++) {
                const el = document.getElementById(`qInput_${q}`);
                if (el) answers[q.toString()] = el.value.trim().toUpperCase();
            }

            const res = await apiFetch("/api/responses/fast-entry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ student_id: stId, raw_answers: answers })
            });

            const result = await res.json();
            await fetchData(); // Full reload to ensure state consistency after mutation (Optimized by caching on backend)
            alert("บันทึกคำตอบสำเร็จ!");
        }

        // TAB 6: KEY EDITOR
        function setBulkWeight() {
            const wVal = parseFloat(document.getElementById("bulkWeightInput").value);
            if (isNaN(wVal) || wVal < 0) {
                alert("กรุณาระบุน้ำหนักคะแนนให้ถูกต้อง");
                return;
            }
            editableKeys().forEach(item => {
                const elem = document.getElementById(`editWeight_${item.Q_Num}`);
                if (elem) elem.value = wVal;
            });
            alert(`ปรับน้ำหนักคะแนนทุกข้อเป็น ${wVal} เรียบร้อยแล้ว (อย่าลืมกดปุ่มบันทึกเฉลย)`);
        }

        function distributeHorizontalKeys() {
            const inputVal = document.getElementById("horizontalKeyInput").value.trim();
            const totalItems = editableKeys().length;
            document.getElementById("horizontalKeyCount").innerText = `${inputVal.length} / ${totalItems} ข้อ`;

            for (let i = 0; i < inputVal.length && i < totalItems; i++) {
                let charStr = inputVal[i].toUpperCase();
                if (charStr === 'ก') charStr = '1';
                else if (charStr === 'ข') charStr = '2';
                else if (charStr === 'ค') charStr = '3';
                else if (charStr === 'ง') charStr = '4';

                const qNum = editableKeys()[i].Q_Num;
                const inputElem = document.getElementById(`editKey_${qNum}`);
                if (inputElem) {
                    inputElem.value = charStr;
                }
            }
        }
        function renderKeyEditorTab() {
            const body = document.getElementById("keyEditorTableBody");
            body.innerHTML = "";

            editableKeys().forEach(item => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td class="text-center fw-bold">${item.Q_Num}</td>
                    <td class="text-center">ตอนที่ ${item.Part_ID}</td>
                    <td class="text-center">
                        <input type="text" class="form-control form-control-sm text-center fw-bold text-success" id="editKey_${item.Q_Num}" value="${escapeHTML(item.Answer_Key)}">
                    </td>
                    <td class="text-center">
                        <input type="number" step="any" min="0" class="form-control form-control-sm text-center" style="width: 70px;" id="editWeight_${item.Q_Num}" value="${item.Weight}">
                    </td>
                    <td><input type="text" class="form-control form-control-sm" id="editStd_${item.Q_Num}" value="${escapeHTML(item.Standard_Code)}"></td>
                    <td>
                        <select class="form-select form-select-sm" id="editBloom_${item.Q_Num}">
                            <option value="การจำ" ${item.Bloom_Taxonomy === 'การจำ' ? 'selected' : ''}>การจำ (Remembering)</option>
                            <option value="ความเข้าใจ" ${item.Bloom_Taxonomy === 'ความเข้าใจ' ? 'selected' : ''}>ความเข้าใจ (Understanding)</option>
                            <option value="การประยุกต์ใช้" ${item.Bloom_Taxonomy === 'การประยุกต์ใช้' ? 'selected' : ''}>การประยุกต์ใช้ (Applying)</option>
                            <option value="การวิเคราะห์" ${item.Bloom_Taxonomy === 'การวิเคราะห์' ? 'selected' : ''}>การวิเคราะห์ (Analyzing)</option>
                            <option value="การประเมินค่า" ${item.Bloom_Taxonomy === 'การประเมินค่า' ? 'selected' : ''}>การประเมินค่า (Evaluating)</option>
                            <option value="การสร้างสรรค์" ${item.Bloom_Taxonomy === 'การสร้างสรรค์' ? 'selected' : ''}>การสร้างสรรค์ (Creating)</option>
                        </select>
                    </td>
                `;
                body.appendChild(tr);
            });
        }

        async function saveKeyEditor() {
            const activeEx = GLOBAL_DB.Exams_Header.find(e => e.Is_Active) || GLOBAL_DB.Exams_Header[0] || {};
            const updatedKeys = editableKeys().map(item => ({
                Exam_ID: activeEx.Exam_ID,
                Part_ID: item.Part_ID,
                Q_Num: item.Q_Num,
                Answer_Key: document.getElementById(`editKey_${item.Q_Num}`).value.trim().toUpperCase(),
                Weight: Number(document.getElementById(`editWeight_${item.Q_Num}`).value),
                Standard_Code: document.getElementById(`editStd_${item.Q_Num}`).value.trim(),
                Bloom_Taxonomy: document.getElementById(`editBloom_${item.Q_Num}`).value
            }));

            const res = await apiFetch("/api/keys/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ exam_items_key: updatedKeys })
            });

            const result = await res.json();
            await fetchData(); // Full reload to ensure state consistency after mutation (Optimized by caching on backend)
            alert("อัปเดตเฉลยและ Re-calculate เรียบร้อยแล้ว!");
        }

        // TAB 7: RECONCILE
        function renderReconcileTab() {
            const body = document.getElementById("reconcileTableBody");
            body.innerHTML = "";
            const unverified = GLOBAL_DB.Student_Responses.filter(r => !r.Is_Verified);

            if (unverified.length === 0) {
                body.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-success"><i class="fa-solid fa-circle-check me-2"></i>ไม่พบกระดาษคำตอบที่ค้างจับคู่ ข้อมูลทุกรายการยืนยันแล้ว</td></tr>`;
                return;
            }

            unverified.forEach(r => {
                const tr = document.createElement("tr");
                let selectHtml = `<select class="form-select form-select-sm fw-bold" id="reconcileSelect_${r.Submission_ID}">`;
                selectHtml += `<option value="">-- พิมพ์/เลือกรายชื่อนักเรียนจริง --</option>`;
                GLOBAL_DB.Students_Roster.forEach(st => {
                    selectHtml += `<option value="${st.Student_ID}">${st.Student_ID} - ${st.Prefix}${st.First_Name} ${st.Last_Name} (${st.Category})</option>`;
                });
                selectHtml += `</select>`;

                tr.innerHTML = `
                    <td class="fw-bold"><code>${r.Submission_ID}</code></td>
                    <td><span class="badge bg-danger">${r.Student_ID_Raw}</span></td>
                    <td><span class="badge bg-secondary">${r.Submission_Type}</span></td>
                    <td class="small text-muted">${r.Timestamp}</td>
                    <td>${selectHtml}</td>
                    <td class="text-center">
                        <button class="btn btn-warning btn-sm fw-bold" onclick="confirmReconcile('${r.Submission_ID}')">
                            <i class="fa-solid fa-link me-1"></i> ยืนยันแมตช์
                        </button>
                    </td>
                `;
                body.appendChild(tr);
            });
        }

        async function confirmReconcile(subId) {
            const selVal = document.getElementById(`reconcileSelect_${subId}`).value;
            if (!selVal) { alert("กรุณาเลือกรายชื่อนักเรียนก่อน"); return; }
            const res = await apiFetch("/api/reconcile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submission_id: subId, matched_student_id: selVal })
            });
            const result = await res.json();
            await fetchData(); // Full reload to ensure state consistency after mutation (Optimized by caching on backend)
            alert("จับคู่รายชื่อสำเร็จ!");
        }

        // MODALS RENDER & FUNCTIONS
        function renderModalsData() {
            // Years modal
            const yearSel = document.getElementById("yearSelect");
            const yearBody = document.getElementById("yearManagerTableBody");
            yearSel.innerHTML = "";
            if (yearBody) yearBody.innerHTML = "";

            // Deduplicate for display
            const uniqueYears = [];
            GLOBAL_DB.Config_Metadata.Academic_Years.forEach(y => {
                if (!uniqueYears.find(uy => uy.year === y.year)) {
                    uniqueYears.push(y);
                }
            });

            uniqueYears.forEach(y => {
                const opt = document.createElement("option");
                opt.value = y.year;
                opt.innerText = `ปีการศึกษา ${y.year}`;
                const isActive = String(y.year) === String(GLOBAL_DB.Config_Metadata.Active_Academic_Year);
                if (isActive) opt.selected = true;
                yearSel.appendChild(opt);

                if (yearBody) {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td class="fw-bold">${escapeHTML(y.year)} ${isActive ? '<span class="badge bg-success ms-1">ใช้งานอยู่</span>' : ''}</td>
                        <td>${y.sheet_id ? `<a href="https://docs.google.com/spreadsheets/d/${encodeURIComponent(y.sheet_id)}/edit" target="_blank" rel="noopener">เปิด Google Sheet</a>` : '<span class="text-danger">ยังไม่เชื่อม</span>'}</td>
                        <td class="text-center">
                            <button class="btn btn-outline-danger btn-sm" onclick="deleteYear('${y.year}')" ${isActive ? 'disabled' : ''}><i class="fa-solid fa-trash"></i></button>
                        </td>
                    `;
                    yearBody.appendChild(tr);
                }
            });

            // Exam Manager Table (3 Examples)
            const exBody = document.getElementById("examManagerTableBody");
            exBody.innerHTML = "";

            const subjSelect = document.getElementById("newExamSubject");
            if (subjSelect) {
                subjSelect.innerHTML = "";
                GLOBAL_DB.Config_Metadata.Subjects.forEach(s => {
                    const opt = document.createElement("option");
                    opt.value = s.code;
                    opt.innerText = `${escapeHTML(s.code)} - ${escapeHTML(s.name)}`;
                    subjSelect.appendChild(opt);
                });
            }

            GLOBAL_DB.Exams_Header.forEach(ex => {
                const tr = document.createElement("tr");
                const activeBadge = ex.Is_Active ? '<span class="badge bg-success">ใช้งานอยู่</span>' : '<span class="badge bg-secondary">สลับใช้งาน</span>';
                tr.innerHTML = `
                    <td><code>${ex.Exam_ID}</code></td>
                    <td class="fw-bold">${escapeHTML(ex.Subject_Code)}</td>
                    <td>${escapeHTML(ex.Exam_Title)}</td>
                    <td class="text-center">${ex.Total_Questions} ข้อ</td>
                    <td class="text-center">${ex.Total_Score}</td>
                    <td class="text-center">${activeBadge}</td>
                    <td class="text-center">
                        <button class="btn btn-primary btn-sm me-1" onclick="selectExamDirect('${ex.Exam_ID}')"><i class="fa-solid fa-check"></i></button>
                        <button class="btn btn-outline-danger btn-sm" onclick="deleteExamSession('${ex.Exam_ID}')"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                exBody.appendChild(tr);
            });

            // Subject & Unit Manager Table
            const subBody = document.getElementById("subjectManagerTableBody");
            subBody.innerHTML = "";
            GLOBAL_DB.Config_Metadata.Subjects.forEach(s => {
                const tr = document.createElement("tr");
                const units = Array.isArray(s.units) ? s.units : [];
                const unitsList = units.map(u => `<span class="badge bg-light text-dark border me-1">หน่วย ${escapeHTML(u.unit_no)}: ${escapeHTML(u.unit_name)}</span>`).join(" ");
                tr.innerHTML = `
                    <td class="fw-bold"><code>${escapeHTML(s.code)}</code></td>
                    <td>${escapeHTML(s.name)}</td>
                    <td>${escapeHTML(s.grade_level)}</td>
                    <td>${unitsList || '<span class="text-muted">ไม่มีหน่วย</span>'}</td>
                    <td class="text-center">
                        <button class="btn btn-outline-danger btn-sm" onclick="deleteSubject('${escapeHTML(s.code)}')"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                subBody.appendChild(tr);
            });

            // Student Manager Table
            const stBody = document.getElementById("studentManagerTableBody");
            stBody.innerHTML = "";
            GLOBAL_DB.Students_Roster.forEach(st => {
                const tr = document.createElement("tr");
                const catBadge = st.Category === 'LD' ? '<span class="badge bg-warning text-dark">LD</span>' : '<span class="badge bg-success">ปกติ</span>';
                tr.innerHTML = `
                    <td class="text-center">${escapeHTML(st.Grade_Level || '-')}</td>
                    <td class="text-center">${escapeHTML(st.Room || '-')}</td>
                    <td class="text-center">${st.No || '-'}</td>
                    <td><code>${st.Student_ID}</code></td>
                    <td>${escapeHTML(st.Prefix || '')}${escapeHTML(st.First_Name || '')} ${escapeHTML(st.Last_Name || '')}</td>
                    <td class="text-center">${escapeHTML(st.Gender || '-')}</td>
                    <td class="text-center">${escapeHTML(st.DOB || '-')}</td>
                    <td class="text-center">${catBadge}</td>
                    <td class="small text-muted text-center">${escapeHTML((st.LD_Types || []).join(", "))}</td>
                    <td class="text-center">
                        <button class="btn btn-outline-primary btn-sm me-1" onclick="editStudentRoster('${st.Student_ID}')"><i class="fa-solid fa-edit"></i></button>
                        <button class="btn btn-outline-danger btn-sm" onclick="deleteStudent('${st.Student_ID}')"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                stBody.appendChild(tr);
            });

        }

        async function selectExamDirect(exId) {
            const res = await apiFetch("/api/exams/select", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ exam_id: exId })
            });
            const result = await res.json();
            await fetchData(); // Full reload to ensure state consistency after mutation (Optimized by caching on backend)
        }

        function addExamPartRow() {
            const container = document.getElementById("newExamPartsContainer");
            const idx = container.querySelectorAll(".exam-part-row").length + 1;
            const div = document.createElement("div");
            div.className = "row g-2 mb-2 align-items-end exam-part-row";
            div.innerHTML = `
                <div class="col-md-5">
                    <input type="text" class="form-control form-control-sm part-name" placeholder="เช่น ตอนที่ 1" value="ตอนที่ ${idx}">
                </div>
                <div class="col-md-3">
                    <input type="number" class="form-control form-control-sm part-qs" value="10">
                </div>
                <div class="col-md-3">
                    <input type="number" class="form-control form-control-sm part-score" value="10">
                </div>
                <div class="col-md-1 text-end">
                    <button class="btn btn-outline-danger btn-sm" onclick="this.closest('.exam-part-row').remove()"><i class="fa-solid fa-times"></i></button>
                </div>
            `;
            container.appendChild(div);
        }

        async function addNewExamSession() {
            const title = document.getElementById("newExamTitle").value.trim();
            if (!title) { alert("กรุณากรอกชื่อรายการข้อสอบ"); return; }

            const parts = [];
            let totalQs = 0;
            let totalScore = 0;

            document.querySelectorAll(".exam-part-row").forEach((row, index) => {
                const name = row.querySelector(".part-name").value.trim() || `ตอนที่ ${index + 1}`;
                const qs = parseInt(row.querySelector(".part-qs").value) || 0;
                const score = parseFloat(row.querySelector(".part-score").value) || 0;

                if (qs > 0) {
                    parts.push({ name, qs, score });
                    totalQs += qs;
                    totalScore += score;
                }
            });

            if (parts.length === 0 || totalQs === 0) {
                alert("กรุณากำหนดจำนวนข้ออย่างน้อย 1 ตอน");
                return;
            }

            const subjCode = document.getElementById("newExamSubject").value;
            const subjObj = GLOBAL_DB.Config_Metadata.Subjects.find(s => s.code === subjCode) || {};

            const payload = {
                exam: {
                    Subject_Code: subjCode || "Unknown",
                    Subject_Name: subjObj.name || "Unknown",
                    Unit_Name: "หน่วยสอบรวม",
                    Term: "1", Grade_Level: subjObj.grade_level || "ไม่ระบุ",
                    Exam_Title: title,
                    Total_Questions: totalQs,
                    Total_Score: totalScore,
                    Passing_Score: totalScore / 2,
                    Exam_Date: new Date().toISOString().split('T')[0],
                    Created_By: "ครูผู้สอน",
                    parts: parts
                }
            };

            const res = await apiFetch("/api/exams/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            await fetchData(); // Full reload to ensure state consistency after mutation (Optimized by caching on backend)

            document.getElementById("newExamTitle").value = "";
            try { bootstrap.Modal.getInstance(document.getElementById("examManagerModal")).hide(); } catch(e){}

            alert("สร้างรายการวิเคราะห์ข้อสอบใหม่สำเร็จ!");
        }

        async function deleteExamSession(exId) {
            if (!confirm(`ยืนยันการลบรายการวิเคราะห์ข้อสอบรหัส ${exId}?`)) return;
            const res = await apiFetch("/api/exams/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ exam_id: exId })
            });
            const result = await res.json();
            await fetchData(); // Full reload to ensure state consistency after mutation (Optimized by caching on backend)
        }

        async function saveSubjectFromModal() {
            const code = document.getElementById("editSubjCode").value.trim();
            const name = document.getElementById("editSubjName").value.trim();
            const grade = document.getElementById("editSubjGrade").value.trim();

            if (!code || !name) { alert("กรุณากรอกรหัสวิชาและชื่อวิชา"); return; }

            const unitNo = document.getElementById("editUnitNo").value.trim();
            const unitName = document.getElementById("editUnitName").value.trim();
            const existing = GLOBAL_DB.Config_Metadata.Subjects.find(s => s.code === code);
            const units = Array.isArray(existing?.units) ? [...existing.units] : [];
            if (unitName) {
                const normalizedNo = unitNo || String(units.length + 1);
                const found = units.findIndex(u => String(u.unit_no) === normalizedNo);
                const unit = { unit_no: normalizedNo, unit_name: unitName };
                if (found >= 0) units[found] = unit; else units.push(unit);
            }
            const payload = {
                subject: {
                    code: code, name: name, grade_level: grade,
                    units
                }
            };
            const message = document.getElementById("subjectSaveMessage");
            message.className = "small mb-2 text-primary"; message.textContent = "กำลังบันทึกลง Google Sheet…";
            try {
                const result = await (await apiFetch("/api/subjects/save", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})).json();
                applySnapshot(result); renderAll();
                message.className = "small mb-2 text-success"; message.textContent = "บันทึกรายวิชาเรียบร้อยแล้ว";
                document.getElementById("editSubjCode").value = "";
                document.getElementById("editSubjName").value = "";
                document.getElementById("editUnitNo").value = "";
                document.getElementById("editUnitName").value = "";
            } catch(error) {
                message.className = "small mb-2 text-danger"; message.textContent = error.message;
            }
        }

        async function deleteSubject(code) {
            if (!confirm(`ยืนยันการลบวิชารหัส ${code}?`)) return;
            const res = await apiFetch("/api/subjects/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: code })
            });
            const result = await res.json();
            await fetchData(); // Full reload to ensure state consistency after mutation (Optimized by caching on backend)
        }

        async function changeActiveYear() {
            const y = document.getElementById("yearSelect").value;
            const res = await apiFetch("/api/years/select", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ year: y })
            });
            const result = await res.json();
            await fetchData(); // Full reload to ensure state consistency after mutation (Optimized by caching on backend)
        }

        async function checkBackendHealth() {
            const text = document.getElementById("backendHealthText");
            text.className = "small text-primary"; text.textContent = "กำลังตรวจ Apps Script และทะเบียนปี…";
            try {
                const health = await (await apiFetch("/api/health")).json();
                if (health.status !== "ready") throw new Error(health.message || "Apps Script ยังไม่พร้อม");
                text.className = "small text-success";
                text.textContent = `เชื่อมต่อ Apps Script v${health.version} แล้ว • มี ${health.year_count} ปีการศึกษา`;
            } catch(error) {
                text.className = "small text-danger"; text.textContent = error.message;
            }
        }

        async function addNewYear() {
            const y = document.getElementById("newYearInput").value.trim();
            if (!y) { alert("กรุณากรอกข้อมูลปีการศึกษา"); return; }
            const sheetId = document.getElementById("newYearSheetInput").value.trim();
            const message = document.getElementById("yearSaveMessage");
            message.className = "small mb-2 text-primary"; message.textContent = sheetId ? "กำลังเชื่อมและเตรียม Google Sheet…" : "กำลังสร้าง Google Sheet ใหม่…";
            try {
                const result = await (await apiFetch("/api/years/add", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({year:y,sheet_id:sheetId})})).json();
                applySnapshot(result); renderAll();
                document.getElementById("newYearInput").value = "";
                document.getElementById("newYearSheetInput").value = "";
                message.className = "small mb-2 text-success"; message.textContent = "เพิ่มปีและเตรียม Google Sheet เรียบร้อยแล้ว";
            } catch(error) {
                message.className = "small mb-2 text-danger"; message.textContent = error.message;
            }
        }

        async function deleteYear(y) {
            if (!confirm(`ยืนยันการลบปีการศึกษา ${y} ใช่หรือไม่?`)) return;
            const res = await apiFetch("/api/years/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ year: y })
            });
            const result = await res.json();
            await fetchData(); // Full reload to ensure state consistency after mutation (Optimized by caching on backend)
        }

        function toggleLdCheckboxes() {
            const cat = document.getElementById("editStCategory").value;
            const container = document.getElementById("ldCheckboxesContainer");
            if (cat === "LD") container.classList.remove("d-none");
            else container.classList.add("d-none");
        }

        async function saveStudentFromModal() {
            const stId = document.getElementById("editStId").value.trim();
            if (!stId) { alert("กรุณากรอกรหัสนักเรียน"); return; }
            const category = document.getElementById("editStCategory").value;

            const ldTypes = [];
            if (category === "LD") {
                if (document.getElementById("ldReading").checked) ldTypes.push("ด้านการอ่าน");
                if (document.getElementById("ldWriting").checked) ldTypes.push("ด้านการเขียน");
                if (document.getElementById("ldMath").checked) ldTypes.push("ด้านการคำนวณ");
                if (document.getElementById("ldBehavior").checked) ldTypes.push("ด้านพฤติกรรม/สมาธิสั้น");
            }

            const payload = {
                student: {
                    Student_ID: stId,
                    Prefix: document.getElementById("editStPrefix").value.trim(),
                    First_Name: document.getElementById("editStFirst").value.trim(),
                    Last_Name: document.getElementById("editStLast").value.trim(),
                    Gender: document.getElementById("editStGender").value.trim(),
                    DOB: document.getElementById("editStDOB").value.trim(),
                    Grade_Level: document.getElementById("editStGrade").value.trim(),
                    Room: document.getElementById("editStRoom").value.trim(),
                    No: parseInt(document.getElementById("editStNo").value) || 0,
                    Status: "ปกติ",
                    Category: category, LD_Types: ldTypes
                }
            };

            const res = await apiFetch("/api/students/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            await fetchData(); // Full reload to ensure state consistency after mutation (Optimized by caching on backend)

            // Clear form and reset button
            document.getElementById("editStId").value = '';
            document.getElementById("editStPrefix").value = '';
            document.getElementById("editStFirst").value = '';
            document.getElementById("editStLast").value = '';
            document.getElementById("editStGender").value = '';
            document.getElementById("editStDOB").value = '';
            document.getElementById("editStGrade").value = '';
            document.getElementById("editStRoom").value = '';
            document.getElementById("editStNo").value = '';
            document.getElementById("saveStudentBtn").innerHTML = '<i class="fa-solid fa-save me-1"></i> บันทึกเพิ่มข้อมูลปกติ';
            alert("บันทึกข้อมูลนักเรียนสำเร็จ!");
        }

        function editStudentRoster(stId) {
            const st = GLOBAL_DB.Students_Roster.find(s => s.Student_ID === stId);
            if (!st) return;
            document.getElementById('editStId').value = st.Student_ID || '';
            document.getElementById('editStPrefix').value = st.Prefix || '';
            document.getElementById('editStFirst').value = st.First_Name || '';
            document.getElementById('editStLast').value = st.Last_Name || '';
            document.getElementById('editStGender').value = st.Gender || '';
            document.getElementById('editStDOB').value = st.DOB || '';
            document.getElementById('editStGrade').value = st.Grade_Level || '';
            document.getElementById('editStRoom').value = st.Room || '';
            document.getElementById('editStNo').value = st.No || '';
            document.getElementById('editStCategory').value = st.Category || 'ปกติ';
            toggleLdCheckboxes();

            if (st.Category === 'LD' && st.LD_Types) {
                document.getElementById('ldReading').checked = st.LD_Types.includes('ด้านการอ่าน');
                document.getElementById('ldWriting').checked = st.LD_Types.includes('ด้านการเขียน');
                document.getElementById('ldMath').checked = st.LD_Types.includes('ด้านการคำนวณ');
                document.getElementById('ldBehavior').checked = st.LD_Types.includes('ด้านพฤติกรรม/สมาธิสั้น');
            } else {
                document.getElementById('ldReading').checked = false;
                document.getElementById('ldWriting').checked = false;
                document.getElementById('ldMath').checked = false;
                document.getElementById('ldBehavior').checked = false;
            }

            document.getElementById("saveStudentBtn").innerHTML = '<i class="fa-solid fa-edit me-1"></i> บันทึกการแก้ไข (ID: ' + st.Student_ID + ')';
        }

        async function deleteStudent(stId) {
            if (!confirm(`ยืนยันการลบนักเรียนรหัส ${stId}?`)) return;
            const res = await apiFetch("/api/students/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ student_id: stId })
            });
            const result = await res.json();
            await fetchData(); // Full reload to ensure state consistency after mutation (Optimized by caching on backend)
        }

        function exportScoresCSV() {
            const parts = GLOBAL_DB.Exam_Parts;
            const rows = [['รหัสนักเรียน','ชื่อ','ห้อง','คะแนนรวม','ผ่าน/ไม่ผ่าน',...parts.map(p=>p.Part_Name)]];
            GLOBAL_ANALYSIS.student_scores.forEach(sc => {
                const st=GLOBAL_DB.Students_Roster.find(s=>s.Student_ID===sc.Student_ID)||{};
                rows.push([sc.Student_ID,sc.Student_Name,st.Room,sc.Total_Score,sc.Total_Score>=activeExam().Passing_Score?'ผ่าน':'ไม่ผ่าน',...parts.map(p=>sc.Part_Scores[p.Part_ID]??0)]);
            });
            download('Scores_'+activeExam().Exam_ID+'.csv',rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv');
        }

        function openPrintRosterModal() {
            // ปิด Modal จัดการนักเรียนก่อน เพื่อไม่ให้ซ้อนกัน
            const stModalEl = document.getElementById("studentManagerModal");
            const stModal = bootstrap.Modal.getInstance(stModalEl);
            if(stModal) {
                stModal.hide();
            }

            const sel = document.getElementById("rosterRoomSelect");
            sel.innerHTML = '<option value="ALL">-- พิมพ์ทุกห้องที่มีในระบบ --</option>';

            const rooms = {};
            GLOBAL_DB.Students_Roster.forEach(st => {
                if (st.Grade_Level && st.Room) {
                    const key = `${st.Grade_Level} ห้อง ${st.Room}`;
                    rooms[key] = { grade: st.Grade_Level, room: st.Room };
                }
            });

            Object.keys(rooms).sort().forEach(k => {
                sel.innerHTML += `<option value="${rooms[k].grade}|${rooms[k].room}">${k}</option>`;
            });

            // เปิด Modal พิมพ์
            new bootstrap.Modal(document.getElementById("printRosterModal")).show();
        }

        function generateRosterPrint() {
            const schoolName = document.getElementById("rosterSchoolName").value || "โรงเรียน";
            const roomVal = document.getElementById("rosterRoomSelect").value;

            let studentsToPrint = GLOBAL_DB.Students_Roster;
            if (roomVal !== "ALL") {
                const [g, r] = roomVal.split('|');
                studentsToPrint = studentsToPrint.filter(st => st.Grade_Level === g && st.Room === r);
            }

            // Group by Grade+Room
            const groups = {};
            studentsToPrint.forEach(st => {
                const key = `${escapeHTML(st.Grade_Level || '-')} ห้อง ${escapeHTML(st.Room || '-')}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(st);
            });

            let html = `
                <html>
                <head>
                    <title>ใบรายชื่อนักเรียน - ${schoolName}</title>
                    <style>
                        body { font-family: 'Sarabun', sans-serif; font-size: 14px; margin: 20px; }
                        .page-break { page-break-after: always; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid #000; padding: 5px 8px; text-align: left; }
                        th { background-color: #f0f0f0; text-align: center; }
                        h2, h3 { text-align: center; margin: 5px 0; }
                    </style>
                </head>
                <body>
            `;

            Object.keys(groups).sort().forEach((key, index) => {
                // sort students by ID
                const list = groups[key].sort((a,b) => a.Student_ID.localeCompare(b.Student_ID));

                // Chunk by 40 students per page
                const chunkSize = 40;
                for (let c = 0; c < list.length; c += chunkSize) {
                    const chunk = list.slice(c, c + chunkSize);

                    html += `
                        <div>
                            <h2>${schoolName}</h2>
                            <h3>ใบรายชื่อนักเรียน ชั้น ${key}</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th style="width:50px">ลำดับ</th>
                                        <th style="width:100px">รหัสนักเรียน</th>
                                        <th>ชื่อ - นามสกุล</th>
                                        <th style="width:120px">หมายเหตุ</th>
                                    </tr>
                                </thead>
                                <tbody>
                    `;

                    chunk.forEach((st, i) => {
                        html += `
                            <tr>
                                <td style="text-align:center;">${c + i + 1}</td>
                                <td style="text-align:center;">${st.Student_ID}</td>
                                <td>${st.Prefix||''}${st.First_Name||''} ${st.Last_Name||''}</td>
                                <td></td>
                            </tr>
                        `;
                    });

                    html += `
                                </tbody>
                            </table>
                        </div>
                    `;

                    // Add page break if there are more chunks in this room, OR if there are more rooms
                    if (c + chunkSize < list.length || index < Object.keys(groups).length - 1) {
                        html += `<div class="page-break"></div>`;
                    }
                }
            });

            html += `
                <script>
                    window.onload = function() { window.print(); }
                <\/script>
                </body>
                </html>
            `;

            const printWindow = window.open('', '_blank');
            printWindow.document.write(html);
            printWindow.document.close();
        }

        function switchTab(tabId) {
            const btn = document.getElementById(`${tabId}-btn`);
            if (btn) {
                const tab = new bootstrap.Tab(btn);
                tab.show();
            }
        }

// UI state belongs to this browser tab, never to the shared spreadsheet.
const VIEW = { year: sessionStorage.getItem('eqms.year') || '', exam_id: sessionStorage.getItem('eqms.exam') || null };
let viewRevision = 0, pendingSnapshot = null, mutationBusy = false, renderVersion = 0;
let sessionToken = sessionStorage.getItem('eqms.session') || '';
const tableState = new Map();
function escapeHTML(value) { return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function activeExam() { return GLOBAL_DB?.Exams_Header.find(e=>e.Is_Active) || {}; }
function editableKeys() { return (GLOBAL_DB?.Exam_Items_Key || []).filter(k=>k.Exam_ID===activeExam().Exam_ID).slice().sort((a,b)=>a.Q_Num-b.Q_Num); }
function status(message, error=false) {
    const el=document.getElementById('appStatus');el.textContent=message;el.classList.toggle('is-error',error);
}
function apiURL(action) {
    const configured=window.EQMS_CONFIG?.apiBase;
    const base=configured ? configured.replace(/\/$/,'')+'/' : new URL('./',location.href).href;
    return new URL('api/'+action,base).href;
}
async function apiFetch(path,options={}) {
    const action=path.replace(/^\/api\//,''), body=options.body?JSON.parse(options.body):{};
    const navigation=['years/select','years/add','years/delete','exams/select'].includes(action);
    const write=!['health','meta','data','exams/select','years/select','exams/subject_overview','export/json','export/csv'].includes(action);
    if(mutationBusy) throw new Error('กำลังบันทึก กรุณารอให้เสร็จก่อน');
    if(navigation) { viewRevision++;pendingSnapshot=null; }
    const revision=viewRevision;
    const payload={...VIEW,...body};
    if(action==='years/select' || action==='years/add') payload.exam_id=null;
    if(write) mutationBusy=true;
    status(write?'กำลังบันทึก…':'กำลังโหลดข้อมูล…');
    try {
        const response=await fetch(apiURL(action),{method:'POST',headers:{'Content-Type':'application/json',...(sessionToken?{Authorization:'Bearer '+sessionToken}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});
        if(response.status===401) { sessionToken='';sessionStorage.removeItem('eqms.session');document.getElementById('loginPanel').hidden=false;throw new Error('กรุณาเข้าสู่ระบบ'); }
        const data=await response.json();
        if(!response.ok || data.error) throw new Error(data.error || 'ติดต่อระบบไม่สำเร็จ');
        if(revision!==viewRevision) throw new Error('STALE_VIEW');
        if(data.db) { pendingSnapshot=data;data._revision=revision; }
        status(write?'บันทึกเรียบร้อยแล้ว':'ข้อมูลพร้อมใช้งาน');
        return {ok:true,json:async()=>data};
    } catch(error) {
        if(error.message!=='STALE_VIEW') status(error.name==='TimeoutError'?'การเชื่อมต่อใช้เวลานาน กรุณาโหลดข้อมูลตรวจสอบก่อนบันทึกซ้ำ':error.message,true);
        throw error;
    } finally { if(write) mutationBusy=false; }
}
function applySnapshot(data) {
    if(!data?.db || (data._revision!==undefined && data._revision!==viewRevision)) return false;
    GLOBAL_DB=data.db;GLOBAL_ANALYSIS=data.analysis;
    VIEW.year=data.year || '';VIEW.exam_id=data.exam_id || null;
    sessionStorage.setItem('eqms.year',VIEW.year);sessionStorage.setItem('eqms.exam',VIEW.exam_id || '');
    pendingSnapshot=null;return true;
}
async function fetchData() {
    const data=pendingSnapshot || await (await apiFetch('/api/data')).json();
    if(applySnapshot(data)) {renderAll();renderVersion++;}
}
async function startApp() {
    document.getElementById('loginForm').addEventListener('submit',async event=>{
        event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;
        try {
            const res=await fetch(apiURL('session'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('ownerPassword').value})});
            const data=await res.json();if(!res.ok)throw new Error(data.error||'เข้าสู่ระบบไม่สำเร็จ');
            sessionToken=data.token;sessionStorage.setItem('eqms.session',sessionToken);
            document.getElementById('ownerPassword').value='';document.getElementById('loginPanel').hidden=true;
            await fetchData();
        } catch(e) {document.getElementById('loginError').textContent=e.message;} finally {button.disabled=false;}
    });
    window.addEventListener('unhandledrejection',e=>{if(e.reason?.message==='STALE_VIEW'){e.preventDefault();return;}status(e.reason?.message||'เกิดข้อผิดพลาด กรุณาลองใหม่',true);});
    document.addEventListener('shown.bs.tab',()=>{if($.fn.dataTable) $.fn.dataTable.tables({visible:true,api:true}).columns.adjust();});
    document.addEventListener('shown.bs.modal',()=>{if($.fn.dataTable) $.fn.dataTable.tables({visible:true,api:true}).columns.adjust();});
    document.addEventListener('input',event=>{if(event.target.closest('#keyEditorTableBody')) status('มีการแก้ไขเฉลยที่ยังไม่ได้บันทึก');});
    try {await fetchData();} catch(e) {
        if(e.message.includes('ไม่พบปีการศึกษา') || e.message.includes('ไม่พบข้อสอบ')) {VIEW.year='';VIEW.exam_id=null;await fetchData();}
    }
}
function resetTables() {
    document.querySelectorAll('table').forEach(table=>{
        if($.fn.DataTable.isDataTable(table)) {
            const api=$(table).DataTable();tableState.set(table.id,{order:api.order(),search:api.search(),page:api.page(),length:api.page.len(),columns:table.tHead?.rows[0]?.cells.length});api.destroy();
        }
    });
}
function activateTables() {
    document.querySelectorAll('table').forEach((table,i)=>{
        if(!table.tHead || !table.tBodies.length || $.fn.DataTable.isDataTable(table))return;
        if(!table.id)table.id='eqmsTable_'+i;
        // Editing tables keep every input in the DOM; sort rows without pagination.
        if(table.querySelector('input,select')) { makeEditableSortable(table); return; }
        const cols=table.tHead.rows[0]?.cells.length;
        if(!cols || [...table.tBodies[0].rows].some(r=>r.cells.length!==cols || [...r.cells].some(c=>c.colSpan>1)))return;
        const state=tableState.get(table.id), compatible=state?.columns===cols;
        const api=$(table).DataTable({pageLength:state?.length||10,lengthMenu:[10,25,50,100],order:compatible?state.order:[],search:{search:state?.search||''},autoWidth:false,language:{search:'ค้นหา:',lengthMenu:'แสดง _MENU_ รายการ',info:'แสดง _START_–_END_ จาก _TOTAL_ รายการ',infoEmpty:'ยังไม่มีข้อมูล',emptyTable:'ยังไม่มีข้อมูล',zeroRecords:'ไม่พบข้อมูลที่ค้นหา',paginate:{next:'ถัดไป',previous:'ก่อนหน้า'}}});
        if(state?.page)api.page(Math.min(state.page,Math.max(0,api.page.info().pages-1))).draw('page');
    });
}
function makeEditableSortable(table) {
    [...table.tHead.rows[0].cells].forEach((th,index)=>{
        if(th.dataset.eqmsSort)return;th.dataset.eqmsSort='true';th.tabIndex=0;th.title='คลิกเพื่อเรียงข้อมูล';
        const sort=()=>{const direction=th.getAttribute('aria-sort')==='ascending'?-1:1;[...table.tHead.rows[0].cells].forEach(c=>c.removeAttribute('aria-sort'));th.setAttribute('aria-sort',direction===1?'ascending':'descending');
            const value=row=>row.cells[index].querySelector('input,select')?.value??row.cells[index].textContent.trim();
            [...table.tBodies[0].rows].sort((a,b)=>value(a).localeCompare(value(b),'th',{numeric:true})*direction).forEach(row=>table.tBodies[0].appendChild(row));};
        th.addEventListener('click',sort);th.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();sort();}});
    });
}
function showAnalysisState() {
    const notice=document.getElementById('analysisNotice'), keys=editableKeys(), missing=keys.filter(k=>!k.Answer_Key).length;
    notice.hidden=false;
    notice.textContent=!VIEW.year?'เริ่มต้นโดยเพิ่มปีการศึกษา ระบบจะสร้างไฟล์ Google Sheets แยกให้โดยอัตโนมัติ':!keys.length?'เพิ่มรายวิชาและสร้างข้อสอบเพื่อเริ่มกรอกเฉลย':missing?`เฉลยยังไม่ครบ ${missing} จาก ${keys.length} ข้อ • ไปที่แก้ไขเฉลยก่อนใช้ผลวิเคราะห์`:!GLOBAL_ANALYSIS.summary.student_count?'เฉลยพร้อมแล้ว • เพิ่มผู้เข้าสอบและบันทึกคำตอบเพื่อดูผลวิเคราะห์':'';
    notice.hidden=!notice.textContent;
    document.querySelectorAll('[data-reliability-label]').forEach(el=>el.textContent=GLOBAL_ANALYSIS.summary.reliability_method || 'ความเชื่อมั่น');
    document.getElementById('activeExamTitleBadge').textContent=activeExam().Exam_Title || 'ยังไม่มีข้อสอบ';
}
function csvCell(v) {let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function download(name,content,type) {const url=URL.createObjectURL(new Blob([type==='text/csv'?'\uFEFF':'',content],{type:type+';charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportData(format) {const data=await (await apiFetch('/api/export/'+format)).json();download('EQMS_'+VIEW.year+'.'+format,format==='json'?JSON.stringify(data.data,null,2):data.csv,format==='json'?'application/json':'text/csv');}
