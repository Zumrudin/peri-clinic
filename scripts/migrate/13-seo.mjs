/** SEO content migration. Preview by default; --apply backs up every touched record. */
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
const text = s => (s || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const plan = [];
const add = (collection, item, values, singleton=false) => {
  const changes = Object.fromEntries(Object.entries(values).filter(([k,v])=>item[k] !== v));
  if (Object.keys(changes).length) plan.push({collection,id:singleton?undefined:item.id,slug:item.slug,changes,before:Object.fromEntries(Object.keys(changes).map(k=>[k,item[k]]))});
};
const [procedures,categories,pages,specialists,home] = await Promise.all(['procedures','service_categories','pages','specialists','home'].map(c=>api(`/items/${c}?limit=-1`)));
const shortTitles = {
 'pigment-lumec':'Фотоомоложение Lumecca', 'rf-lifting-inmode':'Микроигольчатый RF-лифтинг Morpheus8',
 'volnewmer':'RF-лифтинг Volnewmer','tesla-former':'Коррекция фигуры Tesla Former','pladuo':'Плазменная терапия Pladuo',
 'beautylizer':'RSL-массаж Beautylizer','laser-epilation':'Лазерная эпиляция Pacer One Pro','profeccial':'Аппаратный уход ProFacial',
 'heleo':'Фотодинамическая терапия HELEO4','microtoki':'Удаление новообразований Sensitec',
};
for(const p of procedures.filter(p=>p.status==='published')) add('procedures',p,{
 seo_title:`${shortTitles[p.slug] || text(p.title)} в Москве — PERI CLINIC`,
 // Use the existing reviewed medical summary, rather than invent efficacy claims.
 seo_description: `${text(p.seo_description || p.summary || p.lead).replace(/\s*PERI CLINIC, Москва\.$/,'')} PERI CLINIC, Москва.`,
});
for(const c of categories.filter(c=>c.status==='published')) add('service_categories',c,{
 seo_title:`${text(c.title)} в Москве — PERI CLINIC`,
 seo_description:`${text(c.title)} в PERI CLINIC, Москва. ${text(c.description)}`,
});
for(const p of pages.filter(p=>p.status==='published')) {
 if(p.template==='spravka') add('pages',p,{seo_title:'Справка для налогового вычета — PERI CLINIC',seo_description:'Заявка на справку об оплате медицинских услуг в PERI CLINIC для налогового вычета. Заполните данные пациента, налогоплательщика и выберите год оплаты.'});
 else if(!text(p.seo_description)) add('pages',p,{seo_description:text(p.lead || p.body).slice(0,170)});
}
for(const p of specialists.filter(p=>p.status==='published'&&!p.is_demo)) add('specialists',p,{
 seo_title:`${p.name} — PERI CLINIC, Москва`,
 ...( /Здесь будет описание|демонстрационная страница/i.test(p.body || '') ? {body: `<p>${p.name} — ${p.role.toLowerCase()} в PERI CLINIC, Москва.</p><p>Для записи на консультацию свяжитесь с клиникой по телефону или через мессенджер. Администратор поможет выбрать время посещения.</p>`} : {}),
 ...( /Условный портрет|дизайн-концепции/i.test(p.image_alt || '') ? {image_alt: `Портрет: ${p.name}`} : {}),
 seo_description:`${p.name} — ${p.role.toLowerCase()}. Специалист PERI CLINIC в Москве: информация, профессиональная практика и запись на консультацию.`,
});
add('home',home,{
 devices_catalog_seo_title:'Аппаратная косметология в Москве — аппараты PERI CLINIC',
 devices_catalog_seo_description:'Аппараты и процедуры PERI CLINIC в Москве: RF-лифтинг, фотоомоложение, лазерная эпиляция и аппаратный уход. Описание методик, цены и консультация.',
},true);
const dir = `scripts/migrate/out/seo-backups/${Date.now()}`;
await mkdir(dir,{recursive:true}); await writeFile(`${dir}/plan.json`,JSON.stringify(plan,null,2));
console.log(JSON.stringify(plan.map(({collection,slug,changes})=>({collection,slug,changes})),null,2));
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
