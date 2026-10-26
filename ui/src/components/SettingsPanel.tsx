"use client";

import { FC, ReactNode, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Layers,
  Loader2,
  Plug,
  Plus,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Target,
  Trash2,
} from 'lucide-react';
import { AI_PROVIDERS, getProviderPreset } from '@/lib/ai/providers';
import {
  BUILT_IN_ROLE_OPTIONS,
  MAX_PAGES_LIMIT,
  RoleOption,
  SENIORITY_OPTIONS,
  TIME_RANGE_OPTIONS,
  WORKPLACE_OPTIONS,
  getRoleOptions,
  slugifyRoleLabel,
} from '@/lib/search';
import type { SearchDefaults, UserSettingsUpdate, UserSettingsView } from '@/lib/settings-types';

interface SettingsPanelProps {
  settings: UserSettingsView;
  onSaved: (settings: UserSettingsView) => void;
}

type Feedback = { type: 'success' | 'error'; message: string } | null;

const inputClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';
const textareaClass =
  'w-full rounded-md border border-input bg-background p-3 text-xs leading-relaxed shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const EVALUATION_CRITERIA_EXAMPLE = `Exemplos (escreva com suas palavras, em português ou inglês):
- Vagas em Cascavel/PR podem ser presenciais ou remotas.
- Fora de Cascavel, apenas vagas 100% remotas.
- Não tenho interesse em vagas que exigem mudança de país sem visto patrocinado.
- Prefiro empresas de produto; evitar consultorias de alocação.`;

async function putSettings(update: UserSettingsUpdate): Promise<UserSettingsView> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha ao salvar configurações.');
  return data;
}

export const SettingsPanel: FC<SettingsPanelProps> = ({ settings, onSaved }) => {
  const [resetting, setResetting] = useState(false);
  // Sections keep their own form state; bumping this remounts them after a full reset.
  const [formVersion, setFormVersion] = useState(0);

  const handleReset = async () => {
    if (!confirm('Restaurar todas as configurações para o padrão? A chave de API salva também será apagada.')) return;
    setResetting(true);
    try {
      const res = await fetch('/api/settings', { method: 'DELETE' });
      if (res.ok) {
        onSaved(await res.json());
        setFormVersion((v) => v + 1);
      }
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <AIProviderSection key={`ai-${formVersion}`} settings={settings} onSaved={onSaved} />
      <EvaluationSection key={`eval-${formVersion}`} settings={settings} onSaved={onSaved} />
      <SearchDefaultsSection key={`search-${formVersion}`} settings={settings} onSaved={onSaved} />
      <CustomRolesSection key={`roles-${formVersion}`} settings={settings} onSaved={onSaved} />

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={resetting}
          className="text-xs text-muted-foreground hover:text-rose-600 gap-1.5"
        >
          {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          Restaurar todas as configurações padrão
        </Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function FeedbackBanner({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <div
      className={`p-3 rounded-md border text-xs flex items-start gap-2 ${
        feedback.type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
          : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
      }`}
    >
      {feedback.type === 'success' ? (
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
      )}
      <span className="break-words">{feedback.message}</span>
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-foreground">
        {label}
      </label>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground leading-relaxed">{hint}</span>}
    </div>
  );
}

function SaveButton({ saving, onClick, disabled }: { saving: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <Button size="sm" onClick={onClick} disabled={saving || disabled} className="text-xs gap-1.5">
      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
      Salvar
    </Button>
  );
}

function useSection(onSaved: (settings: UserSettingsView) => void) {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const save = async (update: UserSettingsUpdate, successMessage: string) => {
    setSaving(true);
    setFeedback(null);
    try {
      onSaved(await putSettings(update));
      setFeedback({ type: 'success', message: successMessage });
      return true;
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : String(error) });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { saving, feedback, setFeedback, save };
}

// ---------------------------------------------------------------------------
// 1. AI provider
// ---------------------------------------------------------------------------

const AIProviderSection: FC<SettingsPanelProps> = ({ settings, onSaved }) => {
  const { ai } = settings;
  const { saving, feedback, setFeedback, save } = useSection(onSaved);

  const [providerId, setProviderId] = useState<string>(ai.providerId || '');
  const [model, setModel] = useState(ai.model || '');
  const [baseUrl, setBaseUrl] = useState(ai.baseUrl || '');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);

  const preset = getProviderPreset(providerId);
  const effectivePreset = getProviderPreset(ai.effective.providerId);

  const selectProvider = (id: string) => {
    setProviderId(id);
    setFeedback(null);
    const next = getProviderPreset(id);
    setModel(next?.defaultModel || '');
    setBaseUrl(next?.defaultBaseUrl || '');
    setApiKey('');
  };

  const handleSave = async () => {
    const saved = await save(
      {
        ai: {
          providerId: providerId || null,
          model,
          baseUrl: preset?.editableBaseUrl ? baseUrl : null,
          ...(apiKey ? { apiKey } : {}),
        },
      },
      providerId ? `Provedor de IA salvo: ${preset?.label} · ${model || preset?.defaultModel}` : 'Usando a configuração do servidor (.env).'
    );
    if (saved) setApiKey('');
  };

  const handleRemoveKey = () => save({ ai: { providerId: providerId || null, model, baseUrl, apiKey: '' } }, 'Chave de API removida.');

  const handleTest = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(providerId ? { providerId, model, baseUrl, apiKey } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha no teste.');
      setFeedback({
        type: 'success',
        message: `Conexão OK com ${data.provider} em ${(data.latencyMs / 1000).toFixed(1)}s. Resposta: "${data.reply}"`,
      });
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Provedor de Inteligência Artificial
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Escolha qualquer modelo para extrair seu currículo, gerar documentos e avaliar vagas: serviços na nuvem
              ou modelos locais (Ollama / LM Studio), sem alterar código.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={`text-[11px] gap-1 ${
              ai.effective.ready
                ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                : 'border-amber-500/40 text-amber-600 dark:text-amber-400'
            }`}
          >
            {ai.effective.ready ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            {ai.effective.ready
              ? `Ativo: ${effectivePreset?.label || ai.effective.providerId} · ${ai.effective.model}${
                  ai.effective.source === 'env' ? ' (servidor)' : ''
                }`
              : 'IA não configurada'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider picker */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <ProviderTile
            selected={!providerId}
            title="Padrão do servidor"
            subtitle="Usa as variáveis AI_* do .env"
            onClick={() => selectProvider('')}
          />
          {AI_PROVIDERS.map((p) => (
            <ProviderTile
              key={p.id}
              selected={providerId === p.id}
              title={p.label}
              subtitle={p.supportsPdf ? 'Lê PDFs escaneados' : p.requiresApiKey ? 'Requer chave de API' : 'Sem chave de API'}
              onClick={() => selectProvider(p.id)}
            />
          ))}
        </div>

        {!providerId && (
          <p className="text-xs text-muted-foreground bg-muted/40 border rounded-md p-3 leading-relaxed">
            {ai.effective.source === 'env' ? (
              <>
                O servidor está configurado com <strong>{effectivePreset?.label}</strong> ·{' '}
                <code>{ai.effective.model}</code>. Escolha um provedor acima para usar sua própria conta/modelo.
              </>
            ) : (
              <>
                O servidor não tem nenhum provedor configurado no <code>.env</code>. Escolha um provedor acima para
                habilitar os recursos de IA.
              </>
            )}
          </p>
        )}

        {preset && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-xs text-muted-foreground">{preset.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Modelo"
                htmlFor="ai-model"
                hint={
                  preset.modelsDocsUrl ? (
                    <a href={preset.modelsDocsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      Ver modelos disponíveis <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : undefined
                }
              >
                <input
                  id="ai-model"
                  list="ai-model-suggestions"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={preset.defaultModel || 'Nome exato do modelo no provedor'}
                  className={inputClass}
                />
                <datalist id="ai-model-suggestions">
                  {preset.modelSuggestions.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Field>

              {preset.protocol === 'openai-compatible' && (
                <Field label="URL base da API" htmlFor="ai-base-url" hint="Endpoint compatível com OpenAI (termina em /v1 na maioria dos casos).">
                  <input
                    id="ai-base-url"
                    value={preset.editableBaseUrl ? baseUrl : preset.defaultBaseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    disabled={!preset.editableBaseUrl}
                    placeholder="https://meu-servidor/v1"
                    className={inputClass}
                  />
                </Field>
              )}

              <Field
                label={preset.requiresApiKey ? 'Chave de API' : 'Chave de API (opcional)'}
                htmlFor="ai-api-key"
                hint={
                  <span className="inline-flex items-center gap-2 flex-wrap">
                    <span>Criptografada com AES-256-GCM e nunca exibida novamente.</span>
                    {preset.apiKeyUrl && (
                      <a href={preset.apiKeyUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        Obter chave <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </span>
                }
              >
                <div className="flex gap-2">
                  <input
                    id="ai-api-key"
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      ai.hasApiKey && ai.providerId === providerId ? '•••••••• (chave salva — digite para substituir)' : 'Cole sua chave aqui'
                    }
                    className={inputClass}
                  />
                  {ai.hasApiKey && ai.providerId === providerId && (
                    <Button variant="ghost" size="sm" onClick={handleRemoveKey} disabled={saving} title="Remover chave salva" className="h-9 text-muted-foreground hover:text-rose-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </Field>
            </div>
          </div>
        )}

        <FeedbackBanner feedback={feedback} />

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || saving} className="text-xs gap-1.5">
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
            Testar conexão
          </Button>
          <SaveButton saving={saving} onClick={handleSave} />
        </div>
      </CardContent>
    </Card>
  );
};

function ProviderTile({ selected, title, subtitle, onClick }: { selected: boolean; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border px-3 py-2.5 transition-all cursor-pointer ${
        selected ? 'border-primary bg-primary/10 shadow-sm' : 'border-input hover:bg-muted/60'
      }`}
    >
      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
        {title}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// 2. Job evaluation
