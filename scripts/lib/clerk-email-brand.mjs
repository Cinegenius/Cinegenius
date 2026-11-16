/** Presentation-only adapter for the existing Clerk templates. No delivery,
 * subject, token, security text or link changes. Operates on an audited export. */
const palette = {
  background: '#0e1016', surface: '#161a23', raised: '#1e2330',
  border: '#2a3248', accent: '#c2f135', text: '#f0f2f5', muted: '#b2bbc8',
};
const light = new Set(['#fff', '#ffffff', '#fafafb', '#eeeef0']);
const dark = new Set(['#111827', '#131316', '#000000', '#000']);
const muted = new Set(['#747686', '#868e96', '#9ca3af', '#aaaaaa']);
const brand = '<span style="color:#c2f135;font-size:29px;vertical-align:-1px">›</span>&nbsp; <span style="color:#f0f2f5;font-size:22px;font-weight:700">Cine<span style="color:#c2f135">Genius</span></span>';

function color(value, property, button = false, link = false) {
  const key = value.toLowerCase();
  if (property.startsWith('border') || property === 'box-shadow') return palette.border;
  if (property.startsWith('background')) {
    if (dark.has(key) || key === '#6c47ff') return palette.accent;
    if (light.has(key)) return palette.surface;
    return palette.raised;
  }
  if (property === 'color') {
    if (button) return palette.background;
    if (link || key === '#6c47ff') return palette.accent;
    if (muted.has(key)) return palette.muted;
    return palette.text;
  }
  return value;
}

function css(source, {button, link}) {
  let result = source.replace(/([\w-]+)\s*:\s*([^;]+)/g, (all, property, value) => {
    if (!['color', 'background', 'background-color', 'border', 'border-color', 'border-bottom', 'border-top', 'box-shadow'].includes(property)) return all;
    return `${property}: ${value.replace(/#[a-f\d]{3,8}\b/gi, hex => color(hex, property, button, link))}`;
  });
  if (button) {
    const controlled = new Set(['height', 'line-height', 'padding', 'font-size', 'font-weight', 'white-space', 'background', 'box-shadow', 'color', 'border-radius']);
    result = result.split(';').filter(part => !controlled.has(part.split(':')[0].trim())).join(';');
    result += `;padding:14px 22px;font-size:15px;line-height:20px;font-weight:700;white-space:normal;background:${palette.accent};color:${palette.background};border-radius:10px;box-shadow:none;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere`;
  }
  return result;
}

export function brandedClerkHtml(original) {
  let result = original.replace(/<(?:[a-z][\w-]*)\b[^>]*>/gi, tag => {
    const button = /class="[^"]*cl-branded-button/.test(tag);
    const link = /^<a\b/i.test(tag);
    return tag.replace(/style="([^"]*)"/g, (_, style) => `style="${css(style, {button, link})}"`)
      .replace(/bgcolor="(#[a-f\d]+)"/gi, (_, hex) => `bgcolor="${color(hex, 'background')}"`);
  });
  result = result.replace(/{{>\s*app_logo\s*}}/g, brand);
  result = result.replace(/<body\b([^>]*)>/i, (tag, attributes) => `<body${attributes} data-cinegenius-email="clerk-v1">`);
  const firstCell = (className, additions) => {
    const pattern = new RegExp(`(<table[^>]*class="${className}"[^>]*>[\\s\\S]*?<td[^>]*style=")([^"]*)(")`);
    result = result.replace(pattern, (_, start, style, end) => `${start}${style};${additions}${end}`);
  };
  firstCell('body', `padding:24px 12px;background:${palette.background}`);
  firstCell('header container', `padding:22px 24px;background:${palette.surface};border:1px solid ${palette.border};border-radius:16px 16px 0 0`);
  firstCell('block', 'padding:26px 24px');
  firstCell('main container', `border:1px solid ${palette.border};border-top:0;border-radius:0 0 16px 16px;overflow:hidden`);
  // Existing responsive tables/Outlook fallbacks stay intact. These additions
  // keep long tokens/translated headings readable at 320px without clipping.
  result = result.replace('</head>', `<style type="text/css">body{background:${palette.background} !important} .container{max-width:600px !important;table-layout:fixed} td,p{overflow-wrap:anywhere;word-wrap:break-word;word-break:break-word} .main .block{table-layout:fixed} @media all and (max-width:639px){.container{width:100% !important} td{box-sizing:border-box}}</style></head>`);
  return result;
}

export function brandedClerkMarkup(original) {
  let result = original.replace(/<(?:[a-z][\w-]*)\b[^>]*>/gi, tag => {
    const button = /^<re-button\b/.test(tag), link = /^<a\b/.test(tag);
    let styled = tag.replace(/(color|background-color)="(#[a-f\d]+)"/gi,
      (_, property, hex) => `${property}="${color(hex, property, button, link)}"`)
      .replace(/style="([^"]*)"/g, (_, style) => `style="${css(style, {button, link})}"`);
    if (button) styled = styled.replace(/padding="[^"]*"/, 'padding="14px 22px"').replace(/font-size="[^"]*"/, 'font-size="15px"').replace(/border-radius="[^"]*"/, 'border-radius="10px"');
    if (/^<re-body\b/.test(tag)) styled = styled.replace(/padding="[^"]*"/, 'padding="24px 12px"').replace(/background-color="[^"]*"/, `background-color="${palette.background}"`);
    if (/^<re-header\b/.test(tag)) styled = styled.replace(/padding="[^"]*"/, 'padding="22px 24px"');
    if (/^<re-block\b/.test(tag)) styled = styled.replace(/padding="[^"]*"/, 'padding="26px 24px"');
    return styled;
  });
  return result.replace(/{{>\s*app_logo\s*}}/g, brand);
}

export function assertTemplateContentPreserved(before, after) {
  const tokens = source => (source.match(/{{{?[\s\S]*?}}}?/g) ?? []).filter(token => !/^{{>\s*app_logo\s*}}$/.test(token));
  const links = source => [...source.matchAll(/(?:href|src)="([^"]*)"/g)].map(match => match[1]);
  if (JSON.stringify(tokens(before)) !== JSON.stringify(tokens(after))) throw new Error('Template variables changed');
  if (JSON.stringify(links(before)) !== JSON.stringify(links(after))) throw new Error('Template links changed');
}

export function prepareClerkEmailBrand(template) {
  if (template.template_type !== 'email' || !template.can_edit_body) return null;
  if (!template.body || !template.markup) throw new Error(`Missing template source: ${template.slug}`);
  const body = brandedClerkHtml(template.body), markup = brandedClerkMarkup(template.markup);
  assertTemplateContentPreserved(template.body, body);
  assertTemplateContentPreserved(template.markup, markup);
  return {body, markup};
}
