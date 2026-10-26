// LinkedIn boolean search building blocks, shared by the dashboard (preview) and the
// scraper API route (execution), so both always use exactly the same query.

export interface SearchFilterState {
  roles: string[];
  seniority: string;
  timeRangeSeconds: number;
  location: string;
  workplaceType: string;
}

export interface RoleOption {
  value: string;
  label: string;
  booleanTerms: string;
}

export const BUILT_IN_ROLE_OPTIONS: RoleOption[] = [
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
];

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
  { value: 86400, label: 'Últimas 24 horas' },
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

export const DEFAULT_LOCATION_SUGGESTIONS = [
  'Worldwide',
  'Brazil',
  'São Paulo, Brazil',
  'United States',
  'European Union',
  'Portugal',
];

export const DEFAULT_SEARCH_FILTERS: SearchFilterState = {
  roles: ['software_engineer'],
  seniority: 'all',
  timeRangeSeconds: 86400,
  location: 'Worldwide',
  workplaceType: 'all',
};

export const DEFAULT_MAX_PAGES = 3;
export const MAX_PAGES_LIMIT = 10;

/** Built-in roles plus the user's own presets (custom presets win on id clashes). */
export function getRoleOptions(customRoles: RoleOption[] = []): RoleOption[] {
  const customIds = new Set(customRoles.map((r) => r.value));
  return [...BUILT_IN_ROLE_OPTIONS.filter((r) => !customIds.has(r.value)), ...customRoles];
}

export function getRoleLabel(roleKey: string, customRoles: RoleOption[] = []): string {
  return getRoleOptions(customRoles).find((r) => r.value === roleKey)?.label || roleKey;
}

export function buildRolesBooleanClause(roles: string[], customRoles: RoleOption[] = []): string {
  const termsByRole = new Map(getRoleOptions(customRoles).map((r) => [r.value, r.booleanTerms]));
  const activeRoles = roles && roles.length > 0 ? roles : DEFAULT_SEARCH_FILTERS.roles;
  const parts = activeRoles
    .map((r) => r.trim())
    .filter(Boolean)
    .map((roleKey) => termsByRole.get(roleKey) ?? `"${roleKey.replace(/"/g, '').trim()}"`);

  if (parts.length === 0) {
    return `(${BUILT_IN_ROLE_OPTIONS[0].booleanTerms})`;
  }
  return `(${parts.join(' OR ')})`;
}

export function buildBooleanQueryFromFilters(
  filters: SearchFilterState,
  customRoles: RoleOption[] = []
): { finalKeywords: string; f_E: string } {
  const roleClause = buildRolesBooleanClause(filters.roles, customRoles);

  switch (filters.seniority) {
    case 'internship':
      return {
        finalKeywords: `${roleClause} AND ("Estágio" OR "Estagiário" OR "Intern" OR "Internship" OR "Trainee")`,
        f_E: '1',
      };
    case 'junior':
      return {
        finalKeywords: `${roleClause} AND ("Junior" OR "Júnior" OR "Jr" OR "Entry Level" OR "Entry-level") NOT ("Senior" OR "Sr" OR "Pleno" OR "Lead" OR "Staff")`,
        f_E: '2',
      };
    case 'pleno':
      return {
        finalKeywords: `${roleClause} AND ("Pleno" OR "Mid level" OR "Mid-level" OR "Middle") NOT ("Senior" OR "Sr" OR "Lead" OR "Principal" OR "Staff")`,
        f_E: '3,4',
      };
    case 'jr-pleno':
      return {
        finalKeywords: `${roleClause} AND ("Junior" OR "Jr" OR "Pleno" OR "Mid level" OR "Mid-level") NOT ("Senior" OR "Sr" OR "Lead" OR "Principal" OR "Staff")`,
        f_E: '2,3,4',
      };
    case 'senior':
      return {
        finalKeywords: `${roleClause} AND ("Senior" OR "Sênior" OR "Sr" OR "Lead" OR "Staff" OR "Principal" OR "Especialista")`,
        f_E: '4,5',
      };
    case 'all':
    default:
      return { finalKeywords: roleClause, f_E: '' };
  }
}

export function buildPreviewLinkedInUrl(filters: SearchFilterState, customRoles: RoleOption[] = []): string {
  const { location, timeRangeSeconds, workplaceType } = filters;
  const { finalKeywords, f_E } = buildBooleanQueryFromFilters(filters, customRoles);

  // LinkedIn f_WT codes: 1=On-site, 2=Remote, 3=Hybrid
  const f_WT = { onsite: '1', remote: '2', hybrid: '3' }[workplaceType] || '';

  const params = new URLSearchParams();
  params.set('keywords', finalKeywords);
  if (location.trim()) params.set('location', location.trim());
  if (timeRangeSeconds > 0) params.set('f_TPR', `r${timeRangeSeconds}`);
  if (f_E) params.set('f_E', f_E);
  if (f_WT) params.set('f_WT', f_WT);

  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

/** Turns a free-text label into a stable id for a custom role preset. */
export function slugifyRoleLabel(label: string): string {
  const slug = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `custom_${slug || Date.now()}`;
}
