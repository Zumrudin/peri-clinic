import {readFileSync,writeFileSync} from 'node:fs';
// This test only writes to the disposable CMS on port 8057.
process.loadEnvFile(process.argv[2] || '/tmp/peri-media-cms/.env');
process.env.DIRECTUS_ADMIN_TOKEN = '';
process.env.DIRECTUS_URL='http://127.0.0.1:8057';
process.env.DIRECTUS_ADMIN_EMAIL=process.env.ADMIN_EMAIL;
process.env.DIRECTUS_ADMIN_PASSWORD=process.env.ADMIN_PASSWORD;
const {get,post,login}=await import('../../directus/setup/lib.mjs');
if(!(await get('/collections/group_content',{ok404:true}))) await post('/collections',{collection:'group_content',meta:{icon:'folder'},schema:null});
for (const name of ['Редактор: контент', 'Builder: сборка сайта']) {
  if (!(await get(`/policies?filter[name][_eq]=${encodeURIComponent(name)}`)).length) await post('/policies', { name });
}
if (!(await get(`/flows?filter[name][_eq]=${encodeURIComponent('Автопубликация')}`)).length) await post('/flows', {
  name: 'Автопубликация', status: 'inactive', trigger: 'event', options: { type: 'action', scope: ['items.update'], collections: ['specialists'] },
});
await import('../../directus/setup/about-schema.mjs');
await import('../../directus/setup/specialist-media-schema.mjs');
await import('../../directus/setup/specialist-media-schema.mjs?repeat');
const flows = await get('/flows?limit=-1');
if (!flows.some(f => f.name === 'Автопубликация' && f.status === 'inactive' && f.options.collections.includes('specialist_media'))) throw new Error('Flow coverage or status changed incorrectly');
for (const policy of await get('/policies?limit=-1')) {
  if (!['Редактор: контент', 'Builder: сборка сайта'].includes(policy.name)) continue;
  const permissions = await get(`/permissions?filter[policy][_eq]=${policy.id}&filter[collection][_eq]=specialist_media`);
  const expected = policy.name.startsWith('Builder') ? ['read'] : ['create', 'delete', 'read', 'update'];
  if (JSON.stringify(permissions.map(p => p.action).sort()) !== JSON.stringify(expected)) throw new Error('Incorrect media permissions');
}
const form=new FormData();form.append('file',new Blob([readFileSync(new URL('../../src/assets/about/cabinet.webp', import.meta.url))],{type:'image/webp'}),'cabinet.webp');
const response=await fetch('http://127.0.0.1:8057/files',{method:'POST',headers:{Authorization:`Bearer ${await login()}`},body:form});
if(!response.ok)throw new Error('Upload failed '+response.status);
const file=(await response.json()).data;
const person=await post('/items/specialists',{name:'Тестовый специалист',slug:'test-media-'+Date.now(),role:'Врач',image:file.id,status:'published'});
await post('/items/specialist_media',{specialist:person.id,title:'Своё фото',image:file.id,sort:1});
await post('/items/specialist_media',{specialist:person.id,title:'Видео',telegram_url:'https://t.me/peri_clinic/2055',sort:2});
const item=await get(`/items/specialists/${person.id}?fields=*,image.id,image.width,image.height,media_items.*,media_items.image.id,media_items.image.width,media_items.image.height`);
if(item.media_items.length!==2 || !item.media_items[0].image.width)throw new Error('Expanded media failed');
writeFileSync('/tmp/peri-specialist-media-fixture.json',JSON.stringify(item));
for (const telegram_url of ['https://t.me/+invite', 'https://t.me/c/123456/123', 'https://evil.test/clinic/123']) {
  let rejected = false;
  try { await post('/items/specialist_media', { specialist: person.id, title: 'Bad URL', telegram_url }); }
  catch (error) { rejected = error.message.includes('400'); }
  if (!rejected) throw new Error('Invalid Telegram URL accepted');
}
console.log('PASS: migration twice, upload, relation expansion, photo and Telegram persisted, invalid links rejected');
