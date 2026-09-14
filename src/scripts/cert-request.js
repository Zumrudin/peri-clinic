// Native site form; API and PDF generation remain in LoyalPro.
// Exported (not an IIFE) so it can re-run on astro:page-load; bails out when the form is absent.
export function initCertRequest() {
  const base = '/api/public/cert-requests/clinic-1';
  const $ = (id) => document.getElementById(id);
  if (!$('cr-form')) return;
  let ready = false;
  let sending = false;
  let applicationToken = '';

  async function api(url, options = {}) {
    return fetch(url, { ...options, cache: 'no-store', credentials: 'omit',
      signal: AbortSignal.timeout(30000) });
  }

  const TEXT_FIELDS = [
    'payer_last', 'payer_first', 'payer_middle', 'payer_birthdate', 'payer_inn',
    'payer_doc_serie_number', 'payer_doc_issue_date', 'payer_phone', 'payer_email',
    'patient_last', 'patient_first', 'patient_middle', 'patient_birthdate', 'patient_inn',
    'patient_doc_type_code', 'patient_doc_serie_number', 'patient_doc_date', 'patient_phone',
  ];

  // Коды ошибок валидации (клиент и сервер) → понятные пользователю сообщения.
  const FIELD_MESSAGES = {
    report_year: 'Выберите отчётный год.',
    consent: 'Поставьте отметку о согласии на обработку персональных данных.',
    payer_name: 'Укажите фамилию, имя и отчество получателя справки.',
    payer_birthdate: 'Укажите дату рождения получателя.',
    payer_adult: 'Получателем справки (плательщиком) может быть только совершеннолетний — 18 лет и старше.',
    payer_inn: 'Укажите корректный ИНН получателя — 10 или 12 цифр.',
    payer_doc: 'Серия и номер паспорта получателя — ровно 10 цифр (4 серии + 6 номера).',
    payer_doc_issue_date: 'Укажите дату выдачи паспорта получателя.',
    payer_phone: 'Укажите корректный телефон получателя в формате +7XXXXXXXXXX.',
    patient_name: 'Укажите фамилию, имя и отчество пациента.',
    patient_birthdate: 'Укажите дату рождения пациента.',
    patient_inn: 'Укажите корректный ИНН пациента — 10 или 12 цифр.',
    patient_doc_type: 'Выберите вид документа пациента — паспорт или свидетельство о рождении.',
    patient_doc: 'Проверьте серию и номер документа пациента (паспорт — ровно 10 цифр).',
    patient_doc_date: 'Укажите дату выдачи документа пациента.',
    patient_phone: 'Укажите телефон пациента в формате +7XXXXXXXXXX — по нему мы найдём оплаты в базе.',
    relationship: 'Выберите степень родства с пациентом.',
  };

  const digits = (s) => (s || '').replace(/\D/g, '');

  // Телефон → «+7XXXXXXXXXX» или null (зеркалит серверный toRuPhone).
  function toRuPhone(raw) {
    let d = digits(raw);
    if (d.length === 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1);
    if (d.length !== 10) return null;
    return '+7' + d;
  }

  // Совершеннолетие на сегодня по дате рождения 'YYYY-MM-DD'.
  function isAdult(bd) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bd || '')) return false;
    const [y, m, d] = bd.split('-').map(Number);
    const now = new Date();
    let age = now.getFullYear() - y;
    const mm = now.getMonth() + 1;
    if (mm < m || (mm === m && now.getDate() < d)) age -= 1;
    return age >= 18;
  }

  const innOk = (s) => digits(s).length === 10 || digits(s).length === 12;

  // Клиентская валидация: те же коды полей, что и на сервере.
  function validate(body, same) {
    const e = [];
    if (!body.report_year) e.push('report_year');
    if (!body.consent) e.push('consent');
    if (!body.payer_last || !body.payer_first || !body.payer_middle) e.push('payer_name');
    if (!body.payer_birthdate) e.push('payer_birthdate');
    else if (!isAdult(body.payer_birthdate)) e.push('payer_adult');
    if (!innOk(body.payer_inn)) e.push('payer_inn');
    if (digits(body.payer_doc_serie_number).length !== 10) e.push('payer_doc');
    if (!body.payer_doc_issue_date) e.push('payer_doc_issue_date');
    if (!toRuPhone(body.payer_phone)) e.push('payer_phone');
    if (!same) {
      if (!body.patient_last || !body.patient_first || !body.patient_middle) e.push('patient_name');
      if (!body.patient_birthdate) e.push('patient_birthdate');
      if (!innOk(body.patient_inn)) e.push('patient_inn');
      const dt = body.patient_doc_type_code;
      if (dt !== '21' && dt !== '03') e.push('patient_doc_type');
      if (dt === '21') { if (digits(body.patient_doc_serie_number).length !== 10) e.push('patient_doc'); }
      else if (!body.patient_doc_serie_number) e.push('patient_doc');
      if (!body.patient_doc_date) e.push('patient_doc_date');
      if (!toRuPhone(body.patient_phone)) e.push('patient_phone');
      if (!body.relationship) e.push('relationship');
    }
    return e;
  }

  function showErrors(fields) {
    const error = $('cr-error');
    error.replaceChildren();
    error.textContent = 'Проверьте, пожалуйста, правильность заполнения полей.';
    const list = document.createElement('ul');
    for (const field of Array.isArray(fields) ? fields : []) {
      const item = document.createElement('li');
      item.textContent = FIELD_MESSAGES[field] || 'Проверьте правильность заполнения полей.';
      list.append(item);
    }
    error.append(list);
    error.focus();
  }

  function togglePatient() {
    const same = $('cr-payer_is_patient').checked;
    $('cr-patient-block').hidden = same;
    $('cr-patient-block').disabled = same;
  }

  // Подпись и подсказка поля «серия и номер» пациента зависят от вида документа.
  function syncPatientDoc() {
    const dt = $('cr-patient_doc_type_code').value;
    const inp = $('cr-patient_doc_serie_number');
    if (dt === '03') {
      $('cr-patient_doc_label').textContent = 'Серия и номер свидетельства *';
      inp.placeholder = 'напр. II-МЮ №123456';
      inp.removeAttribute('inputmode');
    } else {
      $('cr-patient_doc_label').textContent = 'Серия и номер паспорта *';
      inp.placeholder = '10 цифр';
      inp.setAttribute('inputmode', 'numeric');
    }
  }

  // Приводим введённый телефон к виду +7XXXXXXXXXX (на blur, чтобы не мешать вводу).
  function bindPhone(id) {
    const el = $(id);
    el.addEventListener('blur', () => { const p = toRuPhone(el.value); if (p) el.value = p; });
  }

  async function loadConfig() {
    ready = false;
    $('cr-submit').disabled = true;
    $('cr-retry').hidden = true;
    $('cr-loading').hidden = false;
    $('cr-error').textContent = '';
    try {
      const response = await api(`${base}/config`);
      if (!response.ok) throw new Error('config');
      const cfg = await response.json();
      if (!Array.isArray(cfg.years) || !cfg.years.length ||
          !cfg.years.every(Number.isInteger) || !Array.isArray(cfg.relationships) ||
          !cfg.relationships.every(r => typeof r.code === 'string' && typeof r.label === 'string')) throw new Error('config');
      $('cr-clinic').textContent = cfg.clinicName || '';
      $('cr-report_year').replaceChildren(...cfg.years.map(y => new Option(String(y), String(y))));
      $('cr-relationship').replaceChildren(new Option('Выберите степень родства', ''),
        ...cfg.relationships.map(r => new Option(r.label, r.code)));
      ready = true;
      $('cr-submit').disabled = false;
    } catch {
      $('cr-error').textContent = 'Не удалось загрузить форму. Попробуйте ещё раз.';
      $('cr-retry').hidden = false;
    } finally {
      $('cr-loading').hidden = true;
    }
  }

  function init() {
    $('cr-payer_is_patient').addEventListener('change', togglePatient);
    togglePatient();
    $('cr-patient_doc_type_code').addEventListener('change', syncPatientDoc);
    syncPatientDoc();
    bindPhone('cr-payer_phone');
    bindPhone('cr-patient_phone');
    $('cr-form').addEventListener('submit', submit);
    $('cr-retry').addEventListener('click', loadConfig);
    $('cr-download').addEventListener('click', download);
    loadConfig();
  }

  async function download() {
    const button = $('cr-download');
    button.disabled = true;
    $('cr-download-error').textContent = '';
    try {
      const response = await api(`${base}/application/${encodeURIComponent(applicationToken)}`);
      if (response.status === 404) {
        $('cr-download-error').textContent = 'Ссылка на заявление недоступна или срок её действия истёк. Заявка уже принята — обратитесь в клинику за заявлением.';
        return;
      }
      if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) throw new Error('download');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'zayavlenie.pdf';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      $('cr-download-error').textContent = 'Не удалось скачать заявление. Попробуйте ещё раз — повторно отправлять заявку не нужно.';
    } finally {
      button.disabled = false;
    }
  }

  async function submit(ev) {
    ev.preventDefault();
    if (!ready || sending || applicationToken) return;
    $('cr-error').innerHTML = '';
    const same = $('cr-payer_is_patient').checked;
    const body = { report_year: Number($('cr-report_year').value), payer_is_patient: same,
      consent: $('cr-consent').checked, relationship: $('cr-relationship').value, website: $('cr-website').value };
    for (const f of TEXT_FIELDS) {
      if (same && f.startsWith('patient_')) continue;
      body[f] = $('cr-' + f).value.trim();
    }
    body.payer_doc_type_code = '21'; // получатель справки — всегда паспорт РФ

    const errs = validate(body, same);
    if (!$('cr-payer_email').validity.valid) {
      $('cr-payer_email').reportValidity();
      return;
    }
    if (errs.length) { showErrors(errs); return; }

    // Телефоны → канонический +7 перед отправкой (сервер тоже нормализует).
    body.payer_phone = toRuPhone(body.payer_phone) || body.payer_phone;
    if (!same) body.patient_phone = toRuPhone(body.patient_phone) || body.patient_phone;

    sending = true;
    const btn = $('cr-submit'); btn.disabled = true; btn.textContent = 'Отправка…';
    try {
      const resp = await api(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (data.error === 'validation') showErrors(data.fields);
        else $('cr-error').textContent = data.error === 'too_many_requests'
          ? 'Слишком много заявок с этого устройства. Попробуйте позже.'
          : 'Не удалось отправить заявку. Повторите попытку.';
        return;
      }
      if (data.ok !== true || typeof data.applicationToken !== 'string' || !/^[a-f0-9]{48}$/.test(data.applicationToken)) throw new Error('response');
      applicationToken = data.applicationToken;
      $('cr-form-view').hidden = true;
      $('cr-ok-view').hidden = false;
      $('cr-form').reset();
      $('cr-success-title').focus();
    } catch {
      $('cr-error').textContent = 'Не удалось получить подтверждение отправки. Если связь прервалась, заявка могла быть принята — уточните в клинике перед повторной отправкой.';
    } finally { sending = false; btn.disabled = false; btn.textContent = 'Отправить заявку'; }
  }

  init();
}
