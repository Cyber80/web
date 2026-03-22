/**
 * Sidebar & Topbar component — inject ลงทุกหน้าอัตโนมัติ
 * ใช้: initPage('meters') ใน DOMContentLoaded
 */
function initPage(activePage) {
  if (!Auth.check()) return false;
  const user = Auth.user();

  // ── Sidebar HTML ──────────────────────────────────────────────
  const sidebarHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">
          <svg viewBox="0 0 24 24"><path d="M12 2C8 8 5 12 5 16a7 7 0 0 0 14 0c0-4-3-8-7-14z" opacity=".35"/><path d="M12 6c-2.5 4-4 7-4 10a4 4 0 0 0 8 0c0-3-1.5-6-4-10z"/></svg>
        </div>
        <h2>ระบบประปาหมู่บ้าน</h2>
        <p>Water Management</p>
      </div>
      <div class="village-badge">
        <div class="lbl">หมู่บ้านของคุณ</div>
        <div class="name">${user.village_name || '—'}</div>
        <div class="area">${user.village_area || '—'}</div>
      </div>
      <nav class="nav-sec">
        <div class="nav-sec-title">เมนูหลัก</div>
        ${navItem('dashboard', 'dashboard', 'หน้าหลัก', `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`, activePage)}
        ${navItem('meters', 'meters', 'บันทึกมิเตอร์', `<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>`, activePage)}
        ${navItem('receipts', 'receipts', 'ใบเสร็จ / ชำระเงิน', `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`, activePage)}
        ${navItem('members', 'members', 'ทะเบียนสมาชิก', `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>`, activePage)}
        <div class="nav-sec-title" style="margin-top:6px">รายงาน & พิมพ์</div>
        ${navItem('print-form', 'print-form', 'พิมพ์แบบฟอร์ม', `<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>`, activePage)}
        ${navItem('settings', 'settings', 'ตั้งค่าระบบ', `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`, activePage)}
      </nav>
      <div class="sidebar-user" onclick="logout()">
        <div class="user-av">${(user.full_name || 'A')[0]}</div>
        <div>
          <div class="user-name">${user.full_name || 'Admin'}</div>
          <div class="user-role">${user.role === 'admin' ? 'ผู้ดูแลระบบ' : user.role || ''}</div>
        </div>
        <svg style="margin-left:auto;flex-shrink:0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      </div>
    </aside>
    <button class="mobile-toggle" onclick="toggleSidebar()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
    <div class="overlay" id="overlay" onclick="toggleSidebar()"></div>
  `;

  // inject sidebar ก่อน main
  const main = document.querySelector('.main');
  if (main) main.insertAdjacentHTML('beforebegin', sidebarHTML);

  // ── Topbar date ───────────────────────────────────────────────
  const dateEl = document.getElementById('topbarDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('th-TH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  return true;
}

function navItem(page, active, label, svgPath, currentPage) {
  const isActive = page === currentPage;
  return `
    <a href="${page}.html" class="nav-item${isActive ? ' active' : ''}">
      <svg viewBox="0 0 24 24">${svgPath}</svg>
      ${label}
    </a>`;
}

function logout() {
  if (!confirm('ต้องการออกจากระบบใช่ไหม?')) return;
  Auth.clear();
  window.location.href = 'index.html';
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}
