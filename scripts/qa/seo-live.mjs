/** Network checks on the published origin, not Astro's permissive preview server. */
import { load } from 'cheerio';
import { mkdirSync, writeFileSync } from 'node:fs';
const base=process.argv[2] || 'https://prod.peri-clinic.zumrudin.ru';
const results=[],errors=[],assets=new Set();
async function get(path,method='GET'){return fetch(new URL(path,base),{method,redirect:'manual',signal:AbortSignal.timeout(30000)});}
const sr=await get('/sitemap.xml');const xml=load(await sr.text(),{xmlMode:true});
const urls=xml('url > loc').map((i,e)=>xml(e).text()).get();
for(const url of urls){
 const r=await get(url), $=load(await r.text()), canonical=$('link[rel=canonical]').attr('href');
 const item={url,status:r.status,canonical,robots:r.headers.get('x-robots-tag')};results.push(item);
 if(r.status!==200||canonical!==url||!url.startsWith(base+'/')||/noindex|nofollow/i.test(item.robots||'')||/noindex/.test($('meta[name=robots]').attr('content')||''))errors.push(item);
 $('img[src], source[srcset], video[src], meta[property="og:image"]').each((i,e)=>{
 const raw=$(e).attr('src')||$(e).attr('content');if(raw){const u=new URL(raw,base);if(u.origin===base)assets.add(u.href);}
 const set=$(e).attr('srcset');if(set)for(const part of set.split(',')){const u=new URL(part.trim().split(/\s+/)[0],base);if(u.origin===base)assets.add(u.href);}
 });
}
const assetResults=[];for(const url of assets){const r=await get(url,'HEAD');assetResults.push({url,status:r.status});if(r.status!==200)errors.push({url,status:r.status});}
for(const [path,status,target] of [['/seo-missing-page-1789638',404],['/404',404],['/index.html',301,'/'],['/result.html',301,'/result'],['/result/',301,'/result'],['/specialisty/botashev.html',301,'/specialisty/botashev'],['/apparatnaya-kosmetologiya',301,'/apparaty']]){
 const r=await get(path);const item={path,status:r.status,location:r.headers.get('location')};results.push(item);if(r.status!==status||(target&&new URL(item.location,base).pathname!==target))errors.push(item);
}
const robots=await (await get('/robots.txt')).text();if(!robots.includes(`Sitemap: ${base}/sitemap.xml`)||/Disallow:\s*\/\s*$/m.test(robots))errors.push({robots});
mkdirSync('docs/seo/after',{recursive:true});writeFileSync('docs/seo/after/live.json',JSON.stringify({results,assets:assetResults,errors},null,2));
console.log(JSON.stringify({pages:urls.length,assets:assets.size,errors},null,2));process.exitCode=errors.length?1:0;
