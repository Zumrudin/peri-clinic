import fs from 'node:fs/promises';
import path from 'node:path';
const root='artifacts/ivory-home-desktop-20261007-v6';
const previous='ivory-home-20261006-v4';
const version='ivory-home-desktop-20261007-v6';
await fs.cp(`artifacts/${previous}/site`,`${root}/site`,{recursive:true});
async function rewrite(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await rewrite(file);else if(/\.(html|css|js)$/.test(item.name))await fs.writeFile(file,(await fs.readFile(file,'utf8')).replaceAll(`/${previous}/`,`/${version}/`));}}
await rewrite(`${root}/site`);
const file=`${root}/site/index.html`;
await fs.writeFile(file,(await fs.readFile(file,'utf8')).replace('</head>','<link rel="stylesheet" href="./cards.css"></head>'));
await fs.copyFile(`${root}/cards.css`,`${root}/site/cards.css`);
