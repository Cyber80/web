let workloads = [];

const $ = id => document.getElementById(id);

async function api(url, options={}) {
  const res = await fetch(url, {
    ...options,
    headers: {"Content-Type":"application/json", ...(options.headers || {})}
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.detail || "เกิดข้อผิดพลาด");
  return data;
}

function fmt(x) {
  return new Date(x).toLocaleString("th-TH", {dateStyle:"medium", timeStyle:"short"});
}

async function init() {
  const me = await api("/api/me");
  if (!me.authenticated) {
    $("login").hidden = false;
    $("app").hidden = true;
    return;
  }
  $("login").hidden = true;
  $("app").hidden = false;
  $("account").innerHTML = `<span>${me.user.name || me.user.email}</span>`;
  await load();
}

async function load() {
  workloads = await api("/api/workloads");
  render();
}

function render() {
  const mePrivate = workloads.filter(x => x.visibility === "private");
  $("total").textContent = workloads.length;
  $("privateCount").textContent = mePrivate.length;
  $("publicCount").textContent = workloads.filter(x => x.visibility === "public").length;
  $("syncedCount").textContent = workloads.filter(x => x.sync_status === "synced").length;

  $("list").innerHTML = workloads.map(w => `
    <article class="card workload">
      <div class="badges">
        <span class="badge ${w.visibility}">${w.visibility === "private" ? "PRIVATE" : "PUBLIC"}</span>
        <span class="badge sync-${w.sync_status}">${w.sync_status}</span>
      </div>
      <h3>${esc(w.title)}</h3>
      <p>${esc(w.description || "")}</p>
      <div class="meta">🕒 ${fmt(w.start_at)} — ${fmt(w.end_at)}</div>
      ${w.location ? `<div class="meta">📍 ${esc(w.location)}</div>` : ""}
      <div class="actions">
        <button class="btn" onclick="editForm(${w.id})">แก้ไข</button>
        <button class="btn" onclick="syncOne(${w.id})">Sync Calendar</button>
        <button class="btn danger" onclick="removeWorkload(${w.id})">ลบ</button>
      </div>
    </article>
  `).join("");
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function openForm(w=null) {
  $("modal").hidden = false;
  $("formTitle").textContent = w ? "แก้ไขภาระงาน" : "เพิ่มภาระงาน";
  $("id").value = w?.id || "";
  $("title").value = w?.title || "";
  $("description").value = w?.description || "";
  $("start_at").value = w ? localInput(w.start_at) : "";
  $("end_at").value = w ? localInput(w.end_at) : "";
  $("location").value = w?.location || "";
  $("visibility").value = w?.visibility || "private";
}

function closeForm() { $("modal").hidden = true; }

function localInput(iso) {
  const d = new Date(iso);
  const p = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

$("workloadForm").addEventListener("submit", async e => {
  e.preventDefault();
  const id = $("id").value;
  const payload = {
    title: $("title").value,
    description: $("description").value,
    start_at: new Date($("start_at").value).toISOString(),
    end_at: new Date($("end_at").value).toISOString(),
    location: $("location").value,
    visibility: $("visibility").value
  };
  try {
    await api(id ? `/api/workloads/${id}` : "/api/workloads", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    closeForm();
    await load();
  } catch(e) { alert(e.message); }
});

function editForm(id) {
  const w = workloads.find(x => x.id === id);
  openForm(w);
}

async function removeWorkload(id) {
  if (!confirm("ยืนยันลบภาระงานนี้?")) return;
  try {
    await api(`/api/workloads/${id}`, {method:"DELETE"});
    await load();
  } catch(e) { alert(e.message); }
}

async function syncOne(id) {
  try {
    await api(`/api/workloads/${id}/sync`, {method:"POST"});
    await load();
    alert("Sync สำเร็จ");
  } catch(e) { alert(e.message); }
}

async function syncAll() {
  try {
    await api("/api/sync-all", {method:"POST"});
    await load();
    alert("ดำเนินการ Sync แล้ว");
  } catch(e) { alert(e.message); }
}

init();
