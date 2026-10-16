import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';
import {
  saveGeneratedDocument,
  getGeneratedDocument,
  getMasterResume,
} from '@/lib/storage';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const type = searchParams.get('type') as 'resume' | 'cover_letter' | null;

    if (!jobId || !type) {
      return NextResponse.json({ error: 'jobId and type (resume | cover_letter) are required' }, { status: 400 });
    }

    const doc = getGeneratedDocument(jobId, type);
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

    if (!jobId || !type || !['resume', 'cover_letter'].includes(type)) {
      return NextResponse.json({ error: 'Valid jobId and type (resume | cover_letter) required' }, { status: 400 });
    }

    // Check disk cache first unless explicitly regenerating
    if (!regenerate) {
      const existing = getGeneratedDocument(jobId, type);
      if (existing) {
        return NextResponse.json({
          success: true,
          cached: true,
          jobId,
          type,
          ...existing,
        });
      }
    }

    // Fetch Job details
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: `Job with ID ${jobId} not found` }, { status: 404 });
    }

    const masterResume = getMasterResume();

    if (type === 'resume') {
      const resumeResult = await generateTailoredResume(job, masterResume);
      
      saveGeneratedDocument(jobId, 'resume', resumeResult.plainText, resumeResult.html);

      // Attempt DB update if field exists
      try {
        await (prisma.job as any).update({
          where: { id: jobId },
          data: { customResume: resumeResult.plainText },
        });
      } catch (dbErr) {
        // Ignored if column isn't migrated in DB yet
      }

      return NextResponse.json({
        success: true,
        cached: false,
        jobId,
        type: 'resume',
        text: resumeResult.plainText,
        html: resumeResult.html,
        atsScore: resumeResult.atsScore,
        matchedKeywords: resumeResult.matchedKeywords,
      });
    }

    if (type === 'cover_letter') {
      const coverLetterResult = await generateCoverLetter(job, masterResume);

      saveGeneratedDocument(jobId, 'cover_letter', coverLetterResult.plainText, coverLetterResult.html);

      // Update in DB
      try {
        await prisma.job.update({
          where: { id: jobId },
          data: { customCoverLetter: coverLetterResult.plainText },
        });
      } catch (dbErr) {
        console.warn('DB update for customCoverLetter skipped:', dbErr);
      }

      return NextResponse.json({
        success: true,
        cached: false,
        jobId,
        type: 'cover_letter',
        text: coverLetterResult.plainText,
        html: coverLetterResult.html,
      });
    }

    return NextResponse.json({ error: 'Unsupported type' }, { status: 400 });
  } catch (error: any) {
    console.error('Error generating document:', error);
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
  }
}

async function generateTailoredResume(job: any, masterResume: string) {
  const prompt = `
You are an elite Technical Resume Optimizer & ATS Specialist adhering to the resume-ats-optimizer skill.
Tailor the candidate's master resume to maximize ATS match score and impress human hiring managers for the following job description.

Candidate Master Profile / Resume:
${masterResume}

Target Job Title: ${job.title}
Target Company: ${job.company || 'Confidential'}
Job Description & Requirements:
${job.description}
${job.requirements ? `Requirements: ${job.requirements}` : ''}

Strict Rules:
1. Do NOT fabricate experience, dates, or degrees. Maintain all verified roles, achievements, and degrees as provided in the master resume.
2. Optimize the Professional Summary to directly speak to the target role's core mission and tech stack.
3. Align Technical Skills with the exact terminology in the job description (e.g. if Vue.js, Spring Boot, TypeScript, Docker are required, emphasize them explicitly).
4. Frame the bullet points of past experience to highlight relevant achievements, quantified metrics, and tools mentioned in the job description.
5. Standardize all headers into English (PROFESSIONAL SUMMARY, TECHNICAL SKILLS, PROFESSIONAL EXPERIENCE, EDUCATION, CERTIFICATIONS, LANGUAGES).
6. Provide a single-column plain text format AND an elegant, clean HTML template formatted for A4 print.

Return a valid JSON object matching this schema:
{
  "atsScore": number (0-100),
  "matchedKeywords": string[],
  "plainText": string,
  "html": string
}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          atsScore: { type: 'integer' },
          matchedKeywords: { type: 'array', items: { type: 'string' } },
          plainText: { type: 'string' },
          html: { type: 'string' },
        },
        required: ['atsScore', 'matchedKeywords', 'plainText', 'html'],
      },
    },
  });

  const parsed = JSON.parse(response.text || '{}');
  return {
    atsScore: parsed.atsScore || 90,
    matchedKeywords: parsed.matchedKeywords || [],
    plainText: parsed.plainText || '',
    html: parsed.html || `<pre>${parsed.plainText}</pre>`,
  };
}

async function generateCoverLetter(job: any, masterResume: string) {
  const prompt = `
You are a professional Career Coach & Cover Letter Specialist adhering to the cover-letter-generator skill.
Write a targeted, highly persuasive cover letter for this candidate and target job.

Candidate Profile / Resume:
${masterResume}

Target Job:
Role: ${job.title}
Company: ${job.company || 'Hiring Team'}
Description:
${job.description}

Cover Letter Structure Guidelines:
1. Length: 250-380 words (3-4 focused paragraphs).
2. Opening Hook: 2-3 sentences. Start with company knowledge or their specific technical challenge/value stream. Avoid generic openers like "I am writing to apply...".
3. Body Paragraph 1 (Core Match): Connect the candidate's strongest relevant experience, project metrics, and technical expertise from the master resume.
4. Body Paragraph 2 (Value Add & Mindset): Highlight problem-solving ownership, stakeholder collaboration, and modern development workflows.
5. Closing Paragraph: Enthusiastic call to action, referencing relevant communication strengths and eagerness to contribute.
6. Provide clean plain text (with date and addresses) AND clean, printable HTML.

Return a valid JSON object matching this schema:
{
  "plainText": string,
  "html": string
}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          plainText: { type: 'string' },
          html: { type: 'string' },
        },
        required: ['plainText', 'html'],
      },
    },
  });

  const parsed = JSON.parse(response.text || '{}');
  return {
    plainText: parsed.plainText || '',
    html: parsed.html || `<pre>${parsed.plainText}</pre>`,
  };
}
