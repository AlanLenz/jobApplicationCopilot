"use client";

import { FC, useMemo, useState, ChangeEvent, KeyboardEvent } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Briefcase,
  Clock,
  MapPin,
  Laptop,
  Link2,
  SlidersHorizontal,
  Layers,
  Plus,
  X,
  Check,
  Code2,
} from 'lucide-react';

export interface SearchFilterState {
  roles: string[];
  seniority: string;
  timeRangeSeconds: number;
  location: string;
  workplaceType: string;
}

interface SearchFiltersProps {
  filters: SearchFilterState;
  onChange: (newFilters: SearchFilterState) => void;
  disabled?: boolean;
}

export const ROLE_OPTIONS = [
  {
    value: 'software_engineer',
    label: 'Software Engineer / Dev Geral',
    booleanTerms: '"Desenvolvedor" OR "Developer" OR "Software Engineer" OR "Engenheiro de Software"',
  },
  {
    value: 'fullstack',
    label: 'Full Stack',
    booleanTerms: '"Full Stack" OR "Fullstack" OR "Desenvolvedor Full Stack" OR "Full Stack Developer" OR "Full Stack Engineer"',
  },
  {
    value: 'frontend',
    label: 'Front-end',
    booleanTerms: '"Frontend" OR "Front-end" OR "Desenvolvedor Front-end" OR "Frontend Developer" OR "Frontend Engineer" OR "React Developer"',
  },
  {
    value: 'backend',
    label: 'Back-end',
    booleanTerms: '"Backend" OR "Back-end" OR "Desenvolvedor Back-end" OR "Backend Developer" OR "Backend Engineer"',
  },
  {
    value: 'mobile',
    label: 'Mobile (RN / Flutter / iOS / Android)',
    booleanTerms: '"Mobile Developer" OR "Desenvolvedor Mobile" OR "React Native" OR "Flutter" OR "iOS Developer" OR "Android Developer"',
  },
  {
    value: 'devops',
    label: 'DevOps / Cloud / SRE',
    booleanTerms: '"DevOps" OR "SRE" OR "Site Reliability Engineer" OR "Cloud Engineer" OR "Platform Engineer"',
  },
  {
    value: 'data',
    label: 'Dados (Data Eng / Science / Analytics)',
    booleanTerms: '"Data Engineer" OR "Engenheiro de Dados" OR "Data Scientist" OR "Cientista de Dados" OR "Data Analyst"',
  },
  {
    value: 'ai_ml',
    label: 'IA / Machine Learning',
    booleanTerms: '"AI Engineer" OR "Machine Learning Engineer" OR "Engenheiro de IA" OR "LLM" OR "GenAI"',
  },
  {
    value: 'qa',
    label: 'QA / Automação de Testes',
    booleanTerms: '"QA" OR "Quality Assurance" OR "Analista de Testes" OR "Test Automation" OR "SDET"',
  },
  {
    value: 'tech_lead',
    label: 'Tech Lead / Arquitetura',
    booleanTerms: '"Tech Lead" OR "Software Architect" OR "Arquiteto de Software" OR "Staff Engineer" OR "Engineering Manager"',
  },
] as const;

export const ROLE_BOOLEAN_MAP: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r.value, r.booleanTerms])
);

export const ROLE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r.value, r.label])
);

export const SENIORITY_OPTIONS = [
  { value: 'all', label: 'Todos (Qualquer Senioridade)' },
  { value: 'internship', label: 'Estágio / Trainee' },
  { value: 'junior', label: 'Júnior (Entry-level)' },
  { value: 'pleno', label: 'Pleno (Mid-level)' },
  { value: 'jr-pleno', label: 'Júnior & Pleno' },
  { value: 'senior', label: 'Sênior / Lead / Staff' },
] as const;

export const TIME_RANGE_OPTIONS = [
  { value: 3600, label: 'Última 1 hora' },
  { value: 43200, label: 'Últimas 12 horas' },
  { value: 86400, label: 'Últimas 24 horas (Padrão)' },
  { value: 259200, label: 'Últimos 3 dias' },
  { value: 604800, label: 'Última semana (7 dias)' },
  { value: 2592000, label: 'Último mês (30 dias)' },
  { value: 0, label: 'Qualquer data' },
] as const;

export const WORKPLACE_OPTIONS = [
  { value: 'all', label: 'Todos os modelos' },
  { value: 'remote', label: 'Remoto' },
  { value: 'hybrid', label: 'Híbrido' },
  { value: 'onsite', label: 'Presencial' },
] as const;

export const LOCATION_SUGGESTIONS = [
  'Worldwide',
  'Brazil',
  'São Paulo, Brazil',
  'Cascavel, Paraná, Brazil',
  'United States',
  'European Union',
  'Portugal',
];

