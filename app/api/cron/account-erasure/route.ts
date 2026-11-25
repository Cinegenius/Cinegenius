import {createAppServiceCron} from '@/lib/app-service-cron';
import {runAccountErasureBatch} from '@/lib/account-erasure-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=150;
const handle=createAppServiceCron('ACCOUNT_ERASURE_CRON_ENABLED',runAccountErasureBatch);
export const GET=handle;
export const HEAD=handle;
