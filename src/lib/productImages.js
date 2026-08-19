import { supabase } from '@lib/supabase';

/*
 * Photographs, resized in the browser before they are sent.
 *
 * A phone photograph is three to five megabytes and four thousand pixels wide.
 * Uploading that and serving it to a shopper on mobile data would make her own
 * pictures load slower than the 300px eBay thumbnails they replace, which
 * would be a strange way to lose.
 *
 * Resizing here rather than on the way out, because Supabase image
 * transformations are a paid tier and this project should not quietly acquire
 * a dependency on one. The trade is that there is one size on disk rather than
 * a srcset, which is worth naming: the store design document asks for AVIF then
 * WebP then JPEG at 1x and 2x, and this delivers one good WebP. That is a large
 * improvement on what is there and it is not the finished answer.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.85;
const BUCKET = 'store-images';

/*
 * WebP where the browser can encode it, JPEG otherwise.
 *
 * Checked by asking a canvas rather than by sniffing the user agent, because
 * the question is whether this browser can produce the format, and a user agent
 * string is a claim rather than an answer.
 */
function bestType() {
  if (typeof document === 'undefined') return 'image/jpeg';
  const probe = document.createElement('canvas');
  probe.width = 1;
  probe.height = 1;
  return probe.toDataURL('image/webp').startsWith('data:image/webp')
    ? 'image/webp'
    : 'image/jpeg';
}

async function shrink(file) {
  const type = bestType();

  // createImageBitmap honours EXIF orientation, which an Image element does
  // not, so a photograph taken in portrait does not arrive on its side.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');

  /*
   * A white ground under everything.
   *
   * A PNG with transparency encoded to JPEG turns its transparent pixels
   * black, which on a product cut out against nothing produces a black box.
   * The shop sits on cream and the tile sits on white, so white is the honest
   * default.
   */
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
  if (!blob) throw new Error('That image could not be read. Try a JPEG or a PNG.');

  return { blob, type };
}

const extensionFor = (type) => (type === 'image/webp' ? 'webp' : 'jpg');

/*
 * Path is {tenant}/{product}/{uuid}.{ext}.
 *
 * The tenant comes first so a per tenant policy later is a predicate on the
 * first segment rather than a migration of every file. The uuid rather than
 * the original filename, because two photographs called IMG_0421.jpg from the
 * same phone are the commonest upload there is.
 */
export async function uploadProductImage({ tenantId, productId, file }) {
  if (!file) throw new Error('No file chosen.');
  if (!file.type.startsWith('image/')) throw new Error('That is not an image.');

  const { blob, type } = await shrink(file);
  const path = `${tenantId}/${productId}/${crypto.randomUUID()}.${extensionFor(type)}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: type, cacheControl: '31536000', upsert: false });

  if (error) throw new Error(error.message ?? 'The upload failed.');

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/*
 * Removes the file as well as the reference.
 *
 * Only ours. A seeded product's images are eBay URLs and there is nothing of
 * ours to delete, so a remove on one of those takes it off the product and
 * leaves the internet alone.
 */
export async function deleteProductImage(url) {
  const marker = `/${BUCKET}/`;
  const at = String(url ?? '').indexOf(marker);
  if (at === -1) return;

  const path = url.slice(at + marker.length).split('?')[0];
  await supabase.storage.from(BUCKET).remove([decodeURIComponent(path)]);
}
