import { createHash, randomUUID } from 'node:crypto';
import { mkdir, stat, rename, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';

export interface VideoFile {
  id: string;
  type: string;
  filesize: number | string;
  modified_on?: string | null;
  uploaded_on?: string | null;
}
export const maxVideoBytes = 50 * 1024 * 1024;

export function videoFileName(file: VideoFile): string {
  const extension = ({ 'video/mp4': 'mp4', 'video/webm': 'webm' } as Record<string, string>)[file.type];
  const size = Number(file.filesize);
  const version = file.modified_on || file.uploaded_on;
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(file.id) || !extension || !version || !Number.isFinite(Date.parse(version)) || !Number.isSafeInteger(size) || size <= 0 || size > maxVideoBytes) {
    throw new Error('Некорректное видео: требуется MP4/WebM до 50 МБ с метаданными файла.');
  }
  // Replacing a file must change the public URL and invalidate the download cache.
  const hash = createHash('sha256').update(`${version}:${size}`).digest('hex').slice(0, 16);
  return `${file.id}-${hash}.${extension}`;
}

export async function cacheVideo(file: VideoFile, options: { baseUrl: string; token: string; cacheDir: string }): Promise<string> {
  const name = videoFileName(file);
  const target = join(options.cacheDir, name);
  await mkdir(options.cacheDir, { recursive: true });
  if (await stat(target).then(s => s.size === Number(file.filesize)).catch(() => false)) return target;
  const response = await fetch(`${options.baseUrl.replace(/\/$/, '')}/assets/${file.id}`, {
    headers: { Authorization: `Bearer ${options.token}` }, redirect: 'error', signal: AbortSignal.timeout(120000),
  });
  if (!response.ok || !response.body || response.headers.get('content-type')?.split(';')[0] !== file.type) {
    throw new Error(`Не удалось получить видео ${file.id}: HTTP ${response.status} или неподдерживаемый тип файла.`);
  }
  const temporary = `${target}.${randomUUID()}.part`;
  let bytes = 0;
  try {
    await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        callback(bytes > maxVideoBytes ? new Error('Видео превышает 50 МБ') : null, chunk);
      },
    }), createWriteStream(temporary, { flags: 'wx' }));
    if (bytes !== Number(file.filesize)) throw new Error(`Неполная загрузка видео ${file.id}`);
    await rename(temporary, target);
    return target;
  } finally { await rm(temporary, { force: true }); }
}
