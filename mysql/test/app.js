// Simple client-side POS for demo
const products = [
  {"id":1,"code":"P001","name":"น้ำดื่ม 600ml","price":10},
  {"id":2,"code":"P002","name":"ขนมขบเคี้ยว","price":15},
  {"id":3,"code":"P003","name":"ข้าวกล่อง","price":40},
  {"id":4,"code":"P004","name":"กาแฟเย็น","price":25},
  {"id":5,"code":"P005","name":"ซองเครื่องดื่ม","price":8}
];

let cart = {};

function formatThai(n){ return Number(n).toLocaleString('th-TH'); }

function renderProducts(){
  const el = document.getElementById('product-list');
  el.innerHTML = '';
  products.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h4>${p.name}</h4><div class="small">รหัส: ${p.code}</div><div class="price">${formatThai(p.price)} บาท</div><div style="margin-top:8px"><button class="btn btn-add" onclick="addToCart(${p.id})">เพิ่ม</button></div>`;
    el.appendChild(card);
  });
}

function addToCart(id){
  const p = products.find(x=>x.id===id);
  if(!p) return;
  if(!cart[id]) cart[id] = {...p, qty:0};
  cart[id].qty += 1;
  renderCart();
}

function changeQty(id, delta){
  if(!cart[id]) return;
  cart[id].qty += delta;
  if(cart[id].qty <= 0) delete cart[id];
  renderCart();
}

function renderCart(){
  const el = document.getElementById('cart-items');
  el.innerHTML = '';
  let total = 0;
  Object.values(cart).forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-row';
    row.innerHTML = `<div><strong>${item.name}</strong><div class="small">฿${formatThai(item.price)} x ${item.qty}</div></div><div style="text-align:right"><div class="qty"><button onclick="changeQty(${item.id},-1)">-</button><div style="padding:6px 8px">${item.qty}</div><button onclick="changeQty(${item.id},1)">+</button></div><div style="margin-top:6px"><button onclick="removeItem(${item.id})" style="background:#ef4444;color:white;padding:6px;border-radius:6px;border:0;cursor:pointer">ลบ</button></div></div>`;
    el.appendChild(row);
    total += item.price * item.qty;
  });
  const discount = Number(document.getElementById('discount').value) || 0;
  const net = Math.max(0, total - discount);
  document.getElementById('total').innerText = formatThai(net);
}

function removeItem(id){ delete cart[id]; renderCart(); }

document.getElementById('discount').addEventListener('input', renderCart);
document.getElementById('clear').addEventListener('click', ()=>{ if(confirm('ล้างตะกร้าจริงหรือ?')){ cart={}; renderCart(); }});

document.getElementById('checkout').addEventListener('click', ()=>{
  if(Object.keys(cart).length===0){ alert('ตะกร้าว่าง'); return; }
  const invoiceArea = document.getElementById('invoiceArea');
  let total = 0;
  const rows = Object.values(cart).map(it => {
    const line = `<tr><td>${it.code}</td><td>${it.name}</td><td>${it.qty}</td><td style="text-align:right">${formatThai(it.price)}</td><td style="text-align:right">${formatThai(it.price*it.qty)}</td></tr>`;
    total += it.price*it.qty;
    return line;
  }).join('');
  const discount = Number(document.getElementById('discount').value) || 0;
  const net = Math.max(0, total - discount);
  invoiceArea.innerHTML = `
    <div><strong>ร้านตัวอย่าง</strong></div>
    <div class="small">วันที่: ${new Date().toLocaleString('th-TH')}</div>
    <table class="invoice-table"><thead><tr><th>รหัส</th><th>สินค้า</th><th>จำนวน</th><th>ราคา/หน่วย</th><th>รวม</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="4" style="text-align:right">รวม</td><td style="text-align:right">${formatThai(total)}</td></tr><tr><td colspan="4" style="text-align:right">ส่วนลด</td><td style="text-align:right">${formatThai(discount)}</td></tr><tr><td colspan="4" style="text-align:right">ยอดสุทธิ</td><td style="text-align:right">${formatThai(net)}</td></tr></tfoot></table>
  `;
  document.getElementById('invoiceModal').classList.remove('hidden');
});

document.getElementById('closeInvoice').addEventListener('click', ()=>{
  document.getElementById('invoiceModal').classList.add('hidden');
});

document.getElementById('printInvoice').addEventListener('click', ()=>{
  const content = document.getElementById('invoiceArea').innerHTML;
  const w = window.open('','_blank');
  w.document.write(`<html><head><title>Invoice</title><meta charset="utf-8"></head><body>${content}</body></html>`);
  w.print();
  w.close();
});

document.getElementById('export').addEventListener('click', ()=>{
  if(Object.keys(cart).length===0){ alert('ตะกร้าว่าง'); return; }
  const rows = Object.values(cart).map(it => [it.code, it.name, it.qty, it.price, it.price*it.qty]);
  let csv = 'รหัส,ชื่อสินค้า,จำนวน,ราคา/หน่วย,รวม\\n';
  rows.forEach(r=> csv += r.join(',') + '\\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'invoice.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// init
renderProducts();
renderCart();
