import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
const root='artifacts/ivory-home-mobile-20261007-v16';
const previous='ivory-home-mobile-20261006-v14';
const version='ivory-home-mobile-20261007-v16';
const out=`${root}/site`;
await fs.cp(`artifacts/${previous}/site`,out,{recursive:true});
async function rewrite(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await rewrite(file);else if(/\.(html|css|js)$/.test(item.name))await fs.writeFile(file,(await fs.readFile(file,'utf8')).replaceAll(`/${previous}/`,`/${version}/`));}}
await rewrite(out);
const code=ts.transpileModule(await fs.readFile(`${root}/staff-carousel.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
await fs.writeFile(`${out}/staff-carousel.js`,code);
const gallery=`${out}/_astro/Lightbox.astro_astro_type_script_index_0_lang.BZRaFjRo.js`;
const source=await fs.readFile(gallery,'utf8');
if(!source.includes('./loop-carousel.DcS_Ht8k.js'))throw new Error('Gallery import changed');
await fs.writeFile(gallery,source.replace('./loop-carousel.DcS_Ht8k.js','../staff-carousel.js'));
console.log('Built',version);
