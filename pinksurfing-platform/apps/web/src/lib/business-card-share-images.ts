import { toPng } from 'html-to-image';
import type { BusinessCardSnapshot } from '@/lib/business-card-types';
import { cardDisplayTitle } from '@/lib/business-card-types';

export type BusinessCardShareImages = {
  front: Blob;
  back: Blob;
  combined: Blob;
};

function blobFromDataUrl(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob());
}

/** Rasterize a card DOM node to PNG at 2× for crisp sharing */
export async function captureElementAsPng(el: HTMLElement): Promise<Blob> {
  const dataUrl = await toPng(el, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: '#000000',
    skipFonts: false,
  });
  return blobFromDataUrl(dataUrl);
}

export async function combineCardImagesVertically(
  top: Blob,
  bottom: Blob,
  gap = 16
): Promise<Blob> {
  const load = (b: Blob) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(b);
    });

  const [imgTop, imgBottom] = await Promise.all([load(top), load(bottom)]);
  const w = Math.max(imgTop.width, imgBottom.width);
  const h = imgTop.height + gap + imgBottom.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(imgTop, (w - imgTop.width) / 2, 0);
  ctx.drawImage(imgBottom, (w - imgBottom.width) / 2, imgTop.height + gap);

  URL.revokeObjectURL(imgTop.src);
  URL.revokeObjectURL(imgBottom.src);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png');
  });
}

export async function captureBusinessCardImages(
  frontEl: HTMLElement,
  backEl: HTMLElement
): Promise<BusinessCardShareImages> {
  const [front, back] = await Promise.all([
    captureElementAsPng(frontEl),
    captureElementAsPng(backEl),
  ]);
  const combined = await combineCardImagesVertically(front, back);
  return { front, back, combined };
}

export function shareImageFileName(card: BusinessCardSnapshot, suffix: string): string {
  const base =
    cardDisplayTitle(card)
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 48) || 'pinksurfing-card';
  return `${base}-${suffix}.png`;
}

export function businessCardShareFiles(
  card: BusinessCardSnapshot,
  images: BusinessCardShareImages
): { front: File; back: File; combined: File } {
  return {
    front: new File([images.front], shareImageFileName(card, 'front'), { type: 'image/png' }),
    back: new File([images.back], shareImageFileName(card, 'back'), { type: 'image/png' }),
    combined: new File([images.combined], shareImageFileName(card, 'card'), { type: 'image/png' }),
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function shareFilesNative(
  files: File[],
  text?: string
): Promise<'ok' | 'cancelled' | 'unsupported'> {
  if (typeof navigator === 'undefined' || !navigator.share) return 'unsupported';
  if (files.length && !navigator.canShare?.({ files })) return 'unsupported';
  try {
    await navigator.share({
      files,
      text,
      title: 'PinkSurfing Business Card',
    });
    return 'ok';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    return 'unsupported';
  }
}

export type ShareImageResult = 'ok' | 'cancelled' | 'unsupported' | 'downloaded';

/** Share card images — prefers native file share (WhatsApp on mobile), else downloads PNGs */
export async function shareBusinessCardImages(
  channel: 'native' | 'whatsapp' | 'telegram' | 'sms',
  card: BusinessCardSnapshot,
  images: BusinessCardShareImages
): Promise<ShareImageResult> {
  const files = businessCardShareFiles(card, images);
  const caption = `PinkSurfing business card — ${cardDisplayTitle(card)}`;

  const tryShare = async (pick: File[]): Promise<ShareImageResult> => {
    const result = await shareFilesNative(pick, caption);
    if (result === 'ok' || result === 'cancelled') return result;
    return 'unsupported';
  };

  if (channel === 'native' || channel === 'whatsapp' || channel === 'telegram') {
    let result = await tryShare([files.front, files.back]);
    if (result !== 'unsupported') return result;
    result = await tryShare([files.combined]);
    if (result !== 'unsupported') return result;
  }

  if (channel === 'sms') {
    const result = await tryShare([files.combined]);
    if (result !== 'unsupported') return result;
  }

  downloadBlob(images.combined, files.combined.name);
  downloadBlob(images.front, files.front.name);
  downloadBlob(images.back, files.back.name);

  return 'downloaded';
}
