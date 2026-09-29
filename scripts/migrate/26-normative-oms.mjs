/** Refresh legal references and add the clinic-confirmed OMS status. Default: dry run. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const snapshot = JSON.parse(await readFile(new URL('./normative-oms-2026-09-28.json', import.meta.url)));
const base = process.env.DIRECTUS_URL?.replace(/\/$/, '');
const token = process.env.DIRECTUS_TOKEN;
if (!base || !token) throw new Error('DIRECTUS_URL and DIRECTUS_TOKEN required');
async function request(path, method='GET', body) {
  const r = await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`);
  return (await r.json()).data;
}
const records = await request('/items/pages?limit=-1');
const organization = records.find(p=>p.slug==='uridicheskaya-informaciya');
const normative = records.find(p=>p.slug===snapshot.normative.slug);
if (!organization || !normative) throw new Error('Expected existing legal pages missing');
const start='<!-- oms-information:start -->',end='<!-- oms-information:end -->';
const originalBody=(organization.body||'').replace(/\n?<!-- oms-information:start -->[\s\S]*?<!-- oms-information:end -->/g,'');
const {slug,...patch}=snapshot.normative;
const updates=[{previous:normative,patch},{previous:organization,patch:{body:originalBody+'\n'+start+'\n'+snapshot.organizationAppendix+'\n'+end}}]
  .filter(({previous,patch})=>Object.entries(patch).some(([key,value])=>previous[key]!==value));
for (const {previous} of updates) console.log(`UPDATE /${previous.slug}`);
if (!updates.length) console.log('Already current');
if (process.argv.includes('--apply') && updates.length) {
  const dir=new URL('./out/normative-oms-backups/',import.meta.url);await mkdir(dir,{recursive:true});
  await writeFile(new URL(`${Date.now()}.json`,dir),JSON.stringify(updates,null,2));
  for (const {previous,patch} of updates) await request(`/items/pages/${previous.id}`,'PATCH',patch);
}
