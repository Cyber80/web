import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root=new URL('../',import.meta.url);
export function createHarness() {
  const files=new Map(),properties=new Map(),stats={reads:0,writes:0,creates:0},cache=new Map();let locked=false;
  class Sheet {
    constructor(){this.rows=[];this.maxRows=1000;this.maxColumns=26;}
    getLastRow(){return this.rows.length;}
    getMaxRows(){return this.maxRows;}
    getMaxColumns(){return this.maxColumns;}
    insertRowsAfter(_,n){this.maxRows+=n;}
    insertColumnsAfter(_,n){this.maxColumns+=n;}
    getDataRange(){return {getValues:()=>{stats.reads++;return structuredClone(this.rows);}};}
    getRange(row,col,count,width){const self=this;return {
      setNumberFormat(){return this;},
      setValues(rows){stats.writes++;rows.forEach((r,i)=>{self.rows[row-1+i]??=[];r.forEach((v,j)=>{self.rows[row-1+i][col-1+j]=typeof v==='string'&&v.startsWith("'")?v.slice(1):v;});});return this;},
      clearContent(){for(let i=row-1;i<row-1+count;i++){if(self.rows[i])self.rows[i].fill('',col-1,col-1+width);}while(self.rows.length&&self.rows.at(-1).every(v=>v===''))self.rows.pop();}
    };}
  }
  class Spreadsheet {
    constructor(name){this.name=name;this.id=crypto.randomUUID();this.sheets=new Map();}
    getId(){return this.id;}
    getSheetByName(name){return this.sheets.get(name);}
    insertSheet(name){const sheet=new Sheet();this.sheets.set(name,sheet);return sheet;}
  }
  const services={
    console,Date,
    SpreadsheetApp:{create(name){stats.creates++;const ss=new Spreadsheet(name);files.set(ss.id,ss);return ss;},openById(id){if(!files.has(id))throw new Error('Spreadsheet unavailable');return files.get(id);},flush(){}},
    PropertiesService:{getScriptProperties(){return {getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)};}},
    CacheService:{getScriptCache(){return {get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)};}},
    LockService:{getScriptLock(){return {tryLock(){if(locked)return false;locked=true;return true;},releaseLock(){locked=false;}};}},
    Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(alg,s)=>[...crypto.createHash(alg).update(s).digest()],formatDate:d=>d.toISOString().slice(0,10),newBlob:s=>({getBytes:()=>Buffer.from(s)})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput(text){return {text,setMimeType(){return this;}};}}
  };
  const context=vm.createContext(services);
  for(const file of ['Code.gs','Analysis.gs'])vm.runInContext(fs.readFileSync(new URL(file,root),'utf8'),context,{filename:file});
  context.SETUP_SYSTEM_AND_AUTHORIZE();
  const call=(action,payload={},secret=properties.get('EQMS_SHARED_SECRET'))=>JSON.parse(context.doPost({postData:{contents:JSON.stringify({action,payload,secret})}}).text);
  return {call,context,files,properties,stats,cache,resetStats(){stats.reads=stats.writes=stats.creates=0;}};
}
export function seed(h,{count=40,year='2569'}={}) {
  h.call('years/add',{year});h.call('subjects/save',{year,subject:{code:'SCI',name:'วิทยาศาสตร์',grade_level:'ม.3',units:1}});
  const snap=h.call('exams/add',{year,exam:{Subject_Code:'SCI',Subject_Name:'วิทยาศาสตร์',Grade_Level:'ม.3',Exam_Title:'ทดสอบ '+count+' ข้อ',parts:[{name:'ปรนัย',qs:count,score:count}]}});
  if(snap.error)throw new Error(snap.error);
  return {year,exam_id:snap.exam_id};
}
