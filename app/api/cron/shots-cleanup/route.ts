import { createAppServiceCron } from "@/lib/app-service-cron";
import { runShotsCleanup } from "@/lib/shots-cleanup";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;
const handle = createAppServiceCron("SHOTS_CLEANUP_CRON_ENABLED", runShotsCleanup);
export const GET = handle;
export const HEAD = handle;
