/** Apply the reviewed patient-facing content without changing prices, media or URLs.
 * node --env-file=.env.claude scripts/migrate/12-service-enrichment.mjs [--apply]
 * Backups and a per-write journal are kept outside Git for recovery.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const {services}=JSON.parse(await readFile(new URL('./service-enrichment.json',import.meta.url),'utf8'));
const base=process.env.DIRECTUS_URL?.replace(/\/$/,''),token=process.env.DIRECTUS_TOKEN;
if(!base||!token)throw Error('DIRECTUS_URL and DIRECTUS_TOKEN required');
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!r.ok)throw Error(`${method} ${path}: HTTP ${r.status}`);return (await r.json()).data;}
const [procedures,faqs]=await Promise.all([api('/items/procedures?limit=-1'),api('/items/faq_items?limit=-1')]);
const changed=(p,v)=>Object.fromEntries(Object.entries(v).filter(([k,x])=>JSON.stringify(p?.[k])!==JSON.stringify(x)));
const plan=services.map(s=>{const matches=procedures.filter(p=>p.slug===s.slug&&p.status==='published');if(matches.length!==1)throw Error('Expected one published '+s.slug);const p=matches[0];return {id:p.id,slug:p.slug,values:changed(p,s.procedure),faqs:s.faq.map((f,i)=>{const matches=faqs.filter(x=>x.procedure===p.id&&x.question===f.question);if(matches.length>1)throw Error('Duplicate FAQ '+f.question);const existing=matches[0];const fields={...f,procedure:p.id,scope:'procedure',status:'published',sort:existing?.sort??Math.max(0,...faqs.filter(x=>x.procedure===p.id).map(x=>x.sort||0))+i+1};return {id:existing?.id,values:changed(existing,fields)};})};});
const summary=plan.map(p=>({slug:p.slug,fields:Object.keys(p.values),faq_changes:p.faqs.filter(f=>Object.keys(f.values).length).length}));
await mkdir('output/service-enrichment',{recursive:true});await writeFile('output/service-enrichment/proposal.json',JSON.stringify({summary,plan},null,2));console.log(JSON.stringify(summary,null,2));
if(!process.argv.includes('--apply'))process.exit(0);
const dir=new URL(`./out/service-enrichment-backups/${Date.now()}/`,import.meta.url);await mkdir(dir,{recursive:true});await writeFile(new URL('before.json',dir),JSON.stringify({procedures,faqs},null,2));
const journal=[];const record=async entry=>{journal.push(entry);await writeFile(new URL('journal.json',dir),JSON.stringify(journal,null,2));};
for(const p of plan){if(Object.keys(p.values).length){const latest=await api(`/items/procedures/${p.id}`);const before=procedures.find(x=>x.id===p.id);if(Object.keys(p.values).some(k=>JSON.stringify(latest[k])!==JSON.stringify(before[k])))throw Error('Concurrent edit: '+p.slug);await api(`/items/procedures/${p.id}`,'PATCH',p.values);await record({collection:'procedures',id:p.id,slug:p.slug,action:'update',fields:Object.keys(p.values)});}
for(const f of p.faqs){if(!Object.keys(f.values).length)continue;const item=await api(`/items/faq_items${f.id?'/'+f.id:''}`,f.id?'PATCH':'POST',f.values);await record({collection:'faq_items',id:item.id,slug:p.slug,action:f.id?'update':'create'});}}
const [after,afterFaq]=await Promise.all([api('/items/procedures?limit=-1'),api('/items/faq_items?limit=-1')]);
for(const p of plan){const a=after.find(x=>x.id===p.id),before=procedures.find(x=>x.id===p.id);if(Object.keys(changed(a,p.values)).length)throw Error('Content verification failed '+p.slug);for(const key of ['slug','status','title','category','device','cover','gallery','cases','price_items','contraindications','benefits'])if(JSON.stringify(a[key])!==JSON.stringify(before[key]))throw Error('Unexpected change '+p.slug+' '+key);for(const f of services.find(x=>x.slug===p.slug).faq){const found=afterFaq.filter(x=>x.procedure===p.id&&x.question===f.question);if(found.length!==1||found[0].answer!==f.answer)throw Error('FAQ verification failed '+p.slug);}}
await writeFile(new URL('after.json',dir),JSON.stringify({procedures:after,faqs:afterFaq},null,2));
console.log(`Verified ${plan.length} procedures; ${journal.length} writes. Backup: ${dir.pathname}`);
