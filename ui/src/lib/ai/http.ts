import { NextResponse } from 'next/server';
import { AIConfigError, AIRequestError } from './client';

/**
 * Maps AI failures to JSON responses the dashboard understands:
 *   code "AI_NOT_CONFIGURED" -> the UI offers a shortcut to the "Configurações" tab
 *   code "AI_REQUEST_FAILED" -> provider error (bad key, unknown model, rate limit...)
 */
export function aiErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof AIConfigError) {
    return NextResponse.json({ error: error.message, code: 'AI_NOT_CONFIGURED' }, { status: 400 });
  }
  if (error instanceof AIRequestError) {
    const status = error.status === 429 ? 429 : 502;
    return NextResponse.json({ error: error.message, code: 'AI_REQUEST_FAILED' }, { status });
  }
  const message = error instanceof Error && error.message ? error.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 500 });
}
