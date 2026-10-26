// Prompts and output schemas for every AI task, kept in one place so they work the same
// regardless of which provider/model is configured. No "@/..." imports: the root CLI
// evaluator reuses buildJobEvaluationPrompt.

import type { JSONSchema } from './client';

export interface JobForPrompt {
  title: string;
  company: string | null;
  description: string;
  requirements?: string | null;
}

// ---------------------------------------------------------------------------
// Profile extraction (resume / LinkedIn export)
// ---------------------------------------------------------------------------

export function buildProfileExtractionPrompt(isLinkedInExport: boolean, extractedText?: string): string {
  const source = isLinkedInExport ? 'LinkedIn PDF export' : 'Resume / CV document';
  const fields = isLinkedInExport
    ? 'Full Name, Headline, Contact Info, Location, Summary/About, All Work Experiences (Company, Role, Dates, Location, Full Description & Achievements), Education, Certifications, Technical Skills, and Languages'
    : 'Full Name, Contact Info, Links (LinkedIn, GitHub, Portfolio), Professional Summary, All Work Experiences (Company, Role, Dates, Bullet points & Metrics), Education, Technical Skills, Certifications, Projects, and Languages';

  const input = extractedText
    ? `Below is the raw text extracted from a ${source}. Its layout may be broken (columns merged, headers and footers repeated, words split across lines).\n\n<raw_text>\n${extractedText}\n</raw_text>\n\nRebuild`
    : `Extract`;

  return `${input} the complete professional profile from this ${source}.
Preserve ALL details faithfully: ${fields}.
Do not invent or omit any information. Return clean, well-structured plain text / markdown suitable as a Master Resume Profile.`;
}

// ---------------------------------------------------------------------------
// Tailored ATS resume
// ---------------------------------------------------------------------------

export interface TailoredResume {
  atsScore: number;
  matchedKeywords: string[];
  plainText: string;
  html: string;
}

export const TAILORED_RESUME_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    atsScore: { type: 'integer', description: 'Estimated ATS match score from 0 to 100' },
    matchedKeywords: { type: 'array', items: { type: 'string' } },
    plainText: { type: 'string', description: 'Single-column plain text resume' },
    html: { type: 'string', description: 'Complete, self-contained HTML document styled for A4 printing' },
  },
  required: ['atsScore', 'matchedKeywords', 'plainText', 'html'],
};

export function buildTailoredResumePrompt(job: JobForPrompt, masterResume: string): string {
  return `
You are an elite Technical Resume Optimizer & ATS Specialist.
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
2. Detect the language of the Job Description (Portuguese or English) and write the tailored resume in the SAME language as the job posting (unless the job explicitly asks for English).
3. Optimize the Professional Summary to directly speak to the target role's core mission and tech stack.
4. Align Technical Skills with the exact terminology in the job description (e.g. if Vue.js, Spring Boot, TypeScript, Docker are required, emphasize them explicitly).
5. Frame the bullet points of past experience to highlight relevant achievements, quantified metrics, and tools mentioned in the job description.
6. Provide a single-column plain text format AND an elegant, clean HTML template formatted for A4 print.

Return a JSON object with: atsScore (0-100), matchedKeywords (string[]), plainText (string), html (string).
`;
}

// ---------------------------------------------------------------------------
// Cover letter
// ---------------------------------------------------------------------------

export interface CoverLetter {
  plainText: string;
  html: string;
}

export const COVER_LETTER_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    plainText: { type: 'string' },
    html: { type: 'string', description: 'Complete, self-contained printable HTML document' },
  },
  required: ['plainText', 'html'],
};

export function buildCoverLetterPrompt(job: JobForPrompt, masterResume: string): string {
  return `
You are a professional Career Coach & Cover Letter Specialist.
Write a targeted, highly persuasive cover letter for this candidate and target job.

Candidate Profile / Resume:
${masterResume}

Target Job:
Role: ${job.title}
Company: ${job.company || 'Hiring Team'}
Description:
${job.description}

Cover Letter Structure Guidelines:
1. Detect the language of the Job Description (Portuguese or English) and write the cover letter in the SAME language as the job posting.
2. Length: 250-380 words (3-4 focused paragraphs).
3. Opening Hook: 2-3 sentences. Start with company knowledge or their specific technical challenge/value stream. Avoid generic openers.
4. Body Paragraph 1 (Core Match): Connect the candidate's strongest relevant experience, project metrics, and technical expertise from the master resume.
5. Body Paragraph 2 (Value Add & Mindset): Highlight problem-solving ownership, stakeholder collaboration, and modern development workflows.
6. Closing Paragraph: Enthusiastic call to action, referencing relevant communication strengths and eagerness to contribute.
7. Provide clean plain text (with date and contact info) AND clean, printable HTML.

Return a JSON object with: plainText (string), html (string).
`;
}

// ---------------------------------------------------------------------------
// Job evaluation (match score)
// ---------------------------------------------------------------------------

export interface JobEvaluation {
  match_score: number;
  reason: string;
}

export const JOB_EVALUATION_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    match_score: { type: 'integer', description: 'Fit between 0 and 100' },
    reason: { type: 'string', description: 'Short explanation (1-3 sentences) in the language of the job posting' },
  },
  required: ['match_score', 'reason'],
};

export function buildJobEvaluationSystemPrompt(candidateProfile: string, criteria: string): string {
  const constraints = criteria.trim()
    ? `
Candidate's Mandatory Criteria (CRITICAL):
${criteria.trim()}

If the job clearly violates ANY of the mandatory criteria above, score it 0 and state which criterion was violated in the reason.`
    : '';

  return `
You are an expert technical recruiter and career coach.
Your job is to evaluate job descriptions against a candidate's profile and decide if they should apply.

Candidate Profile / Resume:
${candidateProfile || 'No resume provided.'}
${constraints}

Evaluate the provided job description and return a JSON object with:
- "match_score": an integer from 0 to 100 representing how good of a fit this job is.
- "reason": a short explanation for the score.
`;
}

export function buildJobEvaluationPrompt(job: JobForPrompt): string {
  return `
Job Title: ${job.title}
Company: ${job.company || 'N/A'}
Description: ${job.description}
Requirements: ${job.requirements || 'N/A'}
`;
}
