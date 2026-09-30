/**
 * Local SEO: metro / district / okrug in the CMS-owned meta titles and descriptions, so nothing
 * has to be added to the visible page copy. Rewrites only the «в Москве» / «PERI CLINIC, Москва.»
 * phrases that 13-seo.mjs wrote; a record an editor has since reworded is left alone.
 * Preview by default; --apply backs up every touched record.
 */
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.DIRECTUS_URL?.replace(/\/$/, '');
let token = process.env.DIRECTUS_ADMIN_TOKEN || process.env.DIRECTUS_TOKEN;
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const r = await fetch(`${base}/auth/login`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});
  if (!r.ok) throw Error(`Login: ${r.status}`);
  token = (await r.json()).data.access_token;
}
if (!base || !token) throw Error('CMS credentials required');
async function api(path, method='GET', body) {
  const r = await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if (!r.ok) throw Error(`${method} ${path}: ${r.status}`);
  return (await r.json()).data;
}
const plan = [];
const add = (collection, item, values, singleton=false) => {
  const changes = Object.fromEntries(Object.entries(values).filter(([k,v])=>typeof item[k]==='string' && item[k] !== v));
  if (Object.keys(changes).length) plan.push({collection,id:singleton?undefined:item.id,slug:item.slug,changes,before:Object.fromEntries(Object.keys(changes).map(k=>[k,item[k]]))});
};
const [procedures,categories,home,settings] = await Promise.all([
  ...['procedures','service_categories'].map(c=>api(`/items/${c}?limit=-1`)), api('/items/home'), api('/items/site_settings'),
]);
const metro = settings.nearest_metro;
if (!metro) throw Error('site_settings.nearest_metro is empty');
// Same facts as src/config/location.ts; this one-off script runs on Node 20 and cannot import TypeScript.
const district = 'Орехово-Борисово Южное', okrug = 'ЮАО';
const nearMetro = `метро ${metro}`;
const title = s => s?.replace(/ в Москве — /, ` ${nearMetro} — `);
for(const p of procedures.filter(p=>p.status==='published')) add('procedures',p,{
 seo_title: title(p.seo_title),
 seo_description: p.seo_description?.replace(/PERI CLINIC, Москва\.$/, `PERI CLINIC — Москва, метро ${metro}, ${okrug} (${district}).`),
});
for(const c of categories.filter(c=>c.status==='published')) add('service_categories',c,{
 seo_title: title(c.seo_title),
 seo_description: c.seo_description?.replace(/в PERI CLINIC, Москва\. /, `в PERI CLINIC — Москва, ${nearMetro}, ${okrug} (${district}). `),
});
add('home',home,{
 seo_description: home.seo_description?.replace(/клиника эстетической медицины в Москве\. /, `клиника эстетической медицины в Москве, ${nearMetro} (${okrug}, ${district}). `),
 devices_catalog_seo_title: title(home.devices_catalog_seo_title),
 devices_catalog_seo_description: home.devices_catalog_seo_description?.replace(/PERI CLINIC в Москве: /, `PERI CLINIC в Москве, ${nearMetro}: `),
},true);
const dir = `scripts/migrate/out/local-seo-backups/${Date.now()}`;
await mkdir(dir,{recursive:true}); await writeFile(`${dir}/plan.json`,JSON.stringify(plan,null,2));
console.log(JSON.stringify(plan.map(({collection,slug,changes})=>({collection,slug,changes})),null,2));
console.log(`${plan.length} records to update`);
if(process.argv.includes('--apply')) {
 const journal=[];
 for(const p of plan) {
  const path=`/items/${p.collection}${p.id===undefined?'':'/'+p.id}`;
  const current=await api(path);
  if(Object.keys(p.changes).some(k=>JSON.stringify(current[k])!==JSON.stringify(p.before[k]))) throw Error(`Concurrent edit: ${path}`);
  await api(path,'PATCH',p.changes);
  const after=await api(path);
  if(Object.keys(p.changes).some(k=>after[k]!==p.changes[k])) throw Error(`Verification failed: ${path}`);
  journal.push({collection:p.collection,id:p.id});await writeFile(`${dir}/journal.json`,JSON.stringify(journal,null,2));
 }
 console.log(`Verified ${journal.length} updates. Backup: ${dir}`);
}
