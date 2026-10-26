import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { decryptUserData, encryptUserData } from '@/lib/security';
import { resolveAIConfigForUser } from '@/lib/settings';
import { getGeneratedDocument, saveGeneratedDocument, escapeHtml, DocumentType } from '@/lib/documents';
import { AIConfig, generateJSON } from '@/lib/ai/client';
import { aiErrorResponse } from '@/lib/ai/http';
import {
  COVER_LETTER_SCHEMA,
  CoverLetter,
  JobForPrompt,
  TAILORED_RESUME_SCHEMA,
  TailoredResume,
  buildCoverLetterPrompt,
  buildTailoredResumePrompt,
} from '@/lib/ai/prompts';

const MIN_PROFILE_LENGTH = 20;

function isDocumentType(value: unknown): value is DocumentType {
  return value === 'resume' || value === 'cover_letter';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const type = searchParams.get('type');

    if (!jobId || !isDocumentType(type)) {
      return NextResponse.json({ error: 'jobId and type (resume | cover_letter) are required' }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    const doc = await getGeneratedDocument(user.id, jobId, type);
    if (!doc) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    return NextResponse.json({ found: true, ...doc });
  } catch (error: any) {
    console.error('Failed to get generated document:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jobId, type, regenerate = false } = body;

    if (!jobId || !isDocumentType(type)) {
      return NextResponse.json({ error: 'Valid jobId and type (resume | cover_letter) required' }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Faça login para gerar documentos personalizados com o seu perfil.', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Check cache first unless explicitly regenerating
    if (!regenerate) {
      const existing = await getGeneratedDocument(user.id, jobId, type);
      if (existing) {
        return NextResponse.json({ success: true, cached: true, jobId, type, ...existing });
      }
    }

    // Fetch Job details (either from Job inbox or user's AppliedJob history)
    let job: (JobForPrompt & { url: string }) | null = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      const applied = await prisma.appliedJob.findFirst({
        where: { userId: user.id, OR: [{ id: jobId }, { jobId }] },
      });
      if (applied) {
        job = {
          title: applied.title,
          company: applied.company,
          url: applied.url,
          description: applied.description || '',
          requirements: null,
        };
      }
    }

    if (!job) {
      return NextResponse.json({ error: `Vaga não encontrada (${jobId})` }, { status: 404 });
    }

    // Generation is grounded on the user's own encrypted profile. The old fallback to a
    // local resume.txt / resume.example.txt silently produced documents for "John Doe".
    const masterResume = decryptUserData(user.encryptedResume, user.id) || '';
    if (masterResume.trim().length < MIN_PROFILE_LENGTH) {
      return NextResponse.json(
        {
          error: 'Envie seu currículo ou PDF do LinkedIn na aba "Meu Perfil" antes de gerar documentos.',
          code: 'PROFILE_REQUIRED',
        },
        { status: 400 }
      );
    }
    const profileSource = user.resumeSource || 'Perfil Criptografado do Usuário';

    const aiConfig = await resolveAIConfigForUser(user);

    if (type === 'resume') {
      const resume = await generateTailoredResume(aiConfig, job, masterResume);
      const doc = {
        text: resume.plainText,
        html: resume.html,
        atsScore: resume.atsScore,
        matchedKeywords: resume.matchedKeywords,
      };
      await saveGeneratedDocument(user.id, jobId, 'resume', doc);

      // Update encrypted document on AppliedJob if user already applied
      await prisma.appliedJob
        .updateMany({
          where: { userId: user.id, OR: [{ jobId }, { url: job.url }] },
          data: {
            encryptedCustomResume: encryptUserData(JSON.stringify(doc), user.id),
            atsScore: resume.atsScore,
          },
        })
        .catch(() => {});

      return NextResponse.json({ success: true, cached: false, jobId, type, profileSource, ...doc });
    }

    const coverLetter = await generateCoverLetter(aiConfig, job, masterResume);
    const doc = { text: coverLetter.plainText, html: coverLetter.html };
    await saveGeneratedDocument(user.id, jobId, 'cover_letter', doc);

    await prisma.appliedJob
      .updateMany({
        where: { userId: user.id, OR: [{ jobId }, { url: job.url }] },
        data: { encryptedCoverLetter: encryptUserData(JSON.stringify(doc), user.id) },
      })
      .catch(() => {});

    return NextResponse.json({ success: true, cached: false, jobId, type, profileSource, ...doc });
  } catch (error) {
    console.error('Error generating document:', error);
    return aiErrorResponse(error, 'Falha ao gerar o documento.');
  }
}

async function generateTailoredResume(
  config: AIConfig | null,
  job: JobForPrompt,
  masterResume: string
): Promise<TailoredResume> {
  const parsed = await generateJSON<Partial<TailoredResume>>(config, {
    prompt: buildTailoredResumePrompt(job, masterResume),
    schema: TAILORED_RESUME_SCHEMA,
  });
  const plainText = parsed.plainText || '';
  return {
    atsScore: clampScore(parsed.atsScore),
    matchedKeywords: Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords.map(String) : [],
    plainText,
    html: parsed.html || `<pre>${escapeHtml(plainText)}</pre>`,
  };
}

async function generateCoverLetter(
  config: AIConfig | null,
  job: JobForPrompt,
  masterResume: string
): Promise<CoverLetter> {
  const parsed = await generateJSON<Partial<CoverLetter>>(config, {
    prompt: buildCoverLetterPrompt(job, masterResume),
    schema: COVER_LETTER_SCHEMA,
  });
  const plainText = parsed.plainText || '';
  return {
    plainText,
    html: parsed.html || `<pre>${escapeHtml(plainText)}</pre>`,
  };
}

function clampScore(value: unknown): number {
  const n = Number(value);
  // The previous implementation defaulted a missing score to 90, overstating the match.
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0;
}
