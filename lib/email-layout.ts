/** Shared, transport-independent email presentation. Callers escape member text
 * before passing HTML; no external images, scripts, fonts or tracking pixels. */
export function emailEscape(value: string) {
  return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
}
export function emailButton(labelHtml: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;max-width:100%"><tr><td bgcolor="#c2f135" style="background:#c2f135;border-radius:10px;text-align:center"><a href="${emailEscape(href)}" style="display:inline-block;box-sizing:border-box;max-width:100%;padding:14px 22px;color:#0e1016;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;border-radius:10px;overflow-wrap:anywhere">${labelHtml}</a></td></tr></table>`;
}
export function emailLayout(contentHtml: string, {locale,footerHtml,title='',preheader='',siteUrl='https://cinegenius.co'}: {
  locale: string; footerHtml: string; title?: string; preheader?: string; siteUrl?: string;
}) {
  const url=emailEscape(siteUrl);
  return `<!DOCTYPE html><html lang="${emailEscape(locale)}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="dark"/><meta name="supported-color-schemes" content="dark"/><title>${emailEscape(title)}</title></head>
<body style="margin:0;padding:0;background:#0e1016;color:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;-webkit-text-size-adjust:100%">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${emailEscape(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0e1016" style="width:100%;background:#0e1016"><tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#161a23" data-cinegenius-email="v1" style="width:100%;max-width:600px;table-layout:fixed;background:#161a23;border:1px solid #2a3248;border-radius:16px;border-collapse:separate;border-spacing:0;overflow:hidden">
<tr><td style="padding:22px 24px;border-bottom:1px solid #2a3248"><a href="${url}" style="font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#f0f2f5;text-decoration:none"><span style="color:#c2f135;font-size:29px;vertical-align:-1px">›</span>&nbsp; Cine<span style="color:#c2f135">Genius</span></a></td></tr>
<tr><td style="padding:26px 24px;overflow-wrap:anywhere;word-break:break-word">${contentHtml}</td></tr>
<tr><td style="padding:18px 24px;border-top:1px solid #2a3248;overflow-wrap:anywhere"><p style="margin:0;color:#8995a8;font-size:12px;line-height:1.6">${footerHtml}</p><p style="margin:8px 0 0;font-size:12px;line-height:1.6"><a href="${url}" style="color:#c2f135;text-decoration:none">cinegenius.co</a></p></td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
