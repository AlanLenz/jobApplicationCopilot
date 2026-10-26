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
import {
  DEFAULT_LOCATION_SUGGESTIONS,
  DEFAULT_SEARCH_FILTERS,
  RoleOption,
  SENIORITY_OPTIONS,
  SearchFilterState,
  TIME_RANGE_OPTIONS,
  WORKPLACE_OPTIONS,
  buildBooleanQueryFromFilters,
  buildPreviewLinkedInUrl,
  getRoleOptions,
} from '@/lib/search';

export type { SearchFilterState } from '@/lib/search';

interface SearchFiltersProps {
  filters: SearchFilterState;
  onChange: (newFilters: SearchFilterState) => void;
  disabled?: boolean;
  /** Role presets created by the user in "Configurações". */
  customRoles?: RoleOption[];
  locationSuggestions?: string[];
}

export const SearchFilters: FC<SearchFiltersProps> = ({
  filters,
  onChange,
  disabled = false,
  customRoles = [],
  locationSuggestions = DEFAULT_LOCATION_SUGGESTIONS,
}) => {
  const [customRoleInput, setCustomRoleInput] = useState('');

  const roleOptions = useMemo(() => getRoleOptions(customRoles), [customRoles]);
  const { finalKeywords } = useMemo(() => buildBooleanQueryFromFilters(filters, customRoles), [filters, customRoles]);
  const previewUrl = useMemo(() => buildPreviewLinkedInUrl(filters, customRoles), [filters, customRoles]);

  const fallbackRoles = DEFAULT_SEARCH_FILTERS.roles;
  const selectedRoles = filters.roles?.length > 0 ? filters.roles : fallbackRoles;

  const toggleRole = (roleValue: string) => {
    if (disabled) return;
    const exists = selectedRoles.includes(roleValue);
    let nextRoles: string[];
    if (exists) {
      nextRoles = selectedRoles.filter((r) => r !== roleValue);
      if (nextRoles.length === 0) {
        nextRoles = fallbackRoles; // Keep at least 1 role active
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
      roles: nextRoles.length > 0 ? nextRoles : fallbackRoles,
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

  // Free-text terms typed in the search bar (not a built-in or saved preset)
  const knownRoleValues = new Set(roleOptions.map((r) => r.value));
  const adHocRoles = selectedRoles.filter((r) => !knownRoleValues.has(r));

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
            {roleOptions.map((role) => {
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
            {adHocRoles.map((customRole) => (
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
              {locationSuggestions.map((loc) => (
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
