const encoder = new TextEncoder();
const actions = new Set(['health','meta','data','years/add','years/select','years/delete','subjects/save','subjects/delete','students/save','students/bulk_save','students/delete','exams/add','exams/delete','exams/select','exams/update_targets','exams/subject_overview','keys/update','responses/string-entry','responses/fast-entry','responses/delete','reconcile','export/json','export/csv']);
function json(data,status=200) {return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
async function key(secret) {return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
function encode(bytes) {return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function decode(s) {return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
async function token(secret) {const body=encode(encoder.encode(JSON.stringify({sub:'owner',exp:Math.floor(Date.now()/1000)+8*3600,nonce:crypto.randomUUID()})));return body+'.'+encode(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(body)));}
async function authenticated(request,secret) {
  try {const bearer=request.headers.get('Authorization')||'';if(!bearer.startsWith('Bearer '))return false;
    const parts=bearer.slice(7).split('.');if(parts.length!==2)return false;
    if(!await crypto.subtle.verify('HMAC',await key(secret),decode(parts[1]),encoder.encode(parts[0])))return false;
    const data=JSON.parse(new TextDecoder().decode(decode(parts[0])));return data.sub==='owner' && data.exp>Math.floor(Date.now()/1000);
  }catch{return false;}
}
async function boundedJSON(request,max) {
  if(Number(request.headers.get('Content-Length'))>max)throw new Error('PAYLOAD_TOO_LARGE');
  if(!request.body)throw new Error('INVALID_JSON');
  const reader=request.body.getReader();let size=0,chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new Error('PAYLOAD_TOO_LARGE');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new Error('INVALID_JSON');}
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url), prefix='/bkhn/modules/eqms', path=url.pathname.startsWith(prefix+'/')?url.pathname.slice(prefix.length):url.pathname;
    let origin=request.headers.get('Origin'),allowed=url.origin;
    if(env.FRONTEND_ORIGIN) {try{allowed=new URL(env.FRONTEND_ORIGIN).origin;}catch{return json({error:'ตั้งค่า FRONTEND_ORIGIN ไม่ถูกต้อง'},503);}}
    const cors=response=>{const headers=new Headers(response.headers);if(origin && (origin===allowed || origin===url.origin)){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');headers.set('Access-Control-Allow-Methods','POST, OPTIONS');}return new Response(response.body,{status:response.status,headers});};
    if(!path.startsWith('/api/')) {
      if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405);
      if(url.pathname===prefix) return Response.redirect(url.origin+prefix+'/',308);
      const assetURL=new URL(request.url);assetURL.pathname=path;
      const response=await env.ASSETS.fetch(new Request(assetURL,request));
      const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
      return new Response(response.body,{status:response.status,headers});
    }
    if(origin && origin!==allowed && origin!==url.origin)return json({error:'Origin not allowed'},403);
    if(request.method==='OPTIONS')return cors(new Response(null,{status:204}));
    if(request.method!=='POST')return cors(json({error:'Method not allowed'},405));
    const action=path.slice(5);
    if(!env.OWNER_PASSWORD || env.OWNER_PASSWORD.length<16 || !env.SESSION_SECRET || env.SESSION_SECRET.length<32)return cors(json({error:'กรุณาตั้งค่ารหัสผ่านและ session ของ EQMS Worker'},503));
    try {
      if(action==='session') {
        if(env.LOGIN_LIMITER) {const {success}=await env.LOGIN_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'});if(!success)return cors(json({error:'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่'},429));}
        const body=await boundedJSON(request,4096), signingKey=await key(env.SESSION_SECRET);
        const expected=await crypto.subtle.sign('HMAC',signingKey,encoder.encode(env.OWNER_PASSWORD));
        if(!await crypto.subtle.verify('HMAC',signingKey,expected,encoder.encode(String(body.password||''))))return cors(json({error:'รหัสผ่านไม่ถูกต้อง'},401));
        return cors(json({token:await token(env.SESSION_SECRET)}));
      }
      if(!await authenticated(request,env.SESSION_SECRET))return cors(json({error:'กรุณาเข้าสู่ระบบ'},401));
      if(!actions.has(action))return cors(json({error:'ไม่พบคำสั่ง'},404));
      if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(env.GAS_URL||'') || !env.EQMS_SHARED_SECRET)return cors(json({error:'กรุณาตั้งค่าการเชื่อมต่อ Apps Script'},503));
      const payload=await boundedJSON(request,2*1024*1024);
      if(!payload || Array.isArray(payload)||typeof payload!=='object')return cors(json({error:'ข้อมูลคำขอไม่ถูกต้อง'},400));
      const upstream=await fetch(env.GAS_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,payload,secret:env.EQMS_SHARED_SECRET}),redirect:'follow',signal:AbortSignal.timeout(55000)});
      if(!upstream.ok)return cors(json({error:'Apps Script ไม่พร้อมใช้งาน กรุณาตรวจ deployment'},502));
      let data;
      try {data=await boundedJSON(upstream,8*1024*1024);}
      catch {return cors(json({error:'Apps Script ตอบกลับไม่ถูกต้อง กรุณา deploy เวอร์ชันล่าสุดและใช้ URL ที่ลงท้ายด้วย /exec'},502));}
      return cors(json(data,data.error?400:200));
    } catch(error) {
      console.error(JSON.stringify({event:'eqms_request_failed',action,kind:error.name}));
      if(error.message==='PAYLOAD_TOO_LARGE')return cors(json({error:'ข้อมูลมีขนาดใหญ่เกินไป'},413));
      if(error.message==='INVALID_JSON')return cors(json({error:'ข้อมูลตอบกลับไม่ใช่ JSON กรุณาตรวจการเชื่อมต่อ'},502));
      return cors(json({error:'เชื่อมต่อไม่สำเร็จ กรุณาโหลดข้อมูลตรวจสอบก่อนบันทึกซ้ำ'},502));
    }
  }
};
