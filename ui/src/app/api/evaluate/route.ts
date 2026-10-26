import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { decryptUserData } from '@/lib/security';
import { getUserSettings, resolveAIConfig, toSettingsView } from '@/lib/settings';
import { AIConfigError, generateJSON } from '@/lib/ai/client';
import { aiErrorResponse } from '@/lib/ai/http';
import {
  JOB_EVALUATION_SCHEMA,
  JobEvaluation,
  buildJobEvaluationPrompt,
  buildJobEvaluationSystemPrompt,
} from '@/lib/ai/prompts';

const DEFAULT_BATCH_SIZE = 5;
const MAX_BATCH_SIZE = 20;

/**
 * Scores pending jobs (0-100) against the user's encrypted profile and the criteria
 * written in "Configurações → Avaliação de vagas". Processes a small batch per call so
 * the dashboard can show progress and requests stay short; call again while `remaining > 0`.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Faça login para avaliar vagas com o seu perfil.', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const batchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, Number(body?.limit) || DEFAULT_BATCH_SIZE));

    const profile = decryptUserData(user.encryptedResume, user.id) || '';
    if (profile.trim().length < 20) {
      return NextResponse.json(
        { error: 'Envie seu currículo na aba "Meu Perfil" antes de avaliar vagas.', code: 'PROFILE_REQUIRED' },
        { status: 400 }
      );
    }

    const settings = await getUserSettings(user.id);
    const { evaluation } = toSettingsView(user, settings);
    const aiConfig = resolveAIConfig(user, settings);
    const system = buildJobEvaluationSystemPrompt(profile, evaluation.criteria);

    const pendingWhere = { status: 'pending_evaluation', matchScore: null };
    const jobs = await prisma.job.findMany({
      where: pendingWhere,
      orderBy: { createdAt: 'desc' },
      take: batchSize,
    });

    const evaluated: { id: string; matchScore: number; matchReason: string; discarded: boolean }[] = [];
    const failures: { id: string; error: string }[] = [];

    for (const job of jobs) {
      try {
        const result = await generateJSON<JobEvaluation>(aiConfig, {
          system,
          prompt: buildJobEvaluationPrompt(job),
          schema: JOB_EVALUATION_SCHEMA,
          maxOutputTokens: 4000,
        });

        const matchScore = Math.min(100, Math.max(0, Math.round(Number(result.match_score) || 0)));
        const matchReason = String(result.reason || '').slice(0, 1000);
        const discarded = evaluation.autoDiscardBelowMin && matchScore < evaluation.minScore;

        if (discarded) {
          // Same policy as the "Recusar" button: rejected jobs are not kept.
          await prisma.job.delete({ where: { id: job.id } }).catch(() => {});
        } else {
          await prisma.job.update({ where: { id: job.id }, data: { matchScore, matchReason } });
        }
        evaluated.push({ id: job.id, matchScore, matchReason, discarded });
      } catch (error) {
        // A configuration problem affects every job, so stop and report it right away.
        if (error instanceof AIConfigError || evaluated.length === 0) throw error;
        failures.push({ id: job.id, error: error instanceof Error ? error.message : String(error) });
        break;
      }
    }

    const remaining = await prisma.job.count({ where: pendingWhere });

    return NextResponse.json({
      success: true,
      evaluated,
      failures,
      remaining,
      minScore: evaluation.minScore,
    });
  } catch (error) {
    console.error('Evaluate POST error:', error);
    return aiErrorResponse(error, 'Falha ao avaliar vagas.');
  }
}
