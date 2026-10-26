import type { Prisma, User, UserSettings } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptUserData, encryptUserData } from '@/lib/security';
import { AIConfig, aiConfigFromEnv, validateAIConfig } from '@/lib/ai/client';
import { getProviderPreset } from '@/lib/ai/providers';
import {
  DEFAULT_LOCATION_SUGGESTIONS,
  DEFAULT_MAX_PAGES,
  DEFAULT_SEARCH_FILTERS,
  MAX_PAGES_LIMIT,
  RoleOption,
  SENIORITY_OPTIONS,
  WORKPLACE_OPTIONS,
  slugifyRoleLabel,
} from '@/lib/search';
import type {
  EffectiveAIConfigView,
  SearchDefaults,
  UserSettingsUpdate,
  UserSettingsView,
} from '@/lib/settings-types';

const DEFAULT_EVALUATION_MIN_SCORE = 70;

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  return prisma.userSettings.findUnique({ where: { userId } });
}

function safeEnvConfig(): AIConfig | null {
  try {
    return aiConfigFromEnv();
  } catch (error) {
    console.warn('Ignoring invalid AI environment configuration:', error);
    return null;
  }
}

/**
 * The AI configuration used for a request: the user's own choice from "Configurações"
 * when present, otherwise the server-wide .env configuration.
 */
export function resolveAIConfig(user: Pick<User, 'id'> | null, settings: UserSettings | null): AIConfig | null {
  if (!user || !settings?.aiProvider) return safeEnvConfig();
  return (
    buildUserAIConfig({
      providerId: settings.aiProvider,
      model: settings.aiModel,
      baseUrl: settings.aiBaseUrl,
      apiKey: decryptUserData(settings.encryptedAiApiKey, user.id) || undefined,
    }) ?? safeEnvConfig()
  );
}

/** Builds a config from values chosen in the settings screen (saved or not yet saved). */
export function buildUserAIConfig(input: {
  providerId: string;
  model?: string | null;
  baseUrl?: string | null;
  apiKey?: string;
}): AIConfig | null {
  const preset = getProviderPreset(input.providerId);
  if (!preset) return null;

  const envConfig = safeEnvConfig();
  // Lets a host share a server key: the user only picks the model, the key comes from .env.
  const sharedKey = envConfig?.providerId === preset.id ? envConfig.apiKey : undefined;

  return {
    providerId: preset.id,
    protocol: preset.protocol,
    model: input.model?.trim() || preset.defaultModel,
    apiKey: input.apiKey?.trim() || sharedKey,
    baseUrl: (preset.editableBaseUrl && input.baseUrl?.trim()) || preset.defaultBaseUrl || undefined,
    source: 'user',
  };
}

export async function resolveAIConfigForUser(user: Pick<User, 'id'> | null): Promise<AIConfig | null> {
  const settings = user ? await getUserSettings(user.id) : null;
  return resolveAIConfig(user, settings);
}

export function describeEffectiveConfig(config: AIConfig | null): EffectiveAIConfigView {
  const problem = validateAIConfig(config);
  return {
    providerId: config?.providerId ?? null,
    model: config?.model ?? null,
    baseUrl: config?.baseUrl ?? null,
    source: config ? config.source : 'none',
    ready: problem === null,
    problem,
  };
}

export function toSettingsView(user: Pick<User, 'id'>, settings: UserSettings | null): UserSettingsView {
  return {
    ai: {
      providerId: settings?.aiProvider ?? null,
      model: settings?.aiModel ?? null,
      baseUrl: settings?.aiBaseUrl ?? null,
      hasApiKey: Boolean(settings?.encryptedAiApiKey),
      effective: describeEffectiveConfig(resolveAIConfig(user, settings)),
    },
    searchDefaults: normalizeSearchDefaults(settings?.searchDefaults),
    customRoles: normalizeCustomRoles(settings?.customRoles),
    locationSuggestions:
      settings && settings.locationSuggestions.length > 0
        ? settings.locationSuggestions
        : DEFAULT_LOCATION_SUGGESTIONS,
    evaluation: {
      criteria: settings?.evaluationCriteria ?? '',
      minScore: settings?.evaluationMinScore ?? DEFAULT_EVALUATION_MIN_SCORE,
      autoDiscardBelowMin: settings?.autoDiscardBelowMin ?? false,
    },
  };
}

