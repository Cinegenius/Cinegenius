import { createAppServiceCron } from "@/lib/app-service-cron";
import { runNativePushWorker } from "@/lib/native-push-worker";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;
const handle = createAppServiceCron("NATIVE_PUSH_CRON_ENABLED", runNativePushWorker);
export const GET = handle;
export const HEAD = handle;
