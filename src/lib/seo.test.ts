import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalPath } from './seo.ts';

test('canonicalPath(): file-format build paths become the clean URLs nginx serves', () => {
  assert.equal(canonicalPath('/index.html'), '/');
  assert.equal(canonicalPath('/'), '/');
  assert.equal(canonicalPath('/result.html'), '/result');
  assert.equal(canonicalPath('/result'), '/result');
  assert.equal(canonicalPath('/result/'), '/result');
  assert.equal(canonicalPath('/uslugi-i-ceny.html'), '/uslugi-i-ceny');
  assert.equal(canonicalPath('/404.html'), '/404');
  assert.equal(canonicalPath('kontakty.html'), '/kontakty');
});
