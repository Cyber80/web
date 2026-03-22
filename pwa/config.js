/**
 * ระบบประปาหมู่บ้าน — Config & Helpers
 * แก้เพียง GAS_URL บรรทัดเดียว แล้วทุกหน้าใช้ได้ทันที
 */

// ─── แก้ตรงนี้จุดเดียว ────────────────────────────────────────────────────────
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwy_bWjAz1CkBOAvZOCXIbAB8d98lNRMqD7wbRvEyUt-nrklesnvSYMI098Z5zP5kte/exec';
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ส่ง request ไป GAS
 * ใช้ POST + Content-Type: text/plain
 * → Browser ไม่ส่ง preflight OPTIONS → ไม่มีปัญหา CORS เลย
 */
async function api(action, data = {}) {
  const body = JSON.stringify({ action, ...data });
  const r = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/** api พร้อม token อัตโนมัติ */
async function apiAuth(action, data = {}) {
  return api(action, { ...data, token: Auth.token() });
}

/** Auth helpers — localStorage ใช้ได้ปกติบน Cloudflare/GitHub */
const Auth = {
  save(token, user) {
    localStorage.setItem('prapa_token', token);
    localStorage.setItem('prapa_user', JSON.stringify(user));
  },
  token() {
    return localStorage.getItem('prapa_token') || '';
  },
  user() {
    try { return JSON.parse(localStorage.getItem('prapa_user') || '{}'); }
    catch { return {}; }
  },
  clear() {
    localStorage.removeItem('prapa_token');
    localStorage.removeItem('prapa_user');
  },
  check(requiredRole) {
    if (!this.token()) {
      window.location.href = 'index.html';
      return false;
    }
    if (requiredRole && this.user().role !== requiredRole) {
      alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }
};

/** Toast notification */
function toast(type, msg, dur = 3000) {
  let wrap = document.getElementById('_toastWrap');
  if (!wrap) {
    wrap = Object.assign(document.createElement('div'), { id: '_toastWrap' });
    Object.assign(wrap.style, {
      position: 'fixed', bottom: '24px', right: '24px',
      zIndex: '9999', display: 'flex', flexDirection: 'column', gap: '8px'
    });
    document.body.appendChild(wrap);
  }
  const colors = { ok: '#059669', err: '#dc2626', info: '#0a2540', warn: '#d97706' };
  const el = document.createElement('div');
  Object.assign(el.style, {
    padding: '12px 18px', borderRadius: '10px',
    fontSize: '14px', fontWeight: '600', color: 'white',
    background: colors[type] || colors.info,
    boxShadow: '0 4px 20px rgba(0,0,0,.15)',
    fontFamily: "'Sarabun', sans-serif",
    animation: 'toastIn .3s ease',
    minWidth: '200px'
  });
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), dur);
}

/** Spinner helper */
function setLoading(btn, loading, text = 'กำลังบันทึก...') {
  btn.disabled = loading;
  btn.dataset.origText = btn.dataset.origText || btn.innerHTML;
  btn.innerHTML = loading
    ? `<span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:white;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:6px"></span>${text}`
    : btn.dataset.origText;
}

/** Format date เป็น Thai */
function fmtDate(d, opt) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('th-TH', opt || { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return String(d); }
}

/** แปลงตัวเลขเป็นตัวอักษรบาท */
function bahtText(n) {
  const ones = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const tens  = ['', 'สิบ', 'ยี่สิบ', 'สามสิบ', 'สี่สิบ', 'ห้าสิบ', 'หกสิบ', 'เจ็ดสิบ', 'แปดสิบ', 'เก้าสิบ'];
  if (!n || n === 0) return 'ศูนย์บาทถ้วน';
  const int = Math.floor(n), dec = Math.round((n - int) * 100);
  function two(x) {
    const t = Math.floor(x / 10), o = x % 10;
    return (t ? tens[t] + (t === 1 && o === 1 ? 'เอ็ด' : o ? ones[o] : '') : o ? ones[o] : '');
  }
  function chunk(x) {
    return x >= 100 ? ones[Math.floor(x / 100)] + 'ร้อย' + two(x % 100) : two(x);
  }
  let txt = '';
  if (int >= 1000000) txt += chunk(Math.floor(int / 1000000)) + 'ล้าน';
  if (int >= 1000)    txt += chunk(Math.floor(int % 1000000 / 1000)) + 'พัน';
  txt += chunk(int % 1000) + 'บาท';
  txt += dec > 0 ? two(dec) + 'สตางค์' : 'ถ้วน';
  return txt;
}

/** CSS animation สำหรับ toast และ spinner */
const _style = document.createElement('style');
_style.textContent = `
  @keyframes toastIn { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
  @keyframes spin     { to { transform:rotate(360deg) } }
`;
document.head.appendChild(_style);
