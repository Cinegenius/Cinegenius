// Independently reproduce the published uploadGuard v1 transform. No credentials.
// The product repeats this transform itself; exact readback must match these
// controller-approved bytes before any image-bearing article can be published.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('/srv/cinegenius/releases/20261118-profile-art/node_modules/sharp');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const transform = bytes => sharp(bytes, {limitInputPixels: 40_000_000, animated: false, failOn: 'warning'})
  .rotate().resize({width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true})
  .webp({quality: 85}).timeout({seconds: 10}).toBuffer();
async function main() {
  const request = JSON.parse(fs.readFileSync(0, 'utf8'));
  const inputPath = path.resolve(request.path), folder = path.dirname(inputPath);
  if (fs.lstatSync(inputPath).isSymbolicLink() || fs.statSync(inputPath).size > 10_000_000) throw new Error('invalid_input');
  const original = fs.readFileSync(inputPath);
  if (digest(original) !== request.sha256 || !['image/jpeg', 'image/png'].includes(request.mime)) throw new Error('source_digest');
  const first = await transform(original);
  let uploadPath = inputPath, upload = original, uploadMime = request.mime;
  // A large source is retained privately. The bounded upload derivative is then
  // transformed once more exactly as the product will transform that input.
  if (original.length > 4 * 1024 * 1024) {
    uploadPath = path.join(folder, request.sha256 + '-upload.webp');
    upload = first; uploadMime = 'image/webp';
    if (upload.length > 4 * 1024 * 1024) throw new Error('upload_too_large');
    fs.writeFileSync(uploadPath, upload, {mode: 0o600});
  }
  const expected = upload === original ? first : await transform(upload);
  if (expected.length > 4 * 1024 * 1024) throw new Error('published_image_too_large');
  const publishedPath = path.join(folder, request.sha256 + '-published.webp');
  fs.writeFileSync(publishedPath, expected, {mode: 0o600});
  const metadata = await sharp(expected).metadata();
  console.log(JSON.stringify({uploadPath, uploadSha256: digest(upload), uploadMime,
    publishedPath, publishedSha256: digest(expected), publishedMime: 'image/webp',
    publishedWidth: metadata.width, publishedHeight: metadata.height,
    normalization: {recipe: 'upload-guard-webp-v1', sharp: sharp.versions.sharp, vips: sharp.versions.vips, webp: sharp.versions.webp},
    changes: 'CineGenius: converted to WebP, metadata removed, orientation normalized and resized if necessary. Display may be cropped to fit. Same photo licence applies.'}));
}
main().catch(() => { console.error('normalization_failed'); process.exitCode = 1; });