export function buildRolesBooleanClause(roles: string[]): string {
  const activeRoles = roles && roles.length > 0 ? roles : ['software_engineer'];
  const parts = activeRoles
    .map((r) => r.trim())
    .filter(Boolean)
    .map((roleKey) => {
      if (ROLE_BOOLEAN_MAP[roleKey]) {
        return ROLE_BOOLEAN_MAP[roleKey];
      }
      const cleanCustom = roleKey.replace(/"/g, '').trim();
      return `"${cleanCustom}"`;
    });

  if (parts.length === 0) {
    return `(${ROLE_BOOLEAN_MAP.software_engineer})`;
  }

  return `(${parts.join(' OR ')})`;
}

export function buildBooleanQueryFromFilters(filters: SearchFilterState): {
  finalKeywords: string;
  f_E: string;
} {
  const { roles, seniority } = filters;
  const roleClause = buildRolesBooleanClause(roles);
  let finalKeywords = roleClause;
  let f_E = '';

  switch (seniority) {
    case 'internship':
      finalKeywords = `${roleClause} AND ("Estágio" OR "Estagiário" OR "Intern" OR "Internship" OR "Trainee")`;
      f_E = '1';
      break;
    case 'junior':
      finalKeywords = `${roleClause} AND ("Junior" OR "Júnior" OR "Jr" OR "Entry Level" OR "Entry-level") NOT ("Senior" OR "Sr" OR "Pleno" OR "Lead" OR "Staff")`;
      f_E = '2';
      break;
    case 'pleno':
      finalKeywords = `${roleClause} AND ("Pleno" OR "Mid level" OR "Mid-level" OR "Middle") NOT ("Senior" OR "Sr" OR "Lead" OR "Principal" OR "Staff")`;
      f_E = '3,4';
      break;
    case 'jr-pleno':
      finalKeywords = `${roleClause} AND ("Junior" OR "Jr" OR "Pleno" OR "Mid level" OR "Mid-level") NOT ("Senior" OR "Sr" OR "Lead" OR "Principal" OR "Staff")`;
      f_E = '2,3,4';
      break;
    case 'senior':
      finalKeywords = `${roleClause} AND ("Senior" OR "Sênior" OR "Sr" OR "Lead" OR "Staff" OR "Principal" OR "Especialista")`;
      f_E = '4,5';
      break;
    case 'all':
    default:
      finalKeywords = roleClause;
      f_E = '';
      break;
  }

  return { finalKeywords, f_E };
}

export function buildPreviewLinkedInUrl(filters: SearchFilterState): string {
  const { location, timeRangeSeconds, workplaceType } = filters;
  const { finalKeywords, f_E } = buildBooleanQueryFromFilters(filters);

  let f_WT = '';
  switch (workplaceType) {
    case 'onsite':
      f_WT = '1';
      break;
    case 'remote':
      f_WT = '2';
      break;
    case 'hybrid':
      f_WT = '3';
      break;
    default:
      f_WT = '';
      break;
  }

  const params = new URLSearchParams();
  params.set('keywords', finalKeywords);
  if (location.trim()) {
    params.set('location', location.trim());
  }
  if (timeRangeSeconds > 0) {
    params.set('f_TPR', `r${timeRangeSeconds}`);
  }
  if (f_E) {
    params.set('f_E', f_E);
  }
  if (f_WT) {
    params.set('f_WT', f_WT);
  }

  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

export const SearchFilters: FC<SearchFiltersProps> = ({ filters, onChange, disabled = false }) => {
  const [customRoleInput, setCustomRoleInput] = useState('');

  const { finalKeywords } = useMemo(() => buildBooleanQueryFromFilters(filters), [filters]);
  const previewUrl = useMemo(() => buildPreviewLinkedInUrl(filters), [filters]);

  const selectedRoles = filters.roles?.length > 0 ? filters.roles : ['software_engineer'];

  const toggleRole = (roleValue: string) => {
    if (disabled) return;
    const exists = selectedRoles.includes(roleValue);
    let nextRoles: string[];
    if (exists) {
      nextRoles = selectedRoles.filter((r) => r !== roleValue);
      if (nextRoles.length === 0) {
        nextRoles = ['software_engineer']; // Keep at least 1 role active
      }
    } else {
      nextRoles = [...selectedRoles, roleValue];
    }
    onChange({ ...filters, roles: nextRoles });
  };

  const handleAddCustomRole = () => {
    const trimmed = customRoleInput.trim().replace(/"/g, '');
    if (!trimmed) return;
    if (!selectedRoles.includes(trimmed)) {
      onChange({ ...filters, roles: [...selectedRoles, trimmed] });
    }
    setCustomRoleInput('');
  };

  const handleCustomRoleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustomRole();
    }
  };

  const removeCustomRole = (roleValue: string) => {
    const nextRoles = selectedRoles.filter((r) => r !== roleValue);
    onChange({
      ...filters,
      roles: nextRoles.length > 0 ? nextRoles : ['software_engineer'],
    });
  };

  const handleSeniorityChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, seniority: e.target.value });
  };

  const handleTimeRangeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, timeRangeSeconds: Number(e.target.value) });
  };

  const handleLocationChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, location: e.target.value });
  };

  const handleWorkplaceChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, workplaceType: e.target.value });
  };

  // Custom roles that aren't in the preset ROLE_OPTIONS list
  const customRoles = selectedRoles.filter((r) => !ROLE_BOOLEAN_MAP[r]);

  return (
    <Card className="border bg-card/60 shadow-sm">
      <CardContent className="p-4 md:p-5 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold tracking-tight uppercase text-muted-foreground">
              Personalização da Busca Booleana (LinkedIn)
            </h2>
          </div>
          <Badge variant="secondary" className="text-[11px] font-normal">
            {selectedRoles.length} {selectedRoles.length === 1 ? 'cargo selecionado' : 'cargos selecionados'}
          </Badge>
        </div>

        {/* Multiseletor de Cargos (Estrutura Booleana) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Layers className="w-3.5 h-3.5 text-primary" />
              Cargos Alvo (Multiseletor Booleano PT/EN)
            </label>
            <span className="text-[11px] text-muted-foreground">
              Selecione um ou mais cargos para combinar com operador <code className="bg-muted px-1 rounded">OR</code>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((role) => {
              const isSelected = selectedRoles.includes(role.value);
              return (
                <button
                  key={role.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleRole(role.value)}
                  title={`Termos booleanos: ${role.booleanTerms}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background hover:bg-muted/70 text-foreground border-input'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 shrink-0" />}
                  <span>{role.label}</span>
                </button>
              );
            })}

            {/* Custom added role tags */}
            {customRoles.map((customRole) => (
              <span
                key={customRole}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-primary-foreground border border-primary shadow-sm"
              >
                <span>&quot;{customRole}&quot;</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeCustomRole(customRole)}
                  className="hover:opacity-75"
                  aria-label={`Remover ${customRole}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          {/* Adicionar termo/cargo específico à expressão booleana */}
          <div className="flex items-center gap-2 max-w-md pt-1">
            <input
              type="text"
              placeholder="Adicionar cargo específico na busca booleana (ex: Java Developer, Node.js)..."
              value={customRoleInput}
              onChange={(e) => setCustomRoleInput(e.target.value)}
              onKeyDown={handleCustomRoleKeyDown}
              disabled={disabled}
              className="h-8 flex-1 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || !customRoleInput.trim()}
              onClick={handleAddCustomRole}
              className="h-8 text-xs gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Incluir no OR
            </Button>
          </div>
        </div>

        {/* Filtros Complementares */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t">
          {/* 1. Senioridade */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-seniority" className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Briefcase className="w-3.5 h-3.5 text-primary" />
              Senioridade do Cargo
            </label>
            <select
              id="filter-seniority"
              value={filters.seniority}
              onChange={handleSeniorityChange}
              disabled={disabled}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {SENIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Tempo de listagem */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-time" className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Clock className="w-3.5 h-3.5 text-primary" />
              Tempo de Publicação
            </label>
            <select
              id="filter-time"
              value={filters.timeRangeSeconds}
              onChange={handleTimeRangeChange}
              disabled={disabled}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {TIME_RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Localidade */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-location" className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              Localidade
            </label>
            <input
              id="filter-location"
              type="text"
              list="location-suggestions"
              placeholder="Ex: Brazil, Worldwide, São Paulo..."
              value={filters.location}
              onChange={handleLocationChange}
              disabled={disabled}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <datalist id="location-suggestions">
              {LOCATION_SUGGESTIONS.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </div>

          {/* 4. Modelo de Trabalho */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-workplace" className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Laptop className="w-3.5 h-3.5 text-primary" />
              Modelo de Trabalho
            </label>
            <select
              id="filter-workplace"
              value={filters.workplaceType}
              onChange={handleWorkplaceChange}
              disabled={disabled}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {WORKPLACE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Preview da Expressão Booleana e URL de busca do LinkedIn */}
        <div className="pt-3 border-t space-y-2 text-[11px] text-muted-foreground">
          <div className="flex items-start gap-1.5 min-w-0">
            <Code2 className="w-3.5 h-3.5 shrink-0 text-primary mt-0.5" />
            <span className="font-semibold shrink-0">Query Booleana:</span>
            <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] break-all flex-1 text-foreground/90">
              {finalKeywords}
            </code>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Link2 className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span className="font-semibold shrink-0">URL da Busca:</span>
              <code className="truncate bg-muted px-1.5 py-0.5 rounded text-[10px] flex-1">
                {previewUrl}
              </code>
            </div>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium shrink-0 self-end sm:self-center"
            >
              Testar no LinkedIn ↗
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
