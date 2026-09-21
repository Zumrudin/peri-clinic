import { Readable } from 'node:stream';
import sharp from 'sharp';
import { validateMasks, overlaySvg, MAX_PIXELS } from './geometry.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default (router, { services, getSchema, logger }) => {
  const { FilesService, AssetsService } = services;
  let processing = false;
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!req.accountability?.user || !(req.accountability.admin || req.accountability.app)) return res.status(403).json({ errors: [{ message: 'Доступно только сотрудникам в админке.' }] });
    next();
  });
  async function resolve(req, id) {
    if (!uuid.test(id || '')) throw Object.assign(new Error('Некорректный файл.'), { status: 400 });
    const options = { schema: await getSchema(), accountability: req.accountability };
    const files = new FilesService(options);
    const selected = await files.readOne(id);
    const edit = selected.peri_eye_edit;
    const source = edit?.version === 1 ? await files.readOne(edit.source) : selected;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(source.type)) throw Object.assign(new Error('Для плашек используйте JPEG, PNG или WebP.'), { status: 400 });
    return { files, options, source, masks: edit?.version === 1 ? validateMasks(edit.masks) : [] };
  }
  const fail = (res, error) => {
    logger.warn(error, 'PERI photo mask');
    const status = error.status || (error.code === 'FORBIDDEN' ? 403 : 500);
    res.status(status).json({ errors: [{ message: status === 500 ? 'Не удалось обработать фото. Повторите попытку.' : error.message }] });
  };
  router.get('/:id', async (req, res) => {
    try {
      const { source, masks } = await resolve(req, req.params.id);
      res.json({ data: { source: source.id, masks } });
    } catch (error) { fail(res, error); }
  });
  router.post('/:id', async (req, res) => {
    if (processing) return res.status(429).json({ errors: [{ message: 'Обрабатывается другое фото. Повторите через несколько секунд.' }] });
    processing = true;
    let created, files;
    try {
      let masks;
      try { masks = validateMasks(req.body?.masks); } catch (error) { error.status = 400; throw error; }
      const resolved = await resolve(req, req.params.id);
      files = resolved.files;
      const { source, options } = resolved;
      if (Number(source.filesize) > 50 * 1024 * 1024) throw Object.assign(new Error('Максимальный размер фото — 50 МБ.'), { status: 400 });
      const { stream } = await new AssetsService(options).getAsset(source.id);
      const chunks = [];
      let size = 0;
      for await (const chunk of stream) {
        size += chunk.length;
        if (size > 50 * 1024 * 1024) throw Object.assign(new Error('Максимальный размер фото — 50 МБ.'), { status: 400 });
        chunks.push(chunk);
      }
      // Normalize EXIF orientation before applying normalized coordinates; omit all metadata.
      const input = Buffer.concat(chunks);
      const metadata = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
      if ((metadata.pages || 1) > 1) throw Object.assign(new Error('Анимированные изображения не поддерживаются.'), { status: 400 });
      const { data, info } = await sharp(input, { limitInputPixels: MAX_PIXELS }).rotate().png().toBuffer({ resolveWithObject: true });
      const output = await sharp(data, { limitInputPixels: MAX_PIXELS }).composite([{ input: Buffer.from(overlaySvg(masks, info.width, info.height)) }]).png().toBuffer();
      created = await files.uploadOne(Readable.from(output), {
        filename_download: `${source.filename_download.replace(/\.[^.]+$/, '')}-peri.png`,
        type: 'image/png', title: `${source.title || 'Фото'} — плашка PERI`, folder: source.folder,
      });
      // A separate field survives Directus's own metadata extraction during upload.
      await files.updateOne(created, { peri_eye_edit: { version: 1, source: source.id, masks } });
      res.json({ data: { id: created } });
    } catch (error) {
      if (created) await files.deleteOne(created).catch(e => logger.error(e, 'Photo copy cleanup failed'));
      fail(res, error);
    } finally { processing = false; }
  });
};