export async function updateUserSettings(userId: string, update: UserSettingsUpdate): Promise<UserSettings> {
  const data: Prisma.UserSettingsUncheckedUpdateInput = {};

  if (update.ai) {
    const providerId = update.ai.providerId || null;
    if (providerId && !getProviderPreset(providerId)) {
      throw new SettingsValidationError(`Provedor de IA desconhecido: ${providerId}`);
    }
    data.aiProvider = providerId;
    data.aiModel = cleanString(update.ai.model, 200);
    data.aiBaseUrl = cleanUrl(update.ai.baseUrl);
    const previousProvider = (await getUserSettings(userId))?.aiProvider ?? null;
    if (!providerId) {
      data.encryptedAiApiKey = null;
    } else if (update.ai.apiKey !== undefined) {
      const key = update.ai.apiKey.trim();
      data.encryptedAiApiKey = key ? encryptUserData(key, userId) : null;
    } else if (providerId !== previousProvider) {
      // A key belongs to one provider: never send the old provider's key to a new one.
      data.encryptedAiApiKey = null;
    }
  }

  if (update.searchDefaults) {
    data.searchDefaults = normalizeSearchDefaults(update.searchDefaults) as unknown as Prisma.InputJsonValue;
  }

  if (update.customRoles) {
    data.customRoles = normalizeCustomRoles(update.customRoles) as unknown as Prisma.InputJsonValue;
  }

  if (update.locationSuggestions) {
    data.locationSuggestions = Array.from(
      new Set(update.locationSuggestions.map((l) => String(l).trim()).filter(Boolean))
    ).slice(0, 50);
  }

  if (update.evaluation) {
    if (update.evaluation.criteria !== undefined) {
      data.evaluationCriteria = String(update.evaluation.criteria).slice(0, 4000);
    }
    if (update.evaluation.minScore !== undefined) {
      data.evaluationMinScore = clampInt(update.evaluation.minScore, 0, 100, DEFAULT_EVALUATION_MIN_SCORE);
    }
    if (update.evaluation.autoDiscardBelowMin !== undefined) {
      data.autoDiscardBelowMin = Boolean(update.evaluation.autoDiscardBelowMin);
    }
  }

  return prisma.userSettings.upsert({
    where: { userId },
    update: data,
    create: { ...(data as Prisma.UserSettingsUncheckedCreateInput), userId },
  });
}

export class SettingsValidationError extends Error {}

// ---------------------------------------------------------------------------
// Normalization (settings are stored as JSON, so never trust their shape)
// ---------------------------------------------------------------------------

export function normalizeSearchDefaults(raw: unknown): SearchDefaults {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<SearchDefaults>;
  const roles = Array.isArray(value.roles)
    ? value.roles.map(String).map((r) => r.trim()).filter(Boolean).slice(0, 30)
    : [];
  const seniorityValues: readonly string[] = SENIORITY_OPTIONS.map((o) => o.value);
  const workplaceValues: readonly string[] = WORKPLACE_OPTIONS.map((o) => o.value);

  return {
    roles: roles.length > 0 ? roles : DEFAULT_SEARCH_FILTERS.roles,
    seniority: seniorityValues.includes(String(value.seniority)) ? String(value.seniority) : DEFAULT_SEARCH_FILTERS.seniority,
    timeRangeSeconds: clampInt(value.timeRangeSeconds, 0, 365 * 24 * 3600, DEFAULT_SEARCH_FILTERS.timeRangeSeconds),
    location: typeof value.location === 'string' ? value.location.slice(0, 200) : DEFAULT_SEARCH_FILTERS.location,
    workplaceType: workplaceValues.includes(String(value.workplaceType))
      ? String(value.workplaceType)
      : DEFAULT_SEARCH_FILTERS.workplaceType,
    maxPages: clampInt(value.maxPages, 1, MAX_PAGES_LIMIT, DEFAULT_MAX_PAGES),
  };
}

export function normalizeCustomRoles(raw: unknown): RoleOption[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const roles: RoleOption[] = [];
  for (const item of raw.slice(0, 50)) {
    if (!item || typeof item !== 'object') continue;
    const label = String((item as RoleOption).label || '').trim().slice(0, 80);
    const booleanTerms = String((item as RoleOption).booleanTerms || '').trim().slice(0, 1000);
    if (!label || !booleanTerms) continue;
    const value = String((item as RoleOption).value || '').trim() || slugifyRoleLabel(label);
    if (seen.has(value)) continue;
    seen.add(value);
    roles.push({ value, label, booleanTerms });
  }
  return roles;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || null;
}

function cleanUrl(value: unknown): string | null {
  const url = cleanString(value, 500);
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    throw new SettingsValidationError('A URL base deve começar com http:// ou https://');
  }
  return url.replace(/\/+$/, '');
}
