import fs from 'node:fs/promises';
const root='docs/content/telegram-peri-clinic';
const posts=JSON.parse(await fs.readFile(`${root}/posts.json`,'utf8'));
const services=JSON.parse(await fs.readFile(`${root}/site-services.json`,'utf8'));
let media=[];try{media=JSON.parse(await fs.readFile(`${root}/media.json`,'utf8'));}catch{}
const rules={
'pigment-lumec':'lume[cс]|люмек|лумек|фотоомолож|фототерап|гиперпигмент',
'mezoterapiya-i-biorevitalizaciya':'биоревитал|мезотерап|profhilo|профайло|novacutan|новакутан|revi|реви|repart|репарт|jalupro|яспро|профхило|полинуклеотид',
'kosemotologicheskie-pilingi':'пилинг|prx|bio\\s*re\\s*peel|биорепил|peach\\s*peel|персиков',
'rf-lifting-inmode':'morpheus|морфеус|морфе[йя]|микроигольчат|игольчатый',
'uhodovye-procedury':'уходов|программ[аы] ухода|сила лотоса|огонь и л[её]д|жидкий лазер|gigi|джи.?джи|косметическ.*уход',
'konturnaya-plastika':'контурн|филлер|губ[ыа]|губам|увеличени.*губ|коррекци.*губ|гиалуронидаз|лонгидаз|radiesse|радиесс|скул|носослез',
'maski':'маск[аиу](?![а-я])|карбокси',
'botullinoterapiya':'ботулин|ботокс|ботулакс|диспорт|релатокс|ксеомин|гипергидроз|бруксизм',
'volnewmer':'volnew|вольню|волюм|вол[нью]+мер|монополярн',
'plazmoterapiya-plazmolifting':'плазмотерап|плазмолифт|prp|собственн.*плазм|плазм.*кров',
 'tesla-former':'tesla|тесла|магнитн.*стимуля|fms',
'kosmetologicheskie-chistki':'чистк|комедон',
'lipolitiki':'липолит|липолиз',
'pladuo':'pladuo|пладуо|плазменн|холодн.*плазм',
'droppers':'капельниц|iv.терап|инфуз|внутривен',
'beautylizer':'beautylizer|бьютилайзер|бьютила[йи]зер|rsl|рсл|скульптурир|эндосфер',
'laser-epilation':'эпиляц|pacer|пейсер|пейcер',
'profeccial':'profacial|profac|профа[сшц]|аквапилинг|гидропилинг',
'heleo':'heleo|хелео|хелио|фотодинамич',
'mikrotokovaya-terapiya':'микроток',
'microtoki':'sensitec|сенситек|новообразован|папиллом|бородав|родинк|кератом'
};
const result=services.map(s=>{const re=new RegExp(rules[s.slug],'iu');const found=posts.map(p=>{const ocr=media.filter(m=>m.post_id===p.id&&m.ocr_text).map(m=>({file:m.file,text:m.ocr_text}));const textMatch=re.test(p.text);const ocrMatch=ocr.some(x=>re.test(x.text));return {post:p,ocr,textMatch,ocrMatch};}).filter(x=>x.textMatch||x.ocrMatch);return {slug:s.slug,title:s.title,posts:found.map(({post:p,textMatch,ocrMatch})=>({id:p.id,url:p.url,date:p.date,text_match:textMatch,ocr_match:ocrMatch})),found};});
await fs.mkdir(`${root}/sources`,{recursive:true});
for(const r of result){let md=`# Источники: ${r.title}\n\nКандидаты по тексту и машинному распознаванию карточек. Общие подборки и упоминания смежных услуг не подтверждают автоматически все свойства этой процедуры.\n\n`;for(const {post:p,ocr,textMatch,ocrMatch}of r.found){md+=`## [Пост ${p.id}](${p.url}) — ${p.date.slice(0,10)}\n\n${p.text||'Без текстовой подписи.'}\n\n`;if(ocr.length)md+=ocr.map(x=>`**OCR, невычитанный:** [изображение](../../../../${x.file})\n\n${x.text}`).join('\n\n');if(p.unavailable)md+='\nВеб-версия помечает часть медиа как неподдерживаемые; см. media.json для результата загрузки.\n';}await fs.writeFile(`${root}/sources/${r.slug}.md`,md);}
await fs.writeFile(`${root}/service-index.json`,JSON.stringify(result.map(({found,...r})=>r),null,2));
await fs.writeFile(`${root}/all-posts.md`,'# Архив @peri_clinic\n\n'+posts.map(p=>`## [${p.id}](${p.url}) — ${p.date.slice(0,10)}\n\n${p.text||'Без текстовой подписи.'}\n`).join('\n'));
console.log(result.map(r=>`${r.slug}: ${r.posts.length}`).join('\n'));
