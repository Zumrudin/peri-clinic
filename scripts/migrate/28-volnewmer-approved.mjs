import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const base=process.env.DIRECTUS_URL.replace(/\/$/,'');
let token=process.env.DIRECTUS_ADMIN_TOKEN||process.env.DIRECTUS_TOKEN;
if(process.env.ADMIN_EMAIL&&process.env.ADMIN_PASSWORD){const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});if(!r.ok)throw Error(`Login ${r.status}`);token=(await r.json()).data.access_token;}
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error(`${method} ${path} ${r.status}`);return (await r.json()).data;}
const layout=JSON.parse(await readFile(new URL('./volnewmer-approved-content.json',import.meta.url),'utf8'));
const rows=await api('/items/procedures?filter[slug][_eq]=volnewmer');if(rows.length!==1)throw Error('Expected one Volnewmer');
const before=rows[0];
const backup=resolve(process.env.VOLNEW_BACKUP_DIR||'scripts/migrate/out/volnewmer-approved-backups');
await mkdir(backup,{recursive:true});
await writeFile(resolve(backup,`${Date.now()}-before.json`),JSON.stringify(before,null,2));
if(!process.argv.includes('--apply')){console.log(JSON.stringify({id:before.id,title:before.title,version:layout.version,sections:layout.sections.length}));process.exit(0);}
const fields=await api('/fields/procedures');
if(!fields.some(f=>f.field==='approved_layout'))await api('/fields/procedures','POST',{field:'approved_layout',type:'json',meta:{interface:'input-code',options:{language:'json'},translations:[{language:'ru-RU',translation:'Согласованная страница'}]},schema:{is_nullable:true}});
for(const a of layout.assets){
 const name='volnewmer-approved-v19-'+a.filename;
 let file=(await api('/files?filter[filename_download][_eq]='+encodeURIComponent(name)))[0];
 if(!file){
  const bytes=await readFile(resolve(process.env.VOLNEW_ASSET_DIR||'artifacts/volnewmer-review-20261012-v19/site/assets',a.filename));
  const form=new FormData();form.append('title',name);form.append('file',new Blob([bytes],{type:'image/webp'}),name);
  const r=await fetch(base+'/files',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});if(!r.ok)throw Error(`Upload ${r.status}`);file=(await r.json()).data;
 }
 a.id=file.id;delete a.filename;
}
await api('/items/procedures/'+before.id,'PATCH',{approved_layout:layout});
const after=await api('/items/procedures/'+before.id);
if(JSON.stringify(after.approved_layout)!==JSON.stringify(layout))throw Error('Readback mismatch');
console.log(`Updated and verified Volnewmer ${before.id}: version ${layout.version}, ${layout.sections.length} sections`);
