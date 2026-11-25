import 'server-only';
import {Resend} from 'resend';
import {getTranslations} from 'next-intl/server';
import {isAppLocale} from './i18n/locales';
import {erasureId} from './account-erasure';

/** Fixed recipient from the verified identity snapshot; no request-supplied addresses. */
export async function sendErasureNotice(id:string,notice:{email?:unknown;locale?:unknown;kind?:unknown}) {
 if(!erasureId(id)||typeof notice.email!=='string'||notice.email.length>254||!/^[^\s@]+@[^\s@]+$/.test(notice.email)
  ||!isAppLocale(notice.locale)||!['active','complete'].includes(String(notice.kind))||!process.env.RESEND_API_KEY)throw new Error('notice_unavailable');
 const t=await getTranslations({locale:notice.locale,namespace:'AccountErasure'});
 const result=await new Resend(process.env.RESEND_API_KEY).emails.send({
  from:'CineGenius <hello@cinegenius.co>',to:notice.email,replyTo:'hello@cinegenius.co',
  subject:t('mailSubject'),text:t(notice.kind==='active'?'mailActive':'mailComplete')+'\n\n'+t('receipt',{id})+'\nhello@cinegenius.co',
 },{idempotencyKey:'erasure-'+id+'-'+notice.kind});
 if(result.error||!result.data?.id)throw new Error('notice_unavailable');
}

export async function sendErasureAlert(id:string){
 if(!erasureId(id)||!process.env.RESEND_API_KEY)throw new Error('notice_unavailable');
 const t=await getTranslations({locale:'de',namespace:'AccountErasure'});
 const result=await new Resend(process.env.RESEND_API_KEY).emails.send({from:'CineGenius <hello@cinegenius.co>',to:'hello@cinegenius.co',
  subject:t('adminTitle'),text:t('alert')+'\n\n'+t('receipt',{id})+'\nhttps://www.cinegenius.co/admin/privacy-requests'},
  {idempotencyKey:'erasure-alert-'+id});
 if(result.error||!result.data?.id)throw new Error('notice_unavailable');
}
