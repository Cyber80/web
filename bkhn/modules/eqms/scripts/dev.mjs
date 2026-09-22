// Local-only sandbox. Uses the real GAS functions against in-memory sheet services.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHarness,seed} from '../tests/gas-harness.mjs';
const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url))), h=createHarness();
const context=seed(h);
h.call('students/bulk_save',{...context,students:Array.from({length:32},(_,i)=>({Student_ID:String(i+1).padStart(3,'0'),First_Name:'นักเรียนทดสอบ',Last_Name:String(i+1),Grade_Level:'ม.3',Room:'1',No:i+1,Category:i<3?'LD':'ปกติ',LD_Types:i<3?['ด้านการอ่าน']:[]}))});
h.call('exams/update_targets',{...context,action:'add_room',payload_value:'1'});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.ttf':'font/ttf'};
const server=http.createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://127.0.0.1'), route=url.pathname.replace(/^\/bkhn\/modules\/eqms(?=\/)/,'');
  if(route.startsWith('/api/')) {
    if(req.method!=='POST'){res.writeHead(405);res.end();return;}
    let body='';for await(const chunk of req){body+=chunk;if(body.length>2*1024*1024){res.writeHead(413);res.end();return;}}
    const payload=JSON.parse(body||'{}');const action=route.slice(5);
    const result=action==='session'?{token:'sandbox'}:h.call(action,payload);
    res.writeHead(result.error?400:200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(result));return;
  }
  const name=route==='/'?'/index.html':decodeURIComponent(route);
  const file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return;}
  const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);
 }catch(error){res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('EQMS sandbox: http://127.0.0.1:'+(process.env.PORT||4173)+'/bkhn/modules/eqms/ (synthetic data; no Google writes)'));
