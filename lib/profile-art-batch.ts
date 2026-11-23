/** Node-only durable Batch adapter; never accepts member photos or prompts. */
import { createHash } from 'node:crypto';
import { PROFILE_ART_REFILL_POLICY as POLICY, isArtSHA, isArtUUID, type ArtJob } from '@/lib/profile-art-refill-contract';
import { ArtPipelineError, readArtStream, withArtDeadline } from '@/lib/profile-art-io';
import { decodeProfileArtImage, profileArtGenerationRequest } from '@/lib/profile-art-producer';

const origin = 'https://api.openai.com/v1';
const fileID = (v: unknown): v is string => typeof v === 'string' && /^file[-_][A-Za-z0-9_-]{1,120}$/.test(v);
const batchID = (v: unknown): v is string => typeof v === 'string' && /^batch_[A-Za-z0-9_-]{1,120}$/.test(v);
type BatchJob = ArtJob & {state: string; inputFileId: string | null; batchId: string | null; outputFileId?: string; errorFileId: string | null; payloadSHA: string | null};
type Batch = {id: string; status: string; endpoint: string; input_file_id: string; output_file_id?: string | null; error_file_id?: string | null; metadata: {cg_job_id?: string; cg_payload_sha?: string}};
export type ArtBatchRPC = (name: string, args: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;

export function createProfileArtBatch({apiKey, fetcher = fetch}: {apiKey?: string; fetcher?: typeof fetch} = {}) {
  async function request(path: string, init: RequestInit, parent: AbortSignal, maximum = 256_000): Promise<Uint8Array> {
    if (!apiKey?.trim()) throw new ArtPipelineError('provider_unavailable');
    return withArtDeadline(async signal => {
      const response = await fetcher(origin + path, {...init, redirect: 'error', cache: 'no-store', signal, headers: {...init.headers, Authorization: `Bearer ${apiKey}`}});
      if (init.method === 'DELETE' && response.status === 404) { void response.body?.cancel().catch(() => undefined); return new Uint8Array(); }
      if (!response.ok) { void response.body?.cancel().catch(() => undefined); throw new ArtPipelineError('batch_provider_failed'); }
      if (Number(response.headers.get('content-length') ?? 0) > maximum) { void response.body?.cancel().catch(() => undefined); throw new ArtPipelineError('body_too_large'); }
      return readArtStream(response.body, maximum, signal);
    }, parent, 20_000);
  }
  const json = async (path: string, init: RequestInit, signal: AbortSignal) => {
    const bytes = await request(path, init, signal);
    try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ArtPipelineError('batch_invalid'); }
  };
  const post = (body: unknown): RequestInit => ({method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  function matchingBatch(batch: Batch, job: BatchJob): boolean {
    return !!batch && batchID(batch.id) && batch.endpoint === '/v1/images/generations' && batch.input_file_id === job.inputFileId
      && batch.metadata?.cg_job_id === job.id && batch.metadata?.cg_payload_sha === job.payloadSHA;
  }
  async function command(rpc: ArtBatchRPC, action: string, signal: AbortSignal, job?: BatchJob, value = {}): Promise<BatchJob | null> {
    const result = await rpc('profile_art_batch_command', {p_action: action, p_job: job?.id ?? null, p_token: job?.token ?? null, p_value: value}, signal) as BatchJob | null;
    if (result && (!isArtUUID(result.id) || !isArtUUID(result.token) || (job && (result.id !== job.id || result.token !== job.token)))) throw new ArtPipelineError('batch_invalid_receipt');
    return result;
  }
  async function submit(rpc: ArtBatchRPC, job: BatchJob, signal: AbortSignal) {
    // A unique durable job is reserved BEFORE either POST. Lost outcomes stay
    // pending/unknown and are reconciled by metadata; no automatic paid retry.
    const line = JSON.stringify({custom_id: job.id, method: 'POST', url: '/v1/images/generations', body: profileArtGenerationRequest(job)}) + '\n';
    const sha = createHash('sha256').update(line).digest('hex');
    const form = new FormData(); form.set('purpose', 'batch');
    form.set('file', new Blob([line], {type: 'application/jsonl'}), `cg-art-${job.id}.jsonl`);
    // Bound unclaimed input-file retention if interrupted before its receipt.
    form.set('expires_after[anchor]', 'created_at'); form.set('expires_after[seconds]', '604800');
    const uploaded = await json('/files', {method: 'POST', body: form}, signal);
    if (!fileID(uploaded?.id)) throw new ArtPipelineError('batch_invalid');
    const stored = await command(rpc, 'input', signal, job, {fileId: uploaded.id, sha});
    if (!stored || stored.inputFileId !== uploaded.id || stored.payloadSHA !== sha || signal.aborted) throw new ArtPipelineError('batch_invalid_receipt');
    const batch = await json('/batches', post({input_file_id: uploaded.id, endpoint: '/v1/images/generations', completion_window: '24h', metadata: {cg_job_id: job.id, cg_payload_sha: sha}}), signal) as Batch;
    if (!matchingBatch(batch, stored)) throw new ArtPipelineError('batch_invalid');
    const submitted = await command(rpc, 'submitted', signal, stored, {batchId: batch.id});
    if (submitted?.batchId !== batch.id || submitted.state !== 'submitted') throw new ArtPipelineError('batch_invalid_receipt');
  }
  async function poll(rpc: ArtBatchRPC, job: BatchJob, signal: AbortSignal) {
    if (!job.batchId) {
      // Only recover the exact recorded input/hash. Inconclusive history never
      // authorizes another paid request. No private input or provider error logs.
      if (!fileID(job.inputFileId) || !isArtSHA(job.payloadSHA)) return 'unconfirmed';
      let after: string | undefined;
      for (let page = 0; page < 5; page++) {
        const list = await json('/batches?limit=100' + (after ? `&after=${after}` : ''), {}, signal);
        if (!Array.isArray(list?.data) || list.data.length > 100) throw new ArtPipelineError('batch_invalid');
        const matches = (list.data as Batch[]).filter(b => matchingBatch(b, job));
        if (matches.length > 1) throw new ArtPipelineError('batch_ambiguous');
        if (matches.length === 1) {
          await command(rpc, 'submitted', signal, job, {batchId: matches[0].id});
          return 'recovered';
        }
        if (!list.has_more) break;
        after = list.data.at(-1)?.id;
        if (!batchID(after)) throw new ArtPipelineError('batch_invalid');
      }
      return 'unconfirmed';
    }
    if (!batchID(job.batchId)) throw new ArtPipelineError('batch_invalid');
    const batch = await json(`/batches/${job.batchId}`, {}, signal) as Batch;
    if (!matchingBatch(batch, job) || batch.id !== job.batchId) throw new ArtPipelineError('batch_invalid');
    if (['completed','failed','expired','cancelled'].includes(batch.status)) {
      if (batch.output_file_id != null && !fileID(batch.output_file_id) || batch.error_file_id != null && !fileID(batch.error_file_id)) throw new ArtPipelineError('batch_invalid');
      await command(rpc, 'terminal', signal, job, {status: batch.status, outputFileId: batch.output_file_id ?? null, errorFileId: batch.error_file_id ?? null});
      return batch.output_file_id ? 'batch_ready' : 'batch_failed';
    }
    if (!['validating','in_progress','finalizing','cancelling'].includes(batch.status)) throw new ArtPipelineError('batch_invalid');
    return 'waiting';
  }
  async function produce(job: ArtJob, signal: AbortSignal): Promise<Uint8Array> {
    if (!isArtUUID(job.id) || !fileID(job.outputFileId)) throw new ArtPipelineError('batch_invalid');
    const expected = JSON.stringify({custom_id: job.id, method: 'POST', url: '/v1/images/generations', body: profileArtGenerationRequest(job)}) + '\n';
    if (job.generationSHA !== createHash('sha256').update(expected).digest('hex')) throw new ArtPipelineError('batch_prompt_changed');
    const bytes = await request(`/files/${job.outputFileId}/content`, {}, signal, POLICY.maxResponseBytes);
    const lines = new TextDecoder().decode(bytes).trim().split('\n');
    // Single-image batches avoid repeatedly downloading a large shared file.
    // Never trust output order or a remote image URL.
    if (lines.length !== 1) throw new ArtPipelineError('batch_invalid');
    let row;
    try { row = JSON.parse(lines[0]); } catch { throw new ArtPipelineError('batch_invalid'); }
    if (row?.custom_id !== job.id || row.error != null || row.response?.status_code !== 200) throw new ArtPipelineError('batch_image_failed');
    return decodeProfileArtImage(row.response.body);
  }
  async function advance(rpc: ArtBatchRPC, parent?: AbortSignal) {
    try {
      return await withArtDeadline(async signal => {
        const cleanup = await command(rpc, 'cleanup', signal);
        if (cleanup) {
          for (const id of new Set([cleanup.inputFileId, cleanup.outputFileId, cleanup.errorFileId].filter(id => id != null))) {
            if (!fileID(id)) throw new ArtPipelineError('batch_invalid');
            await request(`/files/${id}`, {method: 'DELETE'}, signal);
          }
          await command(rpc, 'cleaned', signal, cleanup);
          return {status: 'batch_cleaned' as const, inventoryReady: false as const};
        }
        const current = await command(rpc, 'poll', signal);
        const status = current ? await poll(rpc, current, signal) : 'idle';
        // Read/poll retries are harmless; submitting a new job is never a retry.
        const next = await command(rpc, 'begin', signal);
        if (next) { await submit(rpc, next, signal); return {status: 'batch_submitted' as const, inventoryReady: false as const}; }
        return {status, inventoryReady: false as const};
      }, parent, 70_000);
    } catch (error) {
      const code = error instanceof ArtPipelineError ? error.code : 'batch_failed';
      return {status: 'unconfirmed' as const, code, inventoryReady: false as const};
    }
  }
  return {advance, produce};
}
