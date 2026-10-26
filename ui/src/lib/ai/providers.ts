// Catalog of supported AI providers. Safe to import from client components:
// it only describes providers, it never touches API keys.
//
// There are only three wire protocols behind every entry:
//   - "gemini":            Google Gemini (native SDK, supports PDF input)
//   - "anthropic":         Anthropic Claude (native SDK, supports PDF input)
//   - "openai-compatible": the OpenAI Chat Completions API, which is also spoken by
//                          OpenRouter, Groq, DeepSeek, Mistral, Together, Ollama, LM Studio,
//                          vLLM, LiteLLM and most self-hosted gateways.
// Adding a new OpenAI-compatible provider is just a new entry in AI_PROVIDERS.

export type AIProtocol = 'gemini' | 'anthropic' | 'openai-compatible';

export interface AIProviderPreset {
  id: string;
  label: string;
  protocol: AIProtocol;
  description: string;
  /** Pre-filled model. Empty means the user must type one (model names change too often to hardcode). */
  defaultModel: string;
  modelSuggestions: string[];
  /** Base URL for OpenAI-compatible providers. Empty for native SDK providers. */
  defaultBaseUrl: string;
  /** Whether the user may edit the base URL in the settings screen. */
  editableBaseUrl: boolean;
  requiresApiKey: boolean;
  /** Can read PDF files natively (used for scanned resumes without a text layer). */
  supportsPdf: boolean;
  apiKeyUrl?: string;
  modelsDocsUrl?: string;
}

export const AI_PROVIDERS: AIProviderPreset[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    protocol: 'gemini',
    description: 'API do Google AI Studio. Lê PDFs nativamente.',
    defaultModel: 'gemini-3.8-flash',
    modelSuggestions: ['gemini-3.8-flash'],
    defaultBaseUrl: '',
    editableBaseUrl: false,
    requiresApiKey: true,
    supportsPdf: true,
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    modelsDocsUrl: 'https://ai.google.dev/gemini-api/docs/models',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    protocol: 'anthropic',
    description: 'Modelos Claude via API da Anthropic. Lê PDFs nativamente.',
    defaultModel: 'claude-opus-5-5',
    modelSuggestions: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
    defaultBaseUrl: '',
    editableBaseUrl: false,
    requiresApiKey: true,
    supportsPdf: true,
    apiKeyUrl: 'https://platform.claude.com/settings/keys',
    modelsDocsUrl: 'https://platform.claude.com/docs/en/about-claude/models/overview',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    protocol: 'openai-compatible',
    description: 'Modelos GPT via API oficial da OpenAI.',
    defaultModel: '',
    modelSuggestions: [],
    defaultBaseUrl: 'https://api.openai.com/v1',
    editableBaseUrl: false,
    requiresApiKey: true,
    supportsPdf: false,
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    modelsDocsUrl: 'https://platform.openai.com/docs/models',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    protocol: 'openai-compatible',
    description: 'Uma chave para centenas de modelos (Claude, GPT, Llama, Gemini, Qwen...).',
    defaultModel: '',
    modelSuggestions: [],
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    editableBaseUrl: false,
    requiresApiKey: true,
    supportsPdf: false,
    apiKeyUrl: 'https://openrouter.ai/keys',
    modelsDocsUrl: 'https://openrouter.ai/models',
  },
  {
    id: 'groq',
    label: 'Groq',
    protocol: 'openai-compatible',
    description: 'Modelos open-source com inferência muito rápida.',
    defaultModel: '',
    modelSuggestions: [],
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    editableBaseUrl: false,
    requiresApiKey: true,
    supportsPdf: false,
    apiKeyUrl: 'https://console.groq.com/keys',
    modelsDocsUrl: 'https://console.groq.com/docs/models',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai-compatible',
    description: 'API da DeepSeek (compatível com OpenAI).',
    defaultModel: '',
    modelSuggestions: [],
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    editableBaseUrl: false,
    requiresApiKey: true,
    supportsPdf: false,
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    modelsDocsUrl: 'https://api-docs.deepseek.com/',
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    protocol: 'openai-compatible',
    description: 'API da Mistral (compatível com OpenAI).',
    defaultModel: '',
    modelSuggestions: [],
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    editableBaseUrl: false,
    requiresApiKey: true,
    supportsPdf: false,
    apiKeyUrl: 'https://console.mistral.ai/api-keys',
    modelsDocsUrl: 'https://docs.mistral.ai/getting-started/models/',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    protocol: 'openai-compatible',
    description: 'Modelos rodando na sua máquina, sem custo e sem enviar dados para fora.',
    defaultModel: '',
    modelSuggestions: [],
    defaultBaseUrl: 'http://localhost:11434/v1',
    editableBaseUrl: true,
    requiresApiKey: false,
    supportsPdf: false,
    modelsDocsUrl: 'https://ollama.com/library',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio (local)',
    protocol: 'openai-compatible',
    description: 'Servidor local do LM Studio.',
    defaultModel: '',
    modelSuggestions: [],
    defaultBaseUrl: 'http://localhost:1234/v1',
    editableBaseUrl: true,
    requiresApiKey: false,
    supportsPdf: false,
    modelsDocsUrl: 'https://lmstudio.ai/models',
  },
  {
    id: 'custom',
    label: 'Outro (compatível com OpenAI)',
    protocol: 'openai-compatible',
    description: 'Qualquer endpoint que implemente /chat/completions (vLLM, LiteLLM, Azure, Together...).',
    defaultModel: '',
    modelSuggestions: [],
    defaultBaseUrl: '',
    editableBaseUrl: true,
    requiresApiKey: false,
    supportsPdf: false,
  },
];

export const DEFAULT_PROVIDER_ID = 'gemini';

export function getProviderPreset(id: string | null | undefined): AIProviderPreset | undefined {
  if (!id) return undefined;
  return AI_PROVIDERS.find((p) => p.id === id);
}
