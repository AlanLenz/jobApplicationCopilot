import { prisma } from '@/lib/prisma';
import { decryptUserData, encryptUserData } from '@/lib/security';

export type DocumentType = 'resume' | 'cover_letter';

export interface StoredDocument {
  text: string;
  html: string;
  atsScore?: number;
  matchedKeywords?: string[];
}

/**
 * Tailored resumes and cover letters are cached per user and job, encrypted with the
 * user's AES-256-GCM key. This replaces the old generated/ folder, which kept every
 * document as plaintext .txt/.html files on disk.
 */
export async function saveGeneratedDocument(
  userId: string,
  jobId: string,
  type: DocumentType,
  doc: StoredDocument
): Promise<void> {
  const encryptedPayload = encryptUserData(JSON.stringify(doc), userId);
  await prisma.generatedDocument.upsert({
    where: { userId_jobId_type: { userId, jobId, type } },
    update: { encryptedPayload },
    create: { userId, jobId, type, encryptedPayload },
  });
}

export async function getGeneratedDocument(
  userId: string,
  jobId: string,
  type: DocumentType
): Promise<StoredDocument | null> {
  const record = await prisma.generatedDocument.findUnique({
    where: { userId_jobId_type: { userId, jobId, type } },
  });
  return decryptDocument(record?.encryptedPayload, userId);
}

export function decryptDocument(payload: string | null | undefined, userId: string): StoredDocument | null {
  const decrypted = decryptUserData(payload, userId);
  if (!decrypted) return null;
  try {
    return JSON.parse(decrypted) as StoredDocument;
  } catch {
    return { text: decrypted, html: `<pre>${escapeHtml(decrypted)}</pre>` };
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
