// Shapes exchanged between /api/settings and the dashboard. Client-safe: the API key
// itself never leaves the server, only `hasApiKey`.

import type { RoleOption, SearchFilterState } from './search';

export interface SearchDefaults extends SearchFilterState {
  maxPages: number;
}

export interface EffectiveAIConfigView {
  providerId: string | null;
  model: string | null;
  baseUrl: string | null;
  /** "user": saved in Configurações · "env": server .env · "none": nothing configured */
  source: 'user' | 'env' | 'none';
  ready: boolean;
  problem: string | null;
}

export interface AISettingsView {
  providerId: string | null;
  model: string | null;
  baseUrl: string | null;
  hasApiKey: boolean;
  effective: EffectiveAIConfigView;
}

export interface EvaluationSettings {
  criteria: string;
  minScore: number;
  autoDiscardBelowMin: boolean;
}

export interface UserSettingsView {
  ai: AISettingsView;
  searchDefaults: SearchDefaults;
  customRoles: RoleOption[];
  locationSuggestions: string[];
  evaluation: EvaluationSettings;
}

/** Body accepted by PUT /api/settings. Every section is optional. */
export interface UserSettingsUpdate {
  ai?: {
    providerId: string | null;
    model?: string | null;
    baseUrl?: string | null;
    /** undefined = keep the saved key · "" = remove it · string = replace it */
    apiKey?: string;
  };
  searchDefaults?: Partial<SearchDefaults>;
  customRoles?: RoleOption[];
  locationSuggestions?: string[];
  evaluation?: Partial<EvaluationSettings>;
}
