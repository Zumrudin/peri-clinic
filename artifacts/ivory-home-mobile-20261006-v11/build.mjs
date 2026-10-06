import fs from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import { load } from 'cheerio';
const root = 'artifacts/ivory-home-mobile-20261006-v11';
const out = `${root}/site`;
await fs.cp('artifacts/ivory-home-20261006-v4/site', out, { recursive: true });
async function rewrite(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await rewrite(file);
    else if (/\.(html|css|js)$/.test(entry.name)) {
      await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replaceAll('/ivory-home-20261006-v4/', '/ivory-home-mobile-20261006-v11/'));
    }
  }
}
await rewrite(out);
const html = await fs.readFile(`${out}/index.html`, 'utf8');
// Restore the layout rules embedded in the original site's snapshot, preserving brand colours.
const $ = load(html);
$('.hero-location, .ticker, #services .services__hint').remove();
// Reuse the results navigation markup and scoped styles; video playback stays owned by the reels script.
const referenceNavigation = $('[data-results-navigation]').first();
$('[data-home-reels]').each((index, element) => {
  const root = $(element);
  const rail = root.find('[data-reels-rail]');
  const count = root.find('[data-reel]').length;
  if (count < 2) return;
  const railId = `clinic-reels-rail-${index}`;
  rail.attr('id', railId);
  const navigation = referenceNavigation.clone().addClass('reels-scroll-navigation');
  navigation.find('*').addBack().each((_, node) => {
    for (const [name, value] of Object.entries(node.attribs || {})) {
      if (name.startsWith('data-results-')) $(node).removeAttr(name).attr(name.replace('data-results-', 'data-reels-scroll-'), value);
    }
  });
  navigation.find('[data-reels-scroll-total]').text(String(count).padStart(2, '0'));
  navigation.find('button').attr('aria-controls', railId);
  navigation.find('[data-reels-scroll-prev]').attr('aria-label', 'Предыдущее видео');
  navigation.find('[data-reels-scroll-next]').attr('aria-label', 'Следующее видео');
  rail.after(navigation);
});
$('body').append('<script type="module" src="./reels-scroll.js"></script>');
await fs.copyFile(`${root}/reels-scroll.js`, `${out}/reels-scroll.js`);
const native = postcss.parse($('style').first().text());
const layout = /^(display|position|inset|top|right|bottom|left|z-index|overflow|box-sizing|width|height|min-|max-|aspect-ratio|padding|margin|gap|row-gap|column-gap|grid|flex|align|justify|place|order|border-radius|border-.*radius|font-size|line-height|letter-spacing|text-wrap|white-space|object-fit)/;
const components = /\.(home-section|section-heading|service|round-arrow|approach|gallery|portraits|person-|room-|photo-expand|equipment|machine-|slider-controls|results|result-card|review|stars|gift|booking|footer)/;
native.walkRules(rule => {
  if (!components.test(rule.selector)) { rule.remove(); return; }
  rule.walkDecls(decl => { if (!layout.test(decl.prop)) decl.remove(); else decl.important = true; });
  if (!rule.nodes.length) { rule.remove(); return; }
  rule.selector = rule.selectors.map(s => ':is(body, #mobile-native-layout) ' + s).join(',');
});
native.walkAtRules(rule => { if (!['media','supports'].includes(rule.name) || !rule.nodes?.length) rule.remove(); });
await fs.writeFile(`${out}/native-layout.css`, '@media(max-width:800px){' + native.toString() + '}');
await fs.writeFile(`${out}/index.html`, $.html().replace('</head>', '<link rel="stylesheet" href="./native-layout.css"><link rel="stylesheet" href="./mobile.css"></head>'));
await fs.copyFile(`${root}/mobile.css`, `${out}/mobile.css`);