// ---------------------------------------------------------------------------

const EvaluationSection: FC<SettingsPanelProps> = ({ settings, onSaved }) => {
  const { saving, feedback, save } = useSection(onSaved);
  const [criteria, setCriteria] = useState(settings.evaluation.criteria);
  const [minScore, setMinScore] = useState(settings.evaluation.minScore);
  const [autoDiscard, setAutoDiscard] = useState(settings.evaluation.autoDiscardBelowMin);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-5 h-5 text-emerald-600" />
          Avaliação de Vagas com IA
        </CardTitle>
        <CardDescription className="text-xs mt-1">
          Ao clicar em <strong>&quot;Avaliar com IA&quot;</strong> na aba Descobrir Vagas, cada vaga recebe uma nota de 0 a
          100 comparando a descrição com o seu perfil e com os critérios abaixo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field
          label="Critérios obrigatórios e preferências"
          htmlFor="eval-criteria"
          hint="Vagas que violarem claramente um critério obrigatório recebem nota 0. Deixe em branco para avaliar apenas a aderência ao perfil."
        >
          <textarea
            id="eval-criteria"
            rows={6}
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            placeholder={EVALUATION_CRITERIA_EXAMPLE}
            className={textareaClass}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <Field label={`Nota mínima para destacar a vaga: ${minScore}`} htmlFor="eval-min-score">
            <input
              id="eval-min-score"
              type="range"
              min={0}
              max={100}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </Field>
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={autoDiscard} onChange={(e) => setAutoDiscard(e.target.checked)} className="mt-0.5 accent-primary" />
            <span>
              <strong>Descartar automaticamente</strong> vagas com nota abaixo da mínima (mesmo efeito do botão
              &quot;Recusar&quot;).
            </span>
          </label>
        </div>

        <FeedbackBanner feedback={feedback} />
        <div className="flex justify-end">
          <SaveButton
            saving={saving}
            onClick={() => save({ evaluation: { criteria, minScore, autoDiscardBelowMin: autoDiscard } }, 'Critérios de avaliação salvos.')}
          />
        </div>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// 3. Search defaults
// ---------------------------------------------------------------------------

const SearchDefaultsSection: FC<SettingsPanelProps> = ({ settings, onSaved }) => {
  const { saving, feedback, save } = useSection(onSaved);
  const [defaults, setDefaults] = useState<SearchDefaults>(settings.searchDefaults);
  const [locationsText, setLocationsText] = useState(settings.locationSuggestions.join('\n'));

  const roleOptions = useMemo(() => getRoleOptions(settings.customRoles), [settings.customRoles]);

  const toggleRole = (value: string) => {
    const has = defaults.roles.includes(value);
    const roles = has ? defaults.roles.filter((r) => r !== value) : [...defaults.roles, value];
    setDefaults({ ...defaults, roles: roles.length > 0 ? roles : defaults.roles });
  };

  const handleSave = () =>
    save(
      {
        searchDefaults: defaults,
        locationSuggestions: locationsText.split('\n').map((l) => l.trim()).filter(Boolean),
      },
      'Padrões de busca salvos. Eles serão aplicados quando você abrir o painel sem filtros na URL.'
    );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-amber-600" />
          Padrões da Busca no LinkedIn
        </CardTitle>
        <CardDescription className="text-xs mt-1">
          Filtros carregados automaticamente ao abrir o painel, quantidade de páginas varridas pelo scraper e suas
          localidades favoritas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Cargos selecionados por padrão">
          <div className="flex flex-wrap gap-2">
            {roleOptions.map((role) => {
              const selected = defaults.roles.includes(role.value);
              return (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => toggleRole(role.value)}
                  className={`px-3 py-1 rounded-full text-xs border transition-all cursor-pointer ${
                    selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted/70'
                  }`}
                >
                  {role.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Field label="Senioridade" htmlFor="def-seniority">
            <select id="def-seniority" value={defaults.seniority} onChange={(e) => setDefaults({ ...defaults, seniority: e.target.value })} className={inputClass}>
              {SENIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Publicação" htmlFor="def-time">
            <select id="def-time" value={defaults.timeRangeSeconds} onChange={(e) => setDefaults({ ...defaults, timeRangeSeconds: Number(e.target.value) })} className={inputClass}>
              {TIME_RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Localidade" htmlFor="def-location">
            <input id="def-location" value={defaults.location} onChange={(e) => setDefaults({ ...defaults, location: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Modelo de trabalho" htmlFor="def-workplace">
            <select id="def-workplace" value={defaults.workplaceType} onChange={(e) => setDefaults({ ...defaults, workplaceType: e.target.value })} className={inputClass}>
              {WORKPLACE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Páginas por busca" htmlFor="def-pages" hint="~25 vagas por página.">
            <input
              id="def-pages"
              type="number"
              min={1}
              max={MAX_PAGES_LIMIT}
              value={defaults.maxPages}
              onChange={(e) => setDefaults({ ...defaults, maxPages: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Sugestões de localidade (uma por linha)" htmlFor="def-locations">
          <textarea id="def-locations" rows={4} value={locationsText} onChange={(e) => setLocationsText(e.target.value)} className={textareaClass} />
        </Field>

        <FeedbackBanner feedback={feedback} />
        <div className="flex justify-end">
          <SaveButton saving={saving} onClick={handleSave} />
        </div>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// 4. Custom role presets
// ---------------------------------------------------------------------------

const CustomRolesSection: FC<SettingsPanelProps> = ({ settings, onSaved }) => {
  const { saving, feedback, setFeedback, save } = useSection(onSaved);
  const [roles, setRoles] = useState<RoleOption[]>(settings.customRoles);

  const updateRole = (index: number, patch: Partial<RoleOption>) => {
    setRoles(roles.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const addRole = () => setRoles([...roles, { value: '', label: '', booleanTerms: '' }]);

  const copyBuiltIn = (value: string) => {
    const base = BUILT_IN_ROLE_OPTIONS.find((r) => r.value === value);
    if (base) setRoles([...roles, { ...base }]);
  };

  const handleSave = () => {
    const incomplete = roles.some((r) => !r.label.trim() || !r.booleanTerms.trim());
    if (incomplete) {
      setFeedback({ type: 'error', message: 'Preencha o nome e os termos booleanos de todos os cargos (ou remova as linhas vazias).' });
      return;
    }
    save(
      { customRoles: roles.map((r) => ({ ...r, value: r.value || slugifyRoleLabel(r.label) })) },
      'Cargos personalizados salvos. Eles já aparecem no multiseletor da busca.'
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          Cargos Personalizados
        </CardTitle>
        <CardDescription className="text-xs mt-1">
          Crie seus próprios atalhos para o multiseletor de cargos (ex.: &quot;Java / Spring&quot;, &quot;Product
          Designer&quot;) ou ajuste os termos de um cargo padrão. Um cargo personalizado com o mesmo identificador de um
          padrão o substitui.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {roles.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Nenhum cargo personalizado ainda.</p>
        )}

        {roles.map((role, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-2 items-start border rounded-md p-2.5 bg-muted/20">
            <input
              value={role.label}
              onChange={(e) => updateRole(index, { label: e.target.value })}
              placeholder="Nome (ex.: Java / Spring)"
              className={inputClass}
            />
            <input
              value={role.booleanTerms}
              onChange={(e) => updateRole(index, { booleanTerms: e.target.value })}
              placeholder={'"Java Developer" OR "Desenvolvedor Java" OR "Spring Boot"'}
              className={`${inputClass} font-mono`}
            />
            <Button variant="ghost" size="sm" onClick={() => setRoles(roles.filter((_, i) => i !== index))} className="h-9 text-muted-foreground hover:text-rose-600" title="Remover">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={addRole} className="text-xs gap-1">
            <Plus className="w-3.5 h-3.5" /> Novo cargo
          </Button>
          <select
            value=""
            onChange={(e) => copyBuiltIn(e.target.value)}
            className={`${inputClass} w-auto`}
            aria-label="Copiar um cargo padrão para editar"
          >
            <option value="">Copiar cargo padrão para editar...</option>
            {BUILT_IN_ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <KeyRound className="w-3 h-3" />
          Use aspas para termos exatos e <code className="bg-muted px-1 rounded">OR</code> entre variações, como na
          busca booleana do LinkedIn.
        </p>

        <FeedbackBanner feedback={feedback} />
        <div className="flex justify-end">
          <SaveButton saving={saving} onClick={handleSave} />
        </div>
      </CardContent>
    </Card>
  );
};
