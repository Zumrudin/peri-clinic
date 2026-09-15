import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),root='docs/content/telegram-peri-clinic',mediaRoot='output/telegram-peri-clinic/media';
await fs.mkdir(mediaRoot,{recursive:true});
const posts=JSON.parse(await fs.readFile(`${root}/posts.json`,'utf8'));
const jobs=posts.flatMap(p=>p.media.map((m,i)=>({...m,post_id:p.id,post_url:p.url,index:i+1})).filter((m,i,all)=>all.findIndex(x=>x.type===m.type&&x.url===m.url)===i)).sort((a,b)=>(a.type==='video')-(b.type==='video'));
let done=0;const results=[];
async function run(){while(jobs.length){const m=jobs.shift();const ext=m.type==='video'?'mp4':m.type==='document'?'bin':'jpg';const name=`${m.post_id}-${m.index}-${m.type}`;const file=`${mediaRoot}/${name}.${ext}`;const record={...m,file};
 try{try{await fs.access(file);}catch{await exec('curl',['--fail','-L','--retry','2','--max-time',m.type==='video'?'120':'30','-sS',m.url,'-o',file],{maxBuffer:1024*1024});}record.bytes=(await fs.stat(file)).size;record.status='downloaded';
 if(m.type==='photo'||m.type==='video_poster'){const txt=`${mediaRoot}/${name}.txt`;try{await fs.access(txt);}catch{await exec('tesseract',[file,`${mediaRoot}/${name}`,'-l','rus+eng','--psm','11'],{env:{...process.env,OMP_THREAD_LIMIT:'1'},maxBuffer:1024*1024});}record.ocr_text=await fs.readFile(txt,'utf8');record.ocr_status='automatic_unreviewed';}
 }catch(e){record.status='failed';record.error=String(e.message).slice(0,200);}
 results.push(record);done++;if(done%25===0){console.log(`${done} media, ${jobs.length} queued`);await save();}
 }}
async function save(){await fs.writeFile(`${root}/media.json`,JSON.stringify(results.sort((a,b)=>a.post_id-b.post_id||a.index-b.index),null,2));}
await Promise.all(Array.from({length:8},run));await save();console.log(`Complete ${done}; failed ${results.filter(x=>x.status==='failed').length}`);
