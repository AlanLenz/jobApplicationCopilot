import { GoogleGenAI } from '@google/genai';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const prisma = new PrismaClient();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Read the user's resume
const resumePath = path.join(process.cwd(), 'resume.txt');
let resumeContent = 'No resume provided.';
if (fs.existsSync(resumePath)) {
  resumeContent = fs.readFileSync(resumePath, 'utf-8');
} else {
  console.warn('⚠️ No resume.txt found! The AI will not have your personal context.');
}

const SYSTEM_PROMPT = `
You are an expert technical recruiter and career coach.
Your job is to evaluate job descriptions against a candidate's profile and decide if they should apply.

Candidate Profile / Resume:
${resumeContent}

Strict Geographic & Visa Constraints (CRITICAL):
1. If the job is located in Cascavel, Brazil: It is ACCEPTABLE (both remote and on-site are fine).
2. If the job is located anywhere else in Brazil (outside Cascavel): It MUST be explicitly "Remote" to be acceptable.
3. If a job violates ANY of the above conditions, you must reject it (score it 0) and state the location constraint violation in the reason.

Evaluate the provided job description and return a structured JSON response with:
- "match_score": an integer from 0 to 100 representing how good of a fit this job is.
- "reason": a short explanation for the score.
- "custom_cover_letter": a tailored cover letter draft if the score is > 80. Otherwise, it can be null.
`;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function evaluatePendingJobs() {
  const pendingJobs = await prisma.job.findMany({
    where: { status: 'pending_evaluation' }
  });

  console.log(`Found ${pendingJobs.length} jobs pending evaluation.`);

  for (const job of pendingJobs) {
    console.log(`Evaluating job: ${job.title} at ${job.company}`);
    
    // PRE-FILTER: To save API calls and avoid rate limits, we use a regex to verify
    // that the job has at least one keyword required by our strict constraints.
    // Acceptable jobs MUST contain "Cascavel", "Remote" (or "Remoto"), or "Visa"/"Sponsor".
    const textToSearch = `${job.title} ${job.description} ${job.requirements || ''}`.toLowerCase();
    
    const hasCascavel = textToSearch.includes('cascavel');
    const hasRemote = textToSearch.includes('remote') || textToSearch.includes('remoto');
    const hasVisa = textToSearch.includes('visa') || textToSearch.includes('sponsor');

    if (!hasCascavel && !hasRemote && !hasVisa) {
        console.log(`Pre-filter Rejected: Missing 'Cascavel', 'Remote', or 'Visa/Sponsor'.`);
        await prisma.job.update({
            where: { id: job.id },
            data: {
                matchScore: 0,
                matchReason: 'Failed fast pre-filter: Does not mention Cascavel, Remote, or Visa Sponsorship.',
                status: 'rejected'
            }
        });
        continue; // Skip the LLM call entirely
    }

    const prompt = `
    Job Title: ${job.title}
    Company: ${job.company}
    Description: ${job.description}
    Requirements: ${job.requirements || 'N/A'}
    `;

    let retries = 3;
    let success = false;

    while (retries > 0 && !success) {
      try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_PROMPT,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'object',
                    properties: {
                        match_score: { type: 'integer' },
                        reason: { type: 'string' },
                        custom_cover_letter: { type: 'string', nullable: true }
                    },
                    required: ['match_score', 'reason']
                }
            }
        });

        if (response.text) {
            const result = JSON.parse(response.text);
            console.log(`Score: ${result.match_score} - ${result.reason}`);
            
            const isHighMatch = result.match_score > 80;

            await prisma.job.update({
                where: { id: job.id },
                data: {
                    matchScore: result.match_score,
                    matchReason: result.reason,
                    customCoverLetter: result.custom_cover_letter,
                    status: isHighMatch ? 'approved' : 'rejected'
                }
            });
            success = true;
        }
      } catch (e: any) {
        if (e.status === 503 || e.status === 429 || e.status >= 500) {
            const waitTime = (4 - retries) * 15000; // 15s, 30s, 45s
            console.log(`API overloaded (Status: ${e.status}). Retrying in ${waitTime/1000}s... (${retries - 1} retries left)`);
            await delay(waitTime);
            retries--;
        } else {
            console.error(`Failed to evaluate job ${job.id}:`, e);
            break; // Stop retrying for non-temporary errors
        }
      }
    }
    
    // Add a polite 4-second delay between successful evaluations to avoid triggering rate limits
    if (success) await delay(4000);
  }

  await prisma.$disconnect();
}

evaluatePendingJobs().catch(console.error);

