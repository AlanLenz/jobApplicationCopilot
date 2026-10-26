"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SearchFilters } from '@/components/SearchFilters';
import {
  DEFAULT_MAX_PAGES,
  DEFAULT_SEARCH_FILTERS,
  SearchFilterState,
  buildPreviewLinkedInUrl,
  getRoleLabel,
  SENIORITY_OPTIONS,
  WORKPLACE_OPTIONS,
  TIME_RANGE_OPTIONS,
} from '@/lib/search';
import type { UserSettingsView } from '@/lib/settings-types';
import { AuthModal, AuthUser } from '@/components/AuthModal';
import { UserProfilePanel } from '@/components/UserProfilePanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import {
  Building2,
  FileText,
  Mail,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Printer,
  Terminal,
  Loader2,
  UserCheck,
  LogOut,
  ShieldCheck,
  History,
  CheckCircle2,
  BriefcaseBusiness,
  UserCog,
  Trash2,
  RotateCcw,
  Calendar,
  Settings2,
  Target,
} from 'lucide-react';

type Job = {
  id: string;
  title: string;
  company: string;
  url: string;
  description: string;
  requirements: string | null;
  status: string;
  matchScore: number | null;
  matchReason: string | null;
  customCoverLetter: string | null;
  createdAt: string;
};

type AppliedJobRecord = {
  id: string;
  jobId: string | null;
  title: string;
  company: string | null;
  url: string;
  description: string | null;
  atsScore: number | null;
  appliedAt: string;
  hasResume: boolean;
  hasCoverLetter: boolean;
  customResume: {
    text: string;
    html: string;
    atsScore?: number;
    matchedKeywords?: string[];
  } | null;
  coverLetter: {
    text: string;
    html: string;
  } | null;
};

type SearchHistoryRecord = {
  id: string;
  roles: string[];
  seniority: string;
  location: string;
  workplaceType: string;
  timeRangeSeconds: number;
  booleanQuery: string;
  searchUrl: string;
  createdAt: string;
};

type DocModalData = {
  type: 'resume' | 'cover_letter';
  jobId: string;
  jobTitle: string;
  company: string;
  text: string;
  html: string;
  atsScore?: number;
  matchedKeywords?: string[];
  profileSource?: string;
};

type ScraperStatus = {
  status: 'idle' | 'running' | 'completed' | 'error';
  startedAt: string | null;
  endedAt: string | null;
  logs: string[];
  message: string;
};

type ActiveMainTab = 'inbox' | 'applied' | 'searches' | 'profile' | 'settings';

type ApiErrorPayload = { error?: string; code?: string };

function DashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filters in the URL win; otherwise the user's saved defaults are applied once settings load.
  const hasUrlFilters = useRef(searchParams.has('roles'));

  // Initialize filter state from URL query params
  const [filters, setFilters] = useState<SearchFilterState>(() => {
    const defaults = DEFAULT_SEARCH_FILTERS;
    const rolesParam = searchParams.get('roles');
    const roles = rolesParam
      ? rolesParam.split(',').map((s) => s.trim()).filter(Boolean)
      : defaults.roles;
    const seniority = searchParams.get('seniority') || defaults.seniority;
    const timeParam = searchParams.get('timeRange');
    const timeRangeSeconds = timeParam !== null ? Number(timeParam) : defaults.timeRangeSeconds;
    const location = searchParams.get('location') ?? defaults.location;
    const workplaceType = searchParams.get('workplace') || defaults.workplaceType;

    return {
      roles: roles.length > 0 ? roles : defaults.roles,
      seniority,
      timeRangeSeconds: Number.isNaN(timeRangeSeconds) ? defaults.timeRangeSeconds : timeRangeSeconds,
      location,
      workplaceType,
    };
  });

  // Sync filters state changes back to the browser URL
  const handleFiltersChange = useCallback(
    (newFilters: SearchFilterState) => {
      setFilters(newFilters);
      const params = new URLSearchParams(searchParams.toString());
      params.set('roles', (newFilters.roles || DEFAULT_SEARCH_FILTERS.roles).join(','));
      params.set('seniority', newFilters.seniority);
      params.set('timeRange', String(newFilters.timeRangeSeconds));
      params.set('location', newFilters.location);
      params.set('workplace', newFilters.workplaceType);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Navigation tab
  const [mainTab, setMainTab] = useState<ActiveMainTab>('inbox');

  // Auth & User state
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');

  // User preferences from the "Configurações" tab (null when logged out)
  const [settings, setSettings] = useState<UserSettingsView | null>(null);
  const customRoles = settings?.customRoles ?? [];

  // AI job evaluation progress
  const [evaluating, setEvaluating] = useState<{ done: number; remaining: number } | null>(null);
  const [evaluationMessage, setEvaluationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Data lists
  const [jobs, setJobs] = useState<Job[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<AppliedJobRecord[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Scraper state
  const [scraperStatus, setScraperStatus] = useState<ScraperStatus>({
    status: 'idle',
    startedAt: null,
    endedAt: null,
    logs: [],
    message: 'Scraper idle',
  });
  const [showLogsDialog, setShowLogsDialog] = useState(false);

  // Generation Modal state
  const [activeDoc, setActiveDoc] = useState<DocModalData | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'text'>('preview');
  const [isGenerating, setIsGenerating] = useState<{ id: string; type: 'resume' | 'cover_letter' } | null>(null);
  const [copied, setCopied] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchAuthUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error('Failed to check auth session:', e);
    }
  }, []);

  const fetchJobs = useCallback(() => {
    fetch('/api/jobs?status=pending_evaluation')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch jobs');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setJobs(data);
        } else {
          setJobs([]);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setJobs([]);
        setLoading(false);
      });
  }, []);

  const fetchUserHistories = useCallback(async () => {
    try {
      const [appsRes, searchesRes] = await Promise.all([
        fetch('/api/applications'),
        fetch('/api/searches'),
      ]);
      if (appsRes.ok) {
        const appsData = await appsRes.json();
        setAppliedJobs(appsData.applications || []);
      }
      if (searchesRes.ok) {
        const searchesData = await searchesRes.json();
        setSearchHistory(searchesData.searches || []);
      }
    } catch (e) {
      console.error('Failed to fetch user histories:', e);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      setSettings(res.ok ? await res.json() : null);
    } catch (e) {
      console.error('Failed to fetch settings:', e);
    }
  }, []);

  useEffect(() => {
    fetchAuthUser();
    fetchJobs();
    fetchUserHistories();
  }, [fetchAuthUser, fetchJobs, fetchUserHistories]);

  useEffect(() => {
    if (user) {
      fetchSettings();
    } else {
      setSettings(null);
    }
  }, [user?.id, fetchSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply the user's saved search defaults once, unless the URL already carries filters
  const appliedSavedDefaults = useRef(false);
  useEffect(() => {
    if (!settings || appliedSavedDefaults.current) return;
    appliedSavedDefaults.current = true;
    if (hasUrlFilters.current) return;
    const { roles, seniority, timeRangeSeconds, location, workplaceType } = settings.searchDefaults;
    handleFiltersChange({ roles, seniority, timeRangeSeconds, location, workplaceType });
  }, [settings, handleFiltersChange]);

  // Poll scraper status when it's running
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (scraperStatus.status === 'running') {
      interval = setInterval(() => {
        fetch('/api/scraper')
          .then((res) => res.json())
          .then((data: ScraperStatus) => {
            setScraperStatus(data);
            if (data.status === 'completed' || data.status === 'error') {
              fetchJobs();
              fetchUserHistories();
            }
          })
          .catch(console.error);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [scraperStatus.status, fetchJobs, fetchUserHistories]);

  useEffect(() => {
    if (showLogsDialog) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scraperStatus.logs, showLogsDialog]);

  const handleLogout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    setUser(null);
    setSettings(null);
    setAppliedJobs([]);
    setSearchHistory([]);
    if (mainTab !== 'inbox') {
      setMainTab('inbox');
    }
  };

  // Start scraper with custom filter parameters (and record in SearchHistory)
  const handleStartScraper = async (overrideFilters?: SearchFilterState) => {
    const activeFilters = overrideFilters || filters;
    try {
      const targetUrl = buildPreviewLinkedInUrl(activeFilters, customRoles);
      setScraperStatus((prev) => ({
        ...prev,
        status: 'running',
        message: 'Starting scraper with custom boolean filters...',
        logs: [
          `[Client] Launching LinkedIn scraper...`,
          `[Client] Search URL: ${targetUrl}`,
        ],
      }));

      const res = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roles: activeFilters.roles,
          seniority: activeFilters.seniority,
          timeRangeSeconds: activeFilters.timeRangeSeconds,
          location: activeFilters.location,
          workplaceType: activeFilters.workplaceType,
          maxPages: settings?.searchDefaults.maxPages ?? DEFAULT_MAX_PAGES,
        }),
      });

      const data = await res.json();
      if (data.state) {
        setScraperStatus(data.state);
      }
      fetchUserHistories();
    } catch (e: any) {
      console.error('Failed to trigger scraper:', e);
      setScraperStatus((prev) => ({
        ...prev,
        status: 'error',
        message: e.message || 'Failed to start scraper',
      }));
    }
  };

  // Turns API error codes into a shortcut to the screen that fixes the problem
  const handleApiError = (data: ApiErrorPayload, context: string) => {
    const message = `${context}: ${data.error || 'erro desconhecido'}`;
    if (data.code === 'AUTH_REQUIRED') {
      setAuthInitialMode('login');
      setAuthModalOpen(true);
    } else if (data.code === 'PROFILE_REQUIRED') {
      alert(message);
      setMainTab('profile');
    } else if (data.code === 'AI_NOT_CONFIGURED') {
      if (confirm(`${message}\n\nAbrir a aba Configurações agora?`)) {
        if (user) {
          setMainTab('settings');
        } else {
          setAuthInitialMode('login');
          setAuthModalOpen(true);
        }
      }
    } else {
      alert(message);
    }
  };

  // Score pending jobs with the configured AI, in small batches until none are left
  const handleEvaluateJobs = async () => {
    if (!user) {
      setAuthInitialMode('login');
      setAuthModalOpen(true);
      return;
    }
    setEvaluationMessage(null);
    setEvaluating({ done: 0, remaining: jobs.filter((j) => j.matchScore === null).length });
    let done = 0;
    let discarded = 0;
    try {
      for (;;) {
        const res = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 5 }),
        });
        const data = await res.json();
        if (!res.ok) {
          handleApiError(data, 'Erro ao avaliar vagas');
          break;
        }
        done += data.evaluated.length;
        discarded += data.evaluated.filter((e: { discarded: boolean }) => e.discarded).length;
        setEvaluating({ done, remaining: data.remaining });
        fetchJobs();
        if (data.failures.length > 0) {
          setEvaluationMessage({ type: 'error', text: `Avaliação interrompida: ${data.failures[0].error}` });
          break;
        }
        if (data.remaining === 0 || data.evaluated.length === 0) {
          setEvaluationMessage({
            type: 'success',
            text: `${done} vaga(s) avaliada(s)${discarded > 0 ? `, ${discarded} descartada(s) abaixo da nota mínima` : ''}.`,
          });
          break;
        }
      }
    } catch (e) {
      setEvaluationMessage({ type: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setEvaluating(null);
    }
  };

  // Generate Resume or Cover Letter using user's encrypted profile
  const handleGenerate = async (
    job: { id: string; title: string; company: string | null },
    type: 'resume' | 'cover_letter',
    regenerate = false
  ) => {
    setIsGenerating({ id: job.id, type });
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, type, regenerate }),
      });

      const data = await res.json();
      if (!res.ok) {
        handleApiError(data, `Erro ao gerar ${type === 'resume' ? 'Currículo' : 'Cover Letter'}`);
        return;
      }

      setActiveDoc({
        type,
        jobId: job.id,
        jobTitle: job.title,
        company: job.company || 'Company',
        text: data.text,
        html: data.html,
        atsScore: data.atsScore,
        matchedKeywords: data.matchedKeywords,
        profileSource: data.profileSource,
      });
      setActiveTab('preview');
      fetchUserHistories();
    } catch (err: any) {
      alert(`Erro ao gerar ${type === 'resume' ? 'Currículo' : 'Cover Letter'}: ${err.message}`);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleCopyText = () => {
    if (!activeDoc) return;
    navigator.clipboard.writeText(activeDoc.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    if (!activeDoc) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(activeDoc.html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
    }
  };

  // Reject a job -> Immediately deletes from DB (rejected jobs are NOT kept registered)
  const handleReject = async (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    await fetch('/api/jobs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'rejected' }),
    });
  };

  // Apply to a job -> Opens posting URL and registers in AppliedJob history
  const handleApplyAndRegister = async (job: Job, openUrl = true) => {
    if (openUrl) {
      window.open(job.url, '_blank');
    }

    if (!user) {
      setAuthInitialMode('register');
      setAuthModalOpen(true);
      return;
    }

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          title: job.title,
          company: job.company,
          url: job.url,
          description: job.description,
          atsScore: job.matchScore,
        }),
      });

      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== job.id));
        fetchUserHistories();
      }
    } catch (e) {
      console.error('Failed to register application:', e);
    }
  };

  const handleDeleteAppliedJob = async (id: string) => {
    setAppliedJobs((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/applications?id=${id}`, { method: 'DELETE' });
  };

  const handleDeleteSearchRecord = async (id: string) => {
    setSearchHistory((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/searches?id=${id}`, { method: 'DELETE' });
  };

  const handleRestoreSearch = (record: SearchHistoryRecord, runImmediately = false) => {
    const restored: SearchFilterState = {
      roles: record.roles?.length > 0 ? record.roles : DEFAULT_SEARCH_FILTERS.roles,
      seniority: record.seniority || 'all',
      timeRangeSeconds: record.timeRangeSeconds ?? 86400,
      location: record.location || 'Worldwide',
      workplaceType: record.workplaceType || 'all',
    };
    handleFiltersChange(restored);
    setMainTab('inbox');
    if (runImmediately) {
      handleStartScraper(restored);
    }
  };

  // Highest AI match first; jobs not evaluated yet keep their newest-first order at the end
  const minScore = settings?.evaluation.minScore ?? 70;
  const sortedJobs = [...jobs].sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm font-medium">Carregando oportunidades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header & Account Bar */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-extrabold tracking-tight">Job Application Copilot</h1>
              <Badge variant="outline" className="text-xs uppercase px-2 py-0.5">
                AI-Powered
              </Badge>
              <Badge
                variant="secondary"
                className="text-[11px] gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> AES-256-GCM Protected
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Busca booleana inteligente por cargos, geração de Currículo ATS e Cover Letter sob medida com dados criptografados.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* User Account Status */}
            {user ? (
              <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-lg border text-xs">
                <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="leading-tight">
                  <div className="font-bold text-foreground">{user.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {user.hasResume ? 'Perfil Criptografado Ativo' : 'Sem currículo enviado'}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  title="Sair da conta"
                  className="h-7 px-2 text-muted-foreground hover:text-rose-600"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAuthInitialMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="text-xs"
                >
                  Entrar
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setAuthInitialMode('register');
                    setAuthModalOpen(true);
                  }}
                  className="text-xs font-semibold"
                >
                  Criar Conta Segura
                </Button>
              </div>
            )}

            {/* Scraper Status Badge / Log Trigger */}
            {scraperStatus.status !== 'idle' && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-xs border"
                onClick={() => setShowLogsDialog(true)}
              >
                <Terminal className="w-3.5 h-3.5" />
                {scraperStatus.status === 'running' ? (
                  <span className="flex items-center gap-1.5 text-amber-500 font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                  </span>
                ) : scraperStatus.status === 'completed' ? (
                  <span className="text-emerald-500 font-medium">Busca Concluída</span>
                ) : (
                  <span className="text-rose-500 font-medium">Erro no Scraper</span>
                )}
              </Button>
            )}

            {/* Run Scraper Button */}
            <Button
              onClick={() => handleStartScraper()}
              disabled={scraperStatus.status === 'running'}
              className="gap-2 font-semibold shadow-sm"
            >
              {scraperStatus.status === 'running' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Buscando Vagas...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Buscar Vagas (Run Scraper)
                </>
              )}
            </Button>
          </div>
        </header>

        {/* Navigation Bar (Inbox / Vagas Aplicadas / Histórico de Buscas / Perfil Profissional) */}
        <div className="flex items-center justify-between flex-wrap gap-3 bg-muted/40 p-1.5 rounded-lg border">
          <div className="flex items-center flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setMainTab('inbox')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                mainTab === 'inbox'
                  ? 'bg-background text-foreground shadow-sm border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BriefcaseBusiness className="w-4 h-4 text-primary" />
              <span>Descobrir Vagas</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {jobs.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  setAuthInitialMode('login');
                  setAuthModalOpen(true);
                  return;
                }
                setMainTab('applied');
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                mainTab === 'applied'
                  ? 'bg-background text-foreground shadow-sm border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Vagas Aplicadas</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {appliedJobs.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  setAuthInitialMode('login');
                  setAuthModalOpen(true);
                  return;
                }
                setMainTab('searches');
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                mainTab === 'searches'
                  ? 'bg-background text-foreground shadow-sm border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <History className="w-4 h-4 text-amber-600" />
              <span>Histórico de Buscas</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {searchHistory.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  setAuthInitialMode('register');
                  setAuthModalOpen(true);
                  return;
                }
                setMainTab('profile');
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                mainTab === 'profile'
                  ? 'bg-background text-foreground shadow-sm border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserCog className="w-4 h-4 text-blue-600" />
              <span>Meu Perfil & Currículo Base</span>
              {user && !user.hasResume && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  setAuthInitialMode('login');
                  setAuthModalOpen(true);
                  return;
                }
                setMainTab('settings');
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                mainTab === 'settings'
                  ? 'bg-background text-foreground shadow-sm border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Settings2 className="w-4 h-4 text-violet-600" />
              <span>Configurações</span>
              {settings && !settings.ai.effective.ready && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="IA não configurada" />
              )}
            </button>
          </div>

          {user && !user.hasResume && mainTab !== 'profile' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMainTab('profile')}
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline h-8"
            >
              ⚠️ Envie seu Currículo ou PDF do LinkedIn para personalizar gerações →
            </Button>
          )}
        </div>

        {/* ==================== TAB 1: INBOX / DESCOBRIR VAGAS ==================== */}
        {mainTab === 'inbox' && (
          <>
            {/* Search Customization Filters with Boolean Role Multi-Selector */}
            <SearchFilters
              filters={filters}
              onChange={handleFiltersChange}
              disabled={scraperStatus.status === 'running'}
              customRoles={customRoles}
              locationSuggestions={settings?.locationSuggestions}
            />

            {/* Job Listings Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  Vagas Descobertas{' '}
                  <span className="text-muted-foreground text-sm font-normal">
                    ({jobs.length} pendentes de revisão)
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Vagas recusadas são descartadas imediatamente sem poluir seu histórico. Vagas aplicadas ficam salvas na aba &quot;Vagas Aplicadas&quot;.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEvaluateJobs}
                  disabled={evaluating !== null || jobs.length === 0}
                  className="text-xs gap-1.5"
                  title="Dá uma nota de 0 a 100 para cada vaga com base no seu perfil e nos critérios definidos em Configurações"
                >
                  {evaluating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Avaliando... ({evaluating.done} feitas, {evaluating.remaining} restantes)
                    </>
                  ) : (
                    <>
                      <Target className="w-3.5 h-3.5 text-emerald-600" /> Avaliar com IA
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchJobs}
                  className="text-xs text-muted-foreground gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Atualizar Lista
                </Button>
              </div>
            </div>

            {evaluationMessage && (
              <div
                className={`p-3 rounded-md border text-xs ${
                  evaluationMessage.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                }`}
              >
                {evaluationMessage.text}
              </div>
            )}

            {jobs.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                <div className="p-4 rounded-full bg-muted">
                  <Sparkles className="w-8 h-8 text-primary opacity-60" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">
                    Nenhuma vaga pendente na fila
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Selecione os cargos desejados acima e clique em{' '}
                    <strong>&quot;Buscar Vagas (Run Scraper)&quot;</strong> para descobrir novas oportunidades.
                  </p>
                </div>
              </Card>
            ) : (
              <div className="flex flex-col gap-4">
                {sortedJobs.map((job) => {
                  const isResumeGenerating =
                    isGenerating?.id === job.id && isGenerating?.type === 'resume';
                  const isCoverGenerating =
                    isGenerating?.id === job.id && isGenerating?.type === 'cover_letter';

                  return (
                    <Card
                      key={job.id}
                      className="w-full transition-all hover:shadow-md border-l-4 border-l-primary flex flex-col lg:flex-row lg:items-center justify-between p-5 gap-4"
                    >
                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className="text-lg font-bold text-primary hover:underline cursor-pointer"
                            onClick={() => window.open(job.url, '_blank')}
                          >
                            {job.title}
                          </h3>
                          <Badge variant="secondary" className="text-xs font-semibold">
                            Nova
                          </Badge>
                          {job.matchScore !== null && (
                            <Badge
                              variant="default"
                              className={`text-xs ${job.matchScore >= minScore ? 'bg-emerald-600' : 'bg-slate-500'}`}
                            >
                              {job.matchScore}% Match
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                          <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                          <span className="truncate">{job.company || 'Empresa não informada'}</span>
                        </div>
                        {job.matchReason && (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2" title={job.matchReason}>
                            <Sparkles className="w-3 h-3 inline mr-1 text-primary" />
                            {job.matchReason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center flex-wrap gap-2 justify-end">
                        {/* Generate Resume */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-primary/30 hover:border-primary text-xs"
                          disabled={isResumeGenerating || isCoverGenerating}
                          onClick={() => handleGenerate(job, 'resume')}
                        >
                          {isResumeGenerating ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Gerando Currículo...
                            </>
                          ) : (
                            <>
                              <FileText className="w-3.5 h-3.5 text-blue-600" />
                              Gerar Currículo ATS
                            </>
                          )}
                        </Button>

                        {/* Generate Cover Letter */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-primary/30 hover:border-primary text-xs"
                          disabled={isResumeGenerating || isCoverGenerating}
                          onClick={() => handleGenerate(job, 'cover_letter')}
                        >
                          {isCoverGenerating ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Gerando Carta...
                            </>
                          ) : (
                            <>
                              <Mail className="w-3.5 h-3.5 text-amber-600" />
                              Gerar Cover Letter
                            </>
                          )}
                        </Button>

                        {/* View Details Dialog */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="secondary" size="sm" className="text-xs">
                              Detalhes
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-6">
                            <DialogHeader className="shrink-0 pb-2">
                              <DialogTitle className="text-2xl text-primary">{job.title}</DialogTitle>
                              <DialogDescription className="flex items-center gap-2 text-base font-medium">
                                <Building2 className="w-4 h-4" />
                                {job.company}
                              </DialogDescription>
                            </DialogHeader>

                            <div className="shrink-0 flex flex-wrap gap-2 p-3 bg-muted/60 rounded-md border text-xs items-center justify-between">
                              <span className="font-semibold text-muted-foreground">
                                Ferramentas de Personalização com IA:
                              </span>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1.5 text-xs"
                                  disabled={isResumeGenerating}
                                  onClick={() => handleGenerate(job, 'resume')}
                                >
                                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                                  Gerar Currículo ATS
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1.5 text-xs"
                                  disabled={isCoverGenerating}
                                  onClick={() => handleGenerate(job, 'cover_letter')}
                                >
                                  <Mail className="w-3.5 h-3.5 text-amber-600" />
                                  Gerar Cover Letter
                                </Button>
                              </div>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto rounded-md border bg-muted/30 p-4 shadow-inner my-2">
                              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground select-text">
                                {job.description}
                              </pre>
                            </div>

                            <div className="shrink-0 flex justify-between items-center pt-3 border-t mt-auto">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReject(job.id)}
                                className="text-rose-600 hover:text-rose-700"
                              >
                                Recusar & Descartar
                              </Button>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(job.url, '_blank')}
                                  className="gap-1.5"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" /> Abrir Vaga
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleApplyAndRegister(job, true)}
                                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Aplicar & Registrar no Histórico
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Reject Button (deletes immediately, no registration) */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReject(job.id)}
                          className="text-xs text-muted-foreground hover:text-rose-600"
                          title="Descarta a vaga sem registrá-la no histórico"
                        >
                          Recusar
                        </Button>

                        {/* Apply & Register in History */}
                        <Button
                          size="sm"
                          onClick={() => handleApplyAndRegister(job, true)}
                          className="gap-1.5 text-xs"
                          title="Abre o link da vaga e registra no seu Histórico de Vagas Aplicadas"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Aplicar
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ==================== TAB 2: HISTÓRICO DE VAGAS APLICADAS ==================== */}
        {mainTab === 'applied' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Histórico de Vagas Aplicadas ({appliedJobs.length})
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Registro exclusivo das vagas em que você se candidatou, com acesso rápido ao currículo e cover letter gerados.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchUserHistories}
                className="text-xs gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Atualizar
              </Button>
            </div>

            {appliedJobs.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 opacity-60" />
                <div>
                  <p className="text-base font-semibold text-foreground">
                    Nenhuma candidatura registrada ainda
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ao clicar em <strong>&quot;Aplicar&quot;</strong> em uma vaga na aba Descobrir Vagas, ela será registrada automaticamente aqui.
                  </p>
                </div>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {appliedJobs.map((app) => {
                  const targetId = app.jobId || app.id;
                  const isResumeGenerating =
                    isGenerating?.id === targetId && isGenerating?.type === 'resume';
                  const isCoverGenerating =
                    isGenerating?.id === targetId && isGenerating?.type === 'cover_letter';

                  return (
                    <Card
                      key={app.id}
                      className="p-5 border-l-4 border-l-emerald-600 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className="text-base font-bold text-primary hover:underline cursor-pointer"
                            onClick={() => window.open(app.url, '_blank')}
                          >
                            {app.title}
                          </h3>
                          <Badge className="bg-emerald-600 text-[11px]">Aplicada</Badge>
                          {app.atsScore && (
                            <Badge variant="outline" className="text-[11px]">
                              ATS: {app.atsScore}%
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1 font-medium text-foreground/80">
                            <Building2 className="w-3.5 h-3.5" />
                            {app.company || 'Empresa não informada'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Aplicada em {new Date(app.appliedAt).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center flex-wrap gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1.5"
                          disabled={isResumeGenerating}
                          onClick={() => {
                            if (app.customResume) {
                              setActiveDoc({
                                type: 'resume',
                                jobId: targetId,
                                jobTitle: app.title,
                                company: app.company || 'Company',
                                text: app.customResume.text,
                                html: app.customResume.html,
                                atsScore: app.customResume.atsScore || app.atsScore || undefined,
                                matchedKeywords: app.customResume.matchedKeywords,
                              });
                              setActiveTab('preview');
                            } else {
                              handleGenerate(
                                { id: targetId, title: app.title, company: app.company },
                                'resume'
                              );
                            }
                          }}
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          {app.hasResume ? 'Ver Currículo Enviado' : 'Gerar Currículo'}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1.5"
                          disabled={isCoverGenerating}
                          onClick={() => {
                            if (app.coverLetter) {
                              setActiveDoc({
                                type: 'cover_letter',
                                jobId: targetId,
                                jobTitle: app.title,
                                company: app.company || 'Company',
                                text: app.coverLetter.text,
                                html: app.coverLetter.html,
                              });
                              setActiveTab('preview');
                            } else {
                              handleGenerate(
                                { id: targetId, title: app.title, company: app.company },
                                'cover_letter'
                              );
                            }
                          }}
                        >
                          <Mail className="w-3.5 h-3.5 text-amber-600" />
                          {app.hasCoverLetter ? 'Ver Cover Letter' : 'Gerar Cover Letter'}
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => window.open(app.url, '_blank')}
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Link da Vaga
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAppliedJob(app.id)}
                          className="text-xs text-muted-foreground hover:text-rose-600"
                          title="Remover registro do histórico"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: HISTÓRICO DE BUSCAS ==================== */}
        {mainTab === 'searches' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-600" />
                  Histórico de Buscas Realizadas ({searchHistory.length})
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Consulte as combinações booleanas de cargos e filtros que você já executou e repita qualquer busca com um clique.
                </p>
              </div>
            </div>

            {searchHistory.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                <History className="w-8 h-8 text-amber-600 opacity-60" />
                <div>
                  <p className="text-base font-semibold text-foreground">
                    Nenhuma busca registrada no histórico
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Suas buscas realizadas pelo scraper serão salvas automaticamente aqui.
                  </p>
                </div>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {searchHistory.map((item) => {
                  const seniorityLabel =
                    SENIORITY_OPTIONS.find((s) => s.value === item.seniority)?.label || item.seniority;
                  const workplaceLabel =
                    WORKPLACE_OPTIONS.find((w) => w.value === item.workplaceType)?.label ||
                    item.workplaceType;
                  const timeLabel =
                    TIME_RANGE_OPTIONS.find((t) => t.value === item.timeRangeSeconds)?.label ||
                    `${item.timeRangeSeconds}s`;

                  return (
                    <Card key={item.id} className="p-4 space-y-3 border-l-4 border-l-amber-500">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center flex-wrap gap-1.5">
                            {(item.roles || DEFAULT_SEARCH_FILTERS.roles).map((r) => (
                              <Badge key={r} variant="default" className="text-[11px]">
                                {getRoleLabel(r, customRoles)}
                              </Badge>
                            ))}
                            <Badge variant="secondary" className="text-[11px]">
                              {seniorityLabel}
                            </Badge>
                            <Badge variant="outline" className="text-[11px]">
                              📍 {item.location}
                            </Badge>
                            <Badge variant="outline" className="text-[11px]">
                              💻 {workplaceLabel}
                            </Badge>
                            <Badge variant="outline" className="text-[11px]">
                              ⏱️ {timeLabel}
                            </Badge>
                          </div>

                          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            <span>Executada em {new Date(item.createdAt).toLocaleString('pt-BR')}</span>
                          </div>
                        </div>

                        <div className="flex items-center flex-wrap gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestoreSearch(item, false)}
                            className="text-xs gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Carregar Filtros
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleRestoreSearch(item, true)}
                            disabled={scraperStatus.status === 'running'}
                            className="text-xs gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Repetir Busca
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => window.open(item.searchUrl, '_blank')}
                            className="text-xs gap-1"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> LinkedIn
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSearchRecord(item.id)}
                            className="text-xs text-muted-foreground hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="text-[10px] bg-muted/60 px-2.5 py-1.5 rounded font-mono break-all text-muted-foreground">
                        <strong>Query Booleana:</strong> {item.booleanQuery}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 5: CONFIGURAÇÕES ==================== */}
        {mainTab === 'settings' && (
          settings ? (
            <SettingsPanel settings={settings} onSaved={setSettings} />
          ) : (
            <Card className="p-8 flex items-center justify-center text-sm text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" /> Carregando configurações...
            </Card>
          )
        )}

        {/* ==================== TAB 4: MEU PERFIL PROFISSIONAL & SEGURANÇA ==================== */}
        {mainTab === 'profile' && (
          <UserProfilePanel
            onProfileUpdated={() => {
              fetchAuthUser();
            }}
          />
        )}

        {/* Scraper Terminal Logs Dialog */}
        <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Terminal className="w-5 h-5 text-primary" />
                Logs de Execução do Scraper
              </DialogTitle>
              <DialogDescription>
                Saída em tempo real do scraper do LinkedIn com sua query booleana personalizada.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 bg-slate-950 text-slate-100 p-4 rounded-md font-mono text-xs overflow-y-auto max-h-[450px] space-y-1">
              {scraperStatus.logs.length === 0 ? (
                <div className="text-slate-500 italic">Nenhum log registrado ainda.</div>
              ) : (
                scraperStatus.logs.map((line, i) => (
                  <div key={i} className="leading-relaxed">
                    {line}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </DialogContent>
        </Dialog>

        {/* DOCUMENT PREVIEW & EXPORT MODAL */}
        <Dialog open={!!activeDoc} onOpenChange={(open) => !open && setActiveDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
            <DialogHeader className="border-b pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {activeDoc?.type === 'resume' ? (
                    <FileText className="w-6 h-6 text-blue-600" />
                  ) : (
                    <Mail className="w-6 h-6 text-amber-600" />
                  )}
                  <div>
                    <DialogTitle className="text-xl">
                      {activeDoc?.type === 'resume'
                        ? 'Currículo Otimizado para ATS'
                        : 'Cover Letter Personalizada'}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Personalizado para <strong>{activeDoc?.jobTitle}</strong> em{' '}
                      <strong>{activeDoc?.company}</strong>
                      {activeDoc?.profileSource && (
                        <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                          • Fonte: {activeDoc.profileSource}
                        </span>
                      )}
                    </DialogDescription>
                  </div>
                </div>

                {activeDoc?.atsScore && (
                  <Badge variant="default" className="bg-emerald-600 text-xs px-2.5 py-1">
                    ATS Match: {activeDoc.atsScore}%
                  </Badge>
                )}
              </div>

              {activeDoc?.matchedKeywords && activeDoc.matchedKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <span className="text-xs text-muted-foreground self-center font-semibold">
                    Keywords Alinhadas:
                  </span>
                  {activeDoc.matchedKeywords.slice(0, 8).map((kw, i) => (
                    <span
                      key={i}
                      className="text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded font-medium border border-emerald-200 dark:border-emerald-800"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </DialogHeader>

            <div className="flex items-center justify-between mt-3 mb-2">
              <div className="flex gap-1.5 bg-muted p-1 rounded-md text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeTab === 'preview'
                      ? 'bg-background shadow text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Visualização Formatada (A4)
                </button>
                <button
                  onClick={() => setActiveTab('text')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeTab === 'text'
                      ? 'bg-background shadow text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Texto Puro (ATS Copy)
                </button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyText}
                  className="gap-1.5 text-xs h-8"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? 'Copiado!' : 'Copiar Texto'}
                </Button>
                <Button size="sm" onClick={handlePrint} className="gap-1.5 text-xs h-8">
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir / Salvar PDF
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden border rounded-md bg-muted/20 relative">
              {activeTab === 'preview' ? (
                <iframe
                  title="Document Preview"
                  srcDoc={activeDoc?.html || ''}
                  className="w-full h-[520px] bg-white border-0 rounded-md"
                />
              ) : (
                <ScrollArea className="h-[520px] p-4 bg-muted/40 font-mono text-xs">
                  <pre className="whitespace-pre-wrap leading-relaxed text-foreground">
                    {activeDoc?.text}
                  </pre>
                </ScrollArea>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Documento vinculado de forma segura ao seu perfil
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8 text-primary"
                  onClick={() => {
                    if (activeDoc) {
                      handleGenerate(
                        {
                          id: activeDoc.jobId,
                          title: activeDoc.jobTitle,
                          company: activeDoc.company,
                        },
                        activeDoc.type,
                        true
                      );
                    }
                  }}
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Regerar com IA
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveDoc(null)}
                  className="text-xs h-8"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Auth Modal */}
        <AuthModal
          open={authModalOpen}
          onOpenChange={setAuthModalOpen}
          initialMode={authInitialMode}
          onSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            fetchUserHistories();
          }}
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm font-medium">Carregando painel...</p>
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
