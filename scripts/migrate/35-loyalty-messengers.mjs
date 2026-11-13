/** Run on Selectel as root. Back up the CMS record before updating only its body. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const query = (sql) => execFileSync('runuser', ['-u', 'postgres', '--', 'psql', '-d', 'peri', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const p = JSON.parse(query("SELECT row_to_json(p) FROM pages p WHERE slug='loyaltyprogram'"));
if (p.body.includes('id="loyalty-messengers"')) throw new Error('Already migrated');
const backup = `/srv/peri/recovery/loyalty-${Date.now()}`;
mkdirSync(backup, { recursive: true, mode: 0o700 });
writeFileSync(`${backup}/page.json`, JSON.stringify(p, null, 2));
const telegram = [...p.body.matchAll(/href="(https:\/\/t\.me\/[^\"]+)"/g)].map(m => m[1]);
if (telegram.length !== 2 || new Set(telegram).size !== 1) throw new Error('Unexpected Telegram links');
const tgIcon = '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M21.5 3.5 2.9 10.7c-1 .4-1 1 0 1.3l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.5 0 .7-.2 1-.5l2.5-2.4 4.8 3.6c.9.5 1.5.2 1.7-.8l3.2-15c.3-1.3-.5-1.9-1.5-1.3ZM8.5 13.2l9.4-5.9c.5-.3.9-.1.5.2l-7.7 7-.3 3.3-1.9-4.6Z"/></svg>';
const maxIcon = '<svg viewBox="0 0 48 48" width="42" height="42" aria-hidden="true"><defs><linearGradient id="loyalty-max-gradient" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#00baff"/><stop offset=".5" stop-color="#5260ff"/><stop offset="1" stop-color="#9900ff"/></linearGradient></defs><path fill="url(#loyalty-max-gradient)" fill-rule="evenodd" d="M24 2C11.8 2 2 11.7 2 24c0 6.1 1.2 12.3 3.5 18.2.7 1.9 2.8 2.8 4.6 1.9l5.1-2.5A22 22 0 1 0 24 2Zm0 10a12 12 0 1 1-5.8 22.5l-5 1.4 1.3-5.1A12 12 0 0 1 24 12Z"/></svg>';
const option = (name, kind, url, icon) => `<a class="loyalty-messenger" href="${url}" target="_blank" rel="noopener noreferrer" data-goal="loyalty_${kind}"><span class="loyalty-messenger__label"><span class="loyalty-messenger__icon loyalty-messenger__icon--${kind}">${icon}</span><strong>${name}</strong><span class="loyalty-messenger__arrow" aria-hidden="true">↗</span></span><img class="loyalty-messenger__qr" src="/images/loyalty/${kind}-qr.png" width="200" height="200" alt="QR-код для регистрации через ${name}"></a>`;
let body = p.body.replace(/<a class="button" href="https:\/\/t\.me\/[^\"]+"[^>]*>(.*?)<\/a>/g, (_, label) => `<button class="button" type="button" data-open-loyalty aria-haspopup="dialog" aria-controls="loyalty-messengers">${label.replace(' в Telegram', '').replace('↗', '→')}</button>`)
.replace('Регистрация в Telegram-боте PERI CLINIC.', 'Регистрация через Telegram или МАКС.')
.replace('Перейдите в Telegram-бот программы лояльности.', 'Выберите Telegram или МАКС и зарегистрируйтесь в боте программы лояльности.');
body += `<dialog id="loyalty-messengers" class="loyalty-dialog" aria-labelledby="loyalty-dialog-title" aria-describedby="loyalty-dialog-description"><div class="loyalty-dialog__panel"><button type="button" class="loyalty-dialog__close" data-close-loyalty aria-label="Закрыть окно">×</button><p class="loyalty-eyebrow">Программа лояльности</p><h2 id="loyalty-dialog-title">Выберите мессенджер</h2><p id="loyalty-dialog-description">Зарегистрируйтесь в боте PERI CLINIC удобным для вас способом.</p><div class="loyalty-dialog__options">${option('Telegram', 'telegram', telegram[0], tgIcon)}${option('МАКС', 'max', 'https://max.ru/id695205769103_bot', maxIcon)}</div><p class="loyalty-dialog__qr-note">Нажмите на мессенджер или отсканируйте QR-код камерой телефона.</p></div></dialog>`;
const encoded = Buffer.from(body).toString('base64');
query(`UPDATE pages SET body=convert_from(decode('${encoded}','base64'),'UTF8') WHERE slug='loyaltyprogram'`);
console.log(`Updated loyaltyprogram. Backup: ${backup}. Telegram: ${telegram[0]}`);
