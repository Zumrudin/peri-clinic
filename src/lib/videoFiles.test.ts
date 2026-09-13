import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheVideo, videoFileName } from './videoFiles.ts';
const file = { id:'12345678-1234-1234-1234-123456789abc', type:'video/mp4', filesize:4, uploaded_on:'2026-09-13T10:00:00Z' };

test('video names reject unsupported files and change on replacement', () => {
  assert.match(videoFileName(file), /^[a-f0-9-]+\.mp4$/);
  assert.notEqual(videoFileName(file), videoFileName({...file,modified_on:'2026-09-13T11:00:00Z'}));
  for (const invalid of [{...file,id:'../secret'}, {...file,type:'video/quicktime'}, {...file,filesize:51*1024*1024}, {...file,uploaded_on:''}]) assert.throws(() => videoFileName(invalid));
});

test('authenticated downloads are cached; truncated bodies are not published', async () => {
  const dir = await mkdtemp(join(tmpdir(),'peri-video-'));
  let requests=0;
  const server=createServer((req,res)=>{ requests++; assert.equal(req.headers.authorization,'Bearer test-token'); assert.equal(req.url,`/assets/${file.id}`); res.setHeader('Content-Type','video/mp4'); res.end('test'); });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const options={baseUrl:`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`,token:'test-token',cacheDir:dir};
  try {
    const path=await cacheVideo(file,options);
    assert.equal(await readFile(path,'utf8'),'test');
    assert.equal(await cacheVideo(file,options),path);
    assert.equal(requests,1);
    await assert.rejects(cacheVideo({...file,filesize:5},options),/Неполная/);
    assert.equal(requests,2);
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); await rm(dir,{recursive:true,force:true}); }
});
