export const MAX_PIXELS = 40000000;
export function validateMasks(masks) {
  if (!Array.isArray(masks) || masks.length < 1 || masks.length > 12) throw new Error('Добавьте от 1 до 12 плашек.');
  return masks.map(m => {
    const bounds = { x: [0, 1], y: [0, 1], width: [0.02, 1], height: [0.01, 1], angle: [-180, 180] };
    for (const [key, [min, max]] of Object.entries(bounds)) {
      if (typeof m?.[key] !== 'number' || !Number.isFinite(m[key]) || m[key] < min || m[key] > max) throw new Error('Некорректное положение или размер плашки.');
    }
    return Object.fromEntries(Object.keys(bounds).map(k => [k, m[k]]));
  });
}
// Vector lettering makes the branded strip identical in browser and server, without fonts.
const letters = 'M0 10V0H4Q7 0 7 3T4 6H0 M10 0V10H17M10 0H17M10 5H16 M20 10V0H24Q27 0 27 3T24 6H20M24 6L28 10 M31 0H37M34 0V10M31 10H37';
export function maskGroup(m, width, height) {
  const w = m.width * width, h = m.height * height;
  const scale = Math.min(w / 60, h / 20);
  return `<g transform="translate(${m.x * width} ${m.y * height}) rotate(${m.angle})"><rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" fill="#24231f"/><path d="${letters}" transform="translate(${-18.5*scale} ${-5*scale}) scale(${scale})" fill="none" stroke="#d4bb83" stroke-width="0.9" stroke-linejoin="round"/></g>`;
}
export function overlaySvg(masks, width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${masks.map(m => maskGroup(m, width, height)).join('')}</svg>`;
}
