import fs from 'node:fs/promises';
import {load} from 'cheerio';
import {execFileSync} from 'node:child_process';
const root='docs/content/telegram-peri-clinic';
await fs.mkdir(`${root}/raw`,{recursive:true});
const offline=process.argv.includes('--offline');
const rawFiles=offline?(await fs.readdir(`${root}/raw`)).filter(x=>x.endsWith('.html')).sort():[];
const posts=new Map();const pages=[];let url='https://t.me/s/peri_clinic';const seen=new Set();
while(url&&!seen.has(url)){
 seen.add(url);const html=offline?await fs.readFile(`${root}/raw/${rawFiles[pages.length]}`,'utf8'):execFileSync('curl',['--fail','-L','--retry','3','--max-time','40','-sS',url],{maxBuffer:20*1024*1024}).toString();
 const $=load(html);const page=String(pages.length+1).padStart(3,'0');await fs.writeFile(`${root}/raw/page-${page}.html`,html);
 const ids=[];
 $('.tgme_widget_message').each((_,el)=>{const e=$(el),key=e.attr('data-post');if(!key)return; const id=Number(key.split('/').pop()); ids.push(id);const t=e.find('.tgme_widget_message_text').first().clone();t.find('br').replaceWith('\n'); const media=[];
 e.find('.tgme_widget_message_photo_wrap').each((_,x)=>{const style=$(x).attr('style')||'';const src=style.match(/url\(['"]?(.*?)['"]?\)/)?.[1];if(src)media.push({type:'photo',url:src});});
 e.find('.tgme_widget_message_video_thumb').each((_,x)=>{const src=($(x).attr('style')||'').match(/url\(['"]?(.*?)['"]?\)/)?.[1];if(src)media.push({type:'video_poster',url:src});});
 e.find('video').each((_,x)=>{const v=$(x);const src=v.attr('src')||v.find('source').attr('src');if(src)media.push({type:'video',url:src});const poster=v.attr('poster');if(poster)media.push({type:'video_poster',url:poster});});
 e.find('.tgme_widget_message_document_wrap').each((_,x)=>{const v=$(x);media.push({type:'document',url:v.attr('href'),name:v.text().trim()});});
 const unavailable=e.find('.message_media_not_supported,.tgme_widget_message_video_player_not_supported').text().trim();
 const album_message_ids=e.find('[data-post]').map((_,x)=>$(x).attr('data-post')).get();
 const value={id,album_message_ids,url:`https://t.me/${key}`,date:e.find('time[datetime]').attr('datetime')||null,text:t.text().trim(),media,unavailable,links:e.find('.tgme_widget_message_text a').map((_,a)=>$(a).attr('href')).get()};
 if(!posts.has(id)||value.text.length>posts.get(id).text.length)posts.set(id,value);
 });
 const prev=$('link[rel=prev]').attr('href')||$('a.tme_messages_more[data-before]').attr('href');
 pages.push({url,file:`raw/page-${page}.html`,ids,previous:prev||null});
 await fs.writeFile(`${root}/posts.json`,JSON.stringify([...posts.values()].sort((a,b)=>a.id-b.id),null,2));await fs.writeFile(`${root}/crawl.json`,JSON.stringify({collected_at:new Date().toISOString(),pages,complete:!prev},null,2));
 console.log(`page ${page}: ${ids[0]}–${ids.at(-1)}, total ${posts.size}`);
 url=prev?new URL(prev,'https://t.me').href:null;
}
