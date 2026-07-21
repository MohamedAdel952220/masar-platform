/**
 * STORAGE (FRONTEND_ARCHITECTURE.md §16).
 *
 * IMPORTANT — uploads are intentionally NOT implemented in Phase 1. The
 * backend's §22.1 upload-lifecycle subsystem (storage_objects, finalize_upload,
 * orphan cleanup) does not exist (BACKEND_CERTIFICATION.md §7.3). The frontend
 * must NOT invent a client-side path convention to work around that, because
 * doing so would place tenant isolation in client code.
 *
 * Phase 1 therefore ships read-only signed-URL access for objects the backend
 * already produces (invoice PDFs, exported reports). Upload helpers land once
 * the backend subsystem does.
 */
import { getSupabaseClient } from '../client';
import { parseBackendError } from '../errors';

export const BUCKETS = [
  'public-branding',
  'profile-photos',
  'identity-documents',
  'academic-attachments',
  'payment-receipts',
  'chat-attachments',
  'generated-documents',
] as const;
export type BucketName = (typeof BUCKETS)[number];

/** Signed-URL TTLs in seconds, per BACKEND_ARCHITECTURE.md §21. */
export const SIGNED_URL_TTL: Record<BucketName, number> = {
  'public-branding': 3600,
  'profile-photos': 3600,
  'identity-documents': 300,
  'academic-attachments': 3600,
  'payment-receipts': 3600,
  'chat-attachments': 3600,
  'generated-documents': 86400,
};

/** Creates a short-lived signed URL for an existing object. */
export async function createSignedUrl(bucket: BucketName, path: string, expiresIn?: number): Promise<string> {
  const ttl = expiresIn ?? SIGNED_URL_TTL[bucket];
  const { data, error } = await getSupabaseClient().storage.from(bucket).createSignedUrl(path, ttl);
  if (error) throw parseBackendError(error);
  return data.signedUrl;
}
