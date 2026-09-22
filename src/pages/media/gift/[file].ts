import type { APIContext } from 'astro';
import { getGiftMedia } from '../../../lib/giftMedia';

export async function getStaticPaths() {
  return (await getGiftMedia()).map(media => ({ params: { file: media.file } }));
}
export async function GET({ params }: APIContext) {
  const media = (await getGiftMedia()).find(item => item.file === params.file)!;
  return new Response(media.bytes, { headers: { 'Content-Type': media.type } });
}
