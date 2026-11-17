// Offline only. This command cannot send emails or change Clerk settings.
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';
import {prepareClerkEmailBrand} from './lib/clerk-email-brand.mjs';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/prepare-clerk-email-brand.mjs PRIVATE_EXPORT.json PRIVATE_OUTPUT_DIRECTORY');
const templates = JSON.parse(await readFile(resolve(input), 'utf8'));
if (!Array.isArray(templates)) throw new Error('Expected audited template array');
await mkdir(resolve(output), {recursive: true, mode: 0o700});
const report = [];
for (const template of templates) {
  if (!/^[a-z0-9_]+$/.test(template.slug)) throw new Error('Invalid template slug');
  const patch = prepareClerkEmailBrand(template);
  const before = {body: template.body, markup: template.markup, subject: template.subject,
    delivered_by_clerk: template.delivered_by_clerk, enabled: template.enabled};
  const sha256 = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  report.push({slug: template.slug, editable: Boolean(patch), beforeSha256: sha256(before),
    patchSha256: patch ? sha256(patch) : null, deliveredByClerk: template.delivered_by_clerk});
  if (patch) await writeFile(join(resolve(output), template.slug+'.json'), JSON.stringify(patch, null, 2)+'\n', {mode: 0o600});
}
await writeFile(join(resolve(output), 'manifest.json'), JSON.stringify(report, null, 2)+'\n', {mode: 0o600});
console.log(JSON.stringify({prepared: report.filter(item => item.editable).length, locked: report.filter(item => !item.editable).map(item => item.slug), applied: false, emailsSent: 0}));
