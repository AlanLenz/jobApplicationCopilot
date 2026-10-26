// Provider-agnostic LLM client.
//
// Every AI feature in the app (PDF profile extraction, ATS resume, cover letter, job
// evaluation) goes through generateJSON / generateText below, so swapping models is a
// configuration change, never a code change.
//
// This module intentionally has no "@/..." imports and no database access, so the CLI
// scripts in the repository root (src/ai/evaluator.ts) can import it too.

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { AIProtocol, getProviderPreset } from './providers';

export interface AIConfig {
  providerId: string;
  protocol: AIProtocol;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  /** Where this configuration came from, shown in the settings screen. */
  source: 'user' | 'env';
}

/** Minimal JSON Schema subset used by our prompts (portable across providers). */
export type JSONSchema = {
  type: 'object' | 'array' | 'string' | 'integer' | 'number' | 'boolean';
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  description?: string;
};

export interface GenerateOptions {
  system?: string;
  prompt: string;
  /** Raw PDF (base64). Only providers with supportsPdf can read it. */
  pdfBase64?: string;
  maxOutputTokens?: number;
}

export interface GenerateJSONOptions extends GenerateOptions {
  schema: JSONSchema;
}

/** Misconfiguration the user can fix in the settings screen. */
export class AIConfigError extends Error {}

/** Provider call failed. `message` is already user-friendly (pt-BR). */
export class AIRequestError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

const DEFAULT_MAX_OUTPUT_TOKENS = 32000;

/**
 * Reads the server-wide AI configuration from environment variables.
 *
 *   AI_PROVIDER  provider id from providers.ts (gemini, anthropic, openai, openrouter, ollama, custom...)
 *   AI_MODEL     model name for that provider
 *   AI_API_KEY   API key (falls back to the provider's conventional variable, e.g. GEMINI_API_KEY)
 *   AI_BASE_URL  optional, for OpenAI-compatible endpoints
 *
 * With none of these set but GEMINI_API_KEY present, it behaves exactly like the original
 * project (Gemini + gemini-3.8-flash), so existing .env files keep working.
 */
export function aiConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AIConfig | null {
  const providerId = (env.AI_PROVIDER || '').trim() || (env.GEMINI_API_KEY ? 'gemini' : '');
  if (!providerId) return null;

  const preset = getProviderPreset(providerId);
  if (!preset) {
    throw new AIConfigError(`AI_PROVIDER="${providerId}" não é um provedor conhecido.`);
  }

  const conventionalKey: Record<string, string | undefined> = {
    gemini: env.GEMINI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
    openai: env.OPENAI_API_KEY,
    openrouter: env.OPENROUTER_API_KEY,
    groq: env.GROQ_API_KEY,
    deepseek: env.DEEPSEEK_API_KEY,
    mistral: env.MISTRAL_API_KEY,
  };

  return {
    providerId,
    protocol: preset.protocol,
    model: (env.AI_MODEL || '').trim() || preset.defaultModel,
    apiKey: (env.AI_API_KEY || '').trim() || conventionalKey[providerId] || undefined,
    baseUrl: (env.AI_BASE_URL || '').trim() || preset.defaultBaseUrl || undefined,
    source: 'env',
  };
}

/** Returns a pt-BR explanation of what is missing, or null when the config is usable. */
export function validateAIConfig(config: AIConfig | null): string | null {
  if (!config) {
    return 'Nenhum provedor de IA configurado. Abra a aba "Configurações" e escolha um provedor (Gemini, Claude, OpenAI, Ollama...).';
  }
  const preset = getProviderPreset(config.providerId);
  if (!preset) return `Provedor de IA desconhecido: ${config.providerId}.`;
  if (!config.model) return `Informe o nome do modelo para ${preset.label} na aba "Configurações".`;
  if (preset.requiresApiKey && !config.apiKey) {
    return `Informe a chave de API do ${preset.label} na aba "Configurações".`;
  }
  if (config.protocol === 'openai-compatible' && !config.baseUrl) {
    return `Informe a URL base do endpoint compatível com OpenAI na aba "Configurações".`;
  }
  return null;
}

export function providerSupportsPdf(config: AIConfig): boolean {
  return Boolean(getProviderPreset(config.providerId)?.supportsPdf);
}

export function describeAIConfig(config: AIConfig): string {
  const label = getProviderPreset(config.providerId)?.label || config.providerId;
  return `${label} · ${config.model}`;
}

export async function generateText(config: AIConfig | null, options: GenerateOptions): Promise<string> {
  assertUsable(config, options);
  try {
    switch (config.protocol) {
      case 'gemini':
        return await geminiGenerate(config, options);
      case 'anthropic':
        return await anthropicGenerate(config, options);
      case 'openai-compatible':
        return await openAICompatibleGenerate(config, options);
    }
  } catch (error) {
    throw toAIRequestError(error, config);
  }
}

export async function generateJSON<T>(config: AIConfig | null, options: GenerateJSONOptions): Promise<T> {
  assertUsable(config, options);
  try {
    let raw: string;
    switch (config.protocol) {
      case 'gemini':
        raw = await geminiGenerate(config, options, options.schema);
        break;
      case 'anthropic':
        raw = await anthropicGenerate(config, options, options.schema);
        break;
      case 'openai-compatible':
        raw = await openAICompatibleGenerate(config, options, options.schema);
        break;
    }
    return parseJSONResponse<T>(raw);
  } catch (error) {
    throw toAIRequestError(error, config);
  }
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

async function geminiGenerate(config: AIConfig, options: GenerateOptions, schema?: JSONSchema): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: config.apiKey || '' });
  const contents = options.pdfBase64
    ? [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: options.pdfBase64 } },
            { text: options.prompt },
          ],
        },
      ]
    : options.prompt;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: config.model,
      contents,
      config: {
        ...(options.system ? { systemInstruction: options.system } : {}),
        ...(schema ? { responseMimeType: 'application/json', responseJsonSchema: schema } : {}),
        maxOutputTokens: options.maxOutputTokens || DEFAULT_MAX_OUTPUT_TOKENS,
      },
    })
  );
  return response.text || '';
}

