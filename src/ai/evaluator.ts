// CLI job evaluator: scores every pending job with the configured AI provider.
//
// The dashboard has the same feature ("Avaliar com IA" button, criteria editable in
// "Configurações"); this script is for headless/cron usage. It reuses the provider-agnostic
// client and prompts from the web app, so it works with any LLM:
//
//   AI_PROVIDER=anthropic AI_MODEL=claude-opus-5-5 ANTHROPIC_API_KEY=... npm run evaluate
//   AI_PROVIDER=ollama AI_MODEL=llama3.1 npm run evaluate
//   GEMINI_API_KEY=... npm run evaluate          # original behavior (Gemini)
//
// Optional:
//   EVALUATION_CRITERIA            free-text mandatory criteria (location, visa, company type...)
//   EVALUATION_MIN_SCORE           jobs scoring at or below this are marked rejected (default 80)
//   EVALUATION_REQUIRED_KEYWORDS   comma-separated cheap pre-filter; a job must mention at least
//                                  one of them or it is rejected without calling the LLM
//
// Requires the web app dependencies (cd ui && npm install), where the AI SDKs live.

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { aiConfigFromEnv, describeAIConfig, generateJSON, validateAIConfig } from '../../ui/src/lib/ai/client';
import {
  JOB_EVALUATION_SCHEMA,
  JobEvaluation,
  buildJobEvaluationPrompt,
  buildJobEvaluationSystemPrompt,
} from '../../ui/src/lib/ai/prompts';

dotenv.config();

const prisma = new PrismaClient();

// Read the user's resume
const resumePath = path.join(process.cwd(), 'resume.txt');
let resumeContent = 'No resume provided.';
if (fs.existsSync(resumePath)) {
  resumeContent = fs.readFileSync(resumePath, 'utf-8');
} else {
  console.warn('⚠️ No resume.txt found! The AI will not have your personal context.');
}

const criteria = process.env.EVALUATION_CRITERIA || '';
const minScore = Number(process.env.EVALUATION_MIN_SCORE ?? 80);
const requiredKeywords = (process.env.EVALUATION_REQUIRED_KEYWORDS || '')
  .split(',')
  .map((k) => k.trim().toLowerCase())
  .filter(Boolean);

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function evaluatePendingJobs() {
  const aiConfig = aiConfigFromEnv();
  const problem = validateAIConfig(aiConfig);
  if (problem || !aiConfig) {
    console.error(`❌ ${problem} (set AI_PROVIDER / AI_MODEL / AI_API_KEY in .env)`);
    process.exitCode = 1;
    return;
  }
  console.log(`Using ${describeAIConfig(aiConfig)}`);

  const system = buildJobEvaluationSystemPrompt(resumeContent, criteria);
  const pendingJobs = await prisma.job.findMany({
    where: { status: 'pending_evaluation' },
  });

  console.log(`Found ${pendingJobs.length} jobs pending evaluation.`);

  for (const job of pendingJobs) {
    console.log(`Evaluating job: ${job.title} at ${job.company}`);

    // PRE-FILTER: saves API calls when the user listed keywords a job must mention.
    if (requiredKeywords.length > 0) {
      const textToSearch = `${job.title} ${job.description} ${job.requirements || ''}`.toLowerCase();
      if (!requiredKeywords.some((keyword) => textToSearch.includes(keyword))) {
        console.log(`Pre-filter Rejected: mentions none of ${requiredKeywords.join(', ')}.`);
        await prisma.job.update({
          where: { id: job.id },
          data: {
            matchScore: 0,
            matchReason: `Failed fast pre-filter: does not mention any of ${requiredKeywords.join(', ')}.`,
            status: 'rejected',
          },
        });
        continue; // Skip the LLM call entirely
      }
    }

    try {
      // The client already retries rate limits / transient 5xx errors.
      const result = await generateJSON<JobEvaluation>(aiConfig, {
        system,
        prompt: buildJobEvaluationPrompt(job),
        schema: JOB_EVALUATION_SCHEMA,
        maxOutputTokens: 4000,
      });
      console.log(`Score: ${result.match_score} - ${result.reason}`);

      await prisma.job.update({
        where: { id: job.id },
        data: {
          matchScore: result.match_score,
          matchReason: result.reason,
          status: result.match_score > minScore ? 'approved' : 'rejected',
        },
      });
    } catch (e) {
      console.error(`Failed to evaluate job ${job.id}:`, e instanceof Error ? e.message : e);
    }

    // Polite delay between evaluations to avoid triggering rate limits
    await delay(Number(process.env.EVALUATION_DELAY_MS ?? 4000));
  }

  await prisma.$disconnect();
}

evaluatePendingJobs().catch(console.error);
