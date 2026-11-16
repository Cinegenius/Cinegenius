import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareClerkEmailBrand, assertTemplateContentPreserved} from '../scripts/lib/clerk-email-brand.mjs';

const body = `<html><head><title>{{app.name}}</title></head><body style="background-color:#ffffff">
{{> app_logo}}<p style="color:#111827">Keep your code secret: {{otp_code}}</p>
{{#if revoke_session_url}}<a class="cl-branded-button" href="{{revoke_session_url}}" style="color:#ffffff;background:#131316;height:30px;line-height:30px;white-space:nowrap">Review</a>{{/if}}
<a href="https://example.test/security?ticket=opaque%2Fvalue&amp;x=1#abc" style="color:#131316">Help</a>{{> footer}}</body></html>`;
const markup = `<re-html><re-body background-color="#ffffff"><re-text>{{> app_logo}}</re-text><re-text color="#747686">Keep {{otp_code}}</re-text><re-button href="{{magic_link}}" padding="6px 10px" font-size="13px" background-color="#131316" color="#ffffff">Sign in</re-button></re-body></re-html>`;
const template = {template_type:'email', can_edit_body:true, slug:'verification_code', body, markup,
  subject:'{{otp_code}}', delivered_by_clerk:true, enabled:true};

test('provider restyling preserves security tokens, conditions, action URLs and settings', () => {
  const original = structuredClone(template), patch = prepareClerkEmailBrand(template);
  assert.deepEqual(template, original);
  assert.deepEqual(Object.keys(patch).sort(), ['body','markup']);
  assertTemplateContentPreserved(body, patch.body);
  assertTemplateContentPreserved(markup, patch.markup);
  assert.ok(patch.body.includes('Keep your code secret: {{otp_code}}'));
  assert.match(patch.body, /color:#0e1016/);
  assert.match(patch.body, /padding:14px 22px/);
  assert.doesNotMatch(patch.body, /height:30px|white-space:nowrap/);
  assert.match(patch.body, /Cine<span style="color:#c2f135">Genius/);
  assert.match(patch.markup, /background-color="#c2f135" color="#0e1016"/);
});
test('locked provider templates and SMS are not rewritten', () => {
  assert.equal(prepareClerkEmailBrand({...template, can_edit_body:false}), null);
  assert.equal(prepareClerkEmailBrand({...template, template_type:'sms'}), null);
  assert.throws(() => prepareClerkEmailBrand({...template, markup:null}));
});
test('validation refuses a missing OTP, changed security URL or removed conditional', () => {
  for (const altered of [body.replace('{{otp_code}}','123456'), body.replace('opaque%2Fvalue','other'), body.replace('{{#if revoke_session_url}}','')]) {
    assert.throws(() => assertTemplateContentPreserved(body, altered));
  }
});
