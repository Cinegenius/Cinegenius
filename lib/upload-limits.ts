// Vercel Functions reject request bodies above 4.5 MB. Keep the uploaded
// file at 4 MB so multipart framing stays safely below the platform limit.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
