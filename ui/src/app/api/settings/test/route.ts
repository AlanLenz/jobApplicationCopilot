import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { decryptUserData } from '@/lib/security';
import { buildUserAIConfig, getUserSettings, resolveAIConfig } from '@/lib/settings';
import { describeAIConfig, generateText } from '@/lib/ai/client';
import { aiErrorResponse } from '@/lib/ai/http';

/**
 * "Testar conexão" button. Sends a tiny prompt with the values currently typed in the
 * settings form (not necessarily saved yet). Without a body it tests the saved config.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const settings = await getUserSettings(user.id);

    const providerId = body?.providerId ? String(body.providerId) : null;
    // An empty key field means "keep using the key saved for this same provider".
    const savedKey =
      providerId && settings?.aiProvider === providerId
        ? decryptUserData(settings.encryptedAiApiKey, user.id) || undefined
        : undefined;

    const config = providerId
      ? buildUserAIConfig({ providerId, model: body.model, baseUrl: body.baseUrl, apiKey: body.apiKey || savedKey })
      : resolveAIConfig(user, settings);

    const startedAt = Date.now();
    const reply = await generateText(config, {
      prompt: 'Responda apenas com a palavra OK.',
      maxOutputTokens: 1024,
    });

    return NextResponse.json({
      success: true,
      provider: config ? describeAIConfig(config) : null,
      latencyMs: Date.now() - startedAt,
      reply: reply.trim().slice(0, 200),
    });
  } catch (error) {
    return aiErrorResponse(error, 'Falha ao testar a conexão com o provedor de IA.');
  }
}
