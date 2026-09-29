/** Scoped, backed-up CMS migration. Default dry run; immutable consent edition. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const input = JSON.parse(await readFile(new URL('./cookie-analytics-2026-09-28.json', import.meta.url)));
const base = process.env.DIRECTUS_URL?.replace(/\/$/, '');
const token = process.env.DIRECTUS_TOKEN;
if (!base || !token) throw new Error('DIRECTUS_URL and DIRECTUS_TOKEN required');
async function request(path, method='GET', body) {
  const r = await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`);
  if (r.status===204) return;
  return (await r.json()).data;
}
const pages = await request('/items/pages?limit=-1');
const settings = await request('/items/site_settings');
const fields = await request('/fields/site_settings');
const policy = pages.find(p=>p.slug==='politika');
const previous = pages.find(p=>p.slug===input.page.slug);
if (!policy) throw new Error('Privacy page missing');
if (previous && (previous.body!==input.page.body || previous.title!==input.page.title)) throw new Error('Consent edition is immutable; create new revision');
const section = /<h2>7\. Cookie, аналитика и внешние сервисы<\/h2>[\s\S]*?(?=<h2>8\.)/;
if (!section.test(policy.body)) throw new Error('Expected cookie section missing');
const body = policy.body.replace(section,input.policySection);
console.log(JSON.stringify({createConsent:!previous,updatePolicy:body!==policy.body,createField:!fields.some(f=>f.field==='cookie_notice'),counterConfigured:!!settings.metrika_id}));
if (process.argv.includes('--apply')) {
  const dir=new URL('./out/cookie-analytics-backups/',import.meta.url);await mkdir(dir,{recursive:true});
  await writeFile(new URL(`${Date.now()}.json`,dir),JSON.stringify({policy,previous,settings},null,2));
  if (!fields.some(f=>f.field==='cookie_notice')) await request('/fields/site_settings','POST',{field:'cookie_notice',type:'json',meta:{interface:'input-code',options:{language:'json'},special:['cast-json'],translations:[{language:'ru-RU',translation:'Cookie: тексты уведомления'}]},schema:{is_nullable:true}});
  if (!previous) await request('/items/pages','POST',{...input.page,status:'published',seo_title:input.page.title+' — PERI CLINIC',seo_description:input.page.lead});
  if (body!==policy.body) await request('/items/pages/'+policy.id,'PATCH',{body});
  if (JSON.stringify(settings.cookie_notice)!==JSON.stringify(input.copy) || !settings.metrika_requires_consent) await request('/items/site_settings','PATCH',{cookie_notice:input.copy,metrika_requires_consent:true});
}