async function anthropicGenerate(config: AIConfig, options: GenerateOptions, schema?: JSONSchema): Promise<string> {
  const client = new Anthropic({
    apiKey: config.apiKey,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
  });

  const content: Anthropic.ContentBlockParam[] = [];
  if (options.pdfBase64) {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: options.pdfBase64 },
    });
  }
  content.push({ type: 'text', text: schema ? withJSONInstructions(options.prompt, schema) : options.prompt });

  const request: Anthropic.MessageStreamParams = {
    model: config.model,
    max_tokens: options.maxOutputTokens || DEFAULT_MAX_OUTPUT_TOKENS,
    ...(options.system ? { system: options.system } : {}),
    messages: [{ role: 'user', content }],
  };

  let message: Anthropic.Message;
  try {
    // Streaming avoids HTTP timeouts on long outputs (full HTML resumes).
    message = await client.messages
      .stream(schema ? { ...request, output_config: { format: { type: 'json_schema', schema: strictSchema(schema) } } } : request)
      .finalMessage();
  } catch (error) {
    // Older Claude models do not support structured outputs; the prompt already asks for JSON.
    if (schema && error instanceof Anthropic.BadRequestError) {
      message = await client.messages.stream(request).finalMessage();
    } else {
      throw error;
    }
  }

  if (message.stop_reason === 'refusal') {
    throw new AIRequestError('O modelo recusou esta solicitação. Tente novamente ou escolha outro modelo.');
  }
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

async function openAICompatibleGenerate(config: AIConfig, options: GenerateOptions, schema?: JSONSchema): Promise<string> {
  const client = new OpenAI({
    // Local servers (Ollama, LM Studio) ignore the key, but the SDK requires a value.
    apiKey: config.apiKey || 'not-needed',
    baseURL: config.baseUrl,
  });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (options.system) messages.push({ role: 'system', content: options.system });
  messages.push({ role: 'user', content: schema ? withJSONInstructions(options.prompt, schema) : options.prompt });

  const request: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = { model: config.model, messages };

  let completion: OpenAI.Chat.ChatCompletion;
  try {
    completion = await client.chat.completions.create(
      schema ? { ...request, response_format: { type: 'json_object' } } : request
    );
  } catch (error) {
    // Some compatible servers reject response_format; the prompt alone still asks for JSON.
    if (schema && error instanceof OpenAI.BadRequestError) {
      completion = await client.chat.completions.create(request);
    } else {
      throw error;
    }
  }

  return completion.choices[0]?.message?.content || '';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertUsable(config: AIConfig | null, options: GenerateOptions): asserts config is AIConfig {
  const problem = validateAIConfig(config);
  if (problem || !config) throw new AIConfigError(problem || 'Configuração de IA ausente.');
  if (options.pdfBase64 && !providerSupportsPdf(config)) {
    throw new AIConfigError(
      `${describeAIConfig(config)} não lê PDFs diretamente. Envie um PDF com texto selecionável, um arquivo .txt/.md, ou cole o conteúdo no editor.`
    );
  }
}

function withJSONInstructions(prompt: string, schema: JSONSchema): string {
  return `${prompt}

Respond ONLY with a single valid JSON object (no markdown fences, no commentary) that matches this JSON Schema:
${JSON.stringify(schema, null, 2)}`;
}

/** Anthropic structured outputs require additionalProperties: false on every object. */
function strictSchema(schema: JSONSchema): Record<string, unknown> {
  const result: Record<string, unknown> = { ...schema };
  if (schema.properties) {
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [key, strictSchema(value)])
    );
    result.additionalProperties = false;
  }
  if (schema.items) result.items = strictSchema(schema.items);
  return result;
}

/** Tolerates markdown fences and leading/trailing prose that some models add around JSON. */
export function parseJSONResponse<T>(raw: string): T {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as T;
      } catch {
        // fall through
      }
    }
    throw new AIRequestError('O modelo não retornou um JSON válido. Tente novamente ou escolha um modelo mais capaz.');
  }
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const status = getStatus(error);
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (!retryable || attempt >= retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** attempt));
    }
  }
}

function getStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const status = (error as { status?: unknown; code?: unknown }).status ?? (error as { code?: unknown }).code;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

function toAIRequestError(error: unknown, config: AIConfig): Error {
  if (error instanceof AIRequestError || error instanceof AIConfigError) return error;

  const label = describeAIConfig(config);
  if (error instanceof OpenAI.APIConnectionError || error instanceof Anthropic.APIConnectionError) {
    return new AIRequestError(
      `Não foi possível conectar ao provedor de IA (${config.baseUrl || label}). Verifique a URL e se o servidor está rodando.`
    );
  }

  const status = getStatus(error);
  const detail = error instanceof Error ? error.message : String(error);
  switch (status) {
    case 401:
    case 403:
      return new AIRequestError(`Chave de API recusada pelo provedor (${label}). Verifique a chave na aba "Configurações".`, status);
    case 404:
      return new AIRequestError(`Modelo "${config.model}" não encontrado no provedor. Confira o nome do modelo na aba "Configurações".`, status);
    case 429:
      return new AIRequestError(`Limite de uso do provedor atingido (${label}). Aguarde um pouco e tente novamente.`, status);
    default:
      return new AIRequestError(`Falha na chamada de IA (${label}): ${detail}`, status);
  }
}
