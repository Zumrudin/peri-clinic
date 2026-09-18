/** Ensure published CMS text actually reaches static HTML without JavaScript. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { load } from 'cheerio';
const base=process.env.DIRECTUS_URL, token=process.env.DIRECTUS_TOKEN;
const norm=value=>load(`<div>${value || ''}</div>`)('div').text().normalize('NFKC').replace(/[\s_]+/g,'').toLowerCase();
async function collection(name){const r=await fetch(`${base}/items/${name}?limit=-1`,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw Error(`${name}: ${r.status}`);return (await r.json()).data;}
const checks=[],errors=[];
function check(path,field,value){if(!value)return;const html=readFileSync(`dist/${path}.html`,'utf8');const $=load(html);$('script,style').remove();const present=norm($.html()).includes(norm(value));checks.push({path:'/'+path,field,present});if(!present)errors.push({path,field});}
for(const p of (await collection('procedures')).filter(p=>p.status==='published')){
 for(const k of ['title','body','indications','contraindications','duration','rehab','effect_duration','sessions'])check(p.slug,k,p[k]);
 check(p.slug,'lead/summary',p.lead||p.summary);
 for(const k of ['steps','benefits'])for(const [i,v] of (p[k]||[]).entries())for(const f of ['title','text'])check(p.slug,`${k}.${i}.${f}`,v[f]);
}
for(const p of (await collection('pages')).filter(p=>p.status==='published'))for(const k of ['lead','body'])check(p.slug,k,p[k]);
for(const p of (await collection('specialists')).filter(p=>p.status==='published'&&!p.is_demo))for(const k of ['name','role','body'])check('specialisty/'+p.slug,k,p[k]);
const procedures=await collection('procedures');
for(const f of (await collection('faq_items')).filter(f=>f.status==='published')) {
 const p=procedures.find(p=>p.id===f.procedure&&p.status==='published');
 const path=f.scope==='general'?'uslugi-i-ceny':p?.slug;
 if(path)for(const k of ['question','answer'])check(path,`faq.${f.id}.${k}`,f[k]);
}
for(const r of (await collection('reviews')).filter(r=>r.status==='published'))for(const k of ['author_name','text'])check('otzyvy',`review.${r.id}.${k}`,r[k]);
for(const c of (await collection('before_after_cases')).filter(c=>c.status==='published'&&!c.needs_review))for(const k of ['title','result'])check('result',`case.${c.id}.${k}`,c[k]);
for(const row of await collection('price_items'))if(procedures.some(p=>p.id===row.procedure&&p.status==='published'))check('uslugi-i-ceny',`price.${row.id}.name`,row.name);
mkdirSync('docs/seo/after',{recursive:true});writeFileSync('docs/seo/after/content.json',JSON.stringify({checks,errors},null,2));
console.log(JSON.stringify({checked:checks.length,errors},null,2));process.exitCode=errors.length?1:0;
