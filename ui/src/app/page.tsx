"use client";

import { useEffect, useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  AlertCircle
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

type DocModalData = {
  type: 'resume' | 'cover_letter';
  jobId: string;
  jobTitle: string;
  company: string;
  text: string;
  html: string;
  atsScore?: number;
  matchedKeywords?: string[];
};

type ScraperStatus = {
  status: 'idle' | 'running' | 'completed' | 'error';
  startedAt: string | null;
  endedAt: string | null;
  logs: string[];
  message: string;
};

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
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

  const fetchJobs = () => {
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
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // Poll scraper status when it's running
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (scraperStatus.status === 'running') {
      interval = setInterval(() => {
        fetch('/api/scraper')
          .then(res => res.json())
          .then((data: ScraperStatus) => {
            setScraperStatus(data);
            if (data.status === 'completed' || data.status === 'error') {
              fetchJobs(); // refresh jobs automatically
            }
          })
          .catch(console.error);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [scraperStatus.status]);

  // Scroll to bottom of logs
  useEffect(() => {
    if (showLogsDialog) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scraperStatus.logs, showLogsDialog]);

  // Start scraper for last 24 hours
  const handleStartScraper = async () => {
    try {
      setScraperStatus(prev => ({
        ...prev,
        status: 'running',
        message: 'Starting scraper for the last 24 hours...',
        logs: ['[Client] Launching LinkedIn scraper for the last 24 hours...'],
      }));

      const res = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeRangeSeconds: 86400, maxPages: 3 }),
      });

      const data = await res.json();
      if (data.state) {
        setScraperStatus(data.state);
      }
    } catch (e: any) {
      console.error('Failed to trigger scraper:', e);
      setScraperStatus(prev => ({
        ...prev,
        status: 'error',
        message: e.message || 'Failed to start scraper',
      }));
    }
  };

  // Generate Resume or Cover Letter
  const handleGenerate = async (job: Job, type: 'resume' | 'cover_letter', regenerate = false) => {
    setIsGenerating({ id: job.id, type });
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, type, regenerate }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      setActiveDoc({
        type,
        jobId: job.id,
        jobTitle: job.title,
        company: job.company || 'Company',
        text: data.text,
        html: data.html,
        atsScore: data.atsScore,
        matchedKeywords: data.matchedKeywords,
      });
      setActiveTab('preview');
    } catch (err: any) {
      alert(`Error generating ${type === 'resume' ? 'Resume' : 'Cover Letter'}: ${err.message}`);
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

  const handleReject = async (id: string) => {
    setJobs(jobs.filter(j => j.id !== id));
    await fetch('/api/jobs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'rejected' }),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm font-medium">Loading opportunities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Top Header & Action Bar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight">Job Application Copilot</h1>
              <Badge variant="outline" className="text-xs uppercase px-2 py-0.5">AI-Powered</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Automated 24h job discovery, ATS resume optimizer & tailored cover letters.
            </p>
          </div>

          <div className="flex items-center gap-3">
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
                    <Loader2 className="w-3 h-3 animate-spin" /> Scraping 24h...
                  </span>
                ) : scraperStatus.status === 'completed' ? (
                  <span className="text-emerald-500 font-medium">Scraper Done</span>
                ) : (
                  <span className="text-rose-500 font-medium">Scraper Failed</span>
                )}
              </Button>
            )}

            {/* Run Scraper Button */}
            <Button
              onClick={handleStartScraper}
              disabled={scraperStatus.status === 'running'}
              className="gap-2 font-semibold shadow-sm"
            >
              {scraperStatus.status === 'running' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scraping Last 24h...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Run Scraper (Last 24h)
                </>
              )}
            </Button>
          </div>
        </header>

        {/* Scraper Terminal Logs Dialog */}
        <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Terminal className="w-5 h-5 text-primary" />
                Scraper Process Output
              </DialogTitle>
              <DialogDescription>
                Live output from LinkedIn scraper (Time filter: Last 24 hours).
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 bg-slate-950 text-slate-100 p-4 rounded-md font-mono text-xs overflow-y-auto max-h-[450px] space-y-1">
              {scraperStatus.logs.length === 0 ? (
                <div className="text-slate-500 italic">No logs recorded yet.</div>
              ) : (
                scraperStatus.logs.map((line, i) => (
                  <div key={i} className="leading-relaxed">{line}</div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </DialogContent>
        </Dialog>

        {/* Job Listings Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">
            Job Inbox <span className="text-muted-foreground text-sm font-normal">({jobs.length} pending review)</span>
          </h2>
          <Button variant="ghost" size="sm" onClick={fetchJobs} className="text-xs text-muted-foreground gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh List
          </Button>
        </div>

        {/* Jobs List */}
        {jobs.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-muted">
              <Sparkles className="w-8 h-8 text-primary opacity-60" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">No pending jobs in your inbox</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click <strong>"Run Scraper (Last 24h)"</strong> above to discover the newest opportunities.
              </p>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {jobs.map((job) => {
              const isResumeGenerating = isGenerating?.id === job.id && isGenerating?.type === 'resume';
              const isCoverGenerating = isGenerating?.id === job.id && isGenerating?.type === 'cover_letter';

              return (
                <Card
                  key={job.id}
                  className="w-full transition-all hover:shadow-md border-l-4 border-l-primary flex flex-col lg:flex-row lg:items-center justify-between p-5 gap-4"
                >
                  {/* Job Details Left Column */}
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-primary hover:underline cursor-pointer" onClick={() => window.open(job.url, '_blank')}>
                        {job.title}
                      </h3>
                      <Badge variant="secondary" className="text-xs font-semibold">
                        Pending
                      </Badge>
                      {job.matchScore !== null && job.matchScore > 0 && (
                        <Badge variant="default" className="text-xs bg-emerald-600">
                          {job.matchScore}% Match
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                      <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="truncate">{job.company || 'Unspecified Company'}</span>
                    </div>
                  </div>

                  {/* Actions Column Right */}
                  <div className="flex items-center flex-wrap gap-2.5 justify-end">
                    
                    {/* BUTTON 1: Generate / View Resume */}
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
                          Crafting Resume...
                        </>
                      ) : (
                        <>
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          Generate Resume
                        </>
                      )}
                    </Button>

                    {/* BUTTON 2: Generate / View Cover Letter */}
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
                          Crafting Letter...
                        </>
                      ) : (
                        <>
                          <Mail className="w-3.5 h-3.5 text-amber-600" />
                          Generate Cover Letter
                        </>
                      )}
                    </Button>

                    {/* View Details Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="secondary" size="sm" className="text-xs">
                          Details
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

                        {/* Quick generator triggers inside details modal */}
                        <div className="shrink-0 flex flex-wrap gap-2 p-3 bg-muted/60 rounded-md border text-xs items-center justify-between">
                          <span className="font-semibold text-muted-foreground">AI Application Tools:</span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 text-xs"
                              disabled={isResumeGenerating}
                              onClick={() => handleGenerate(job, 'resume')}
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-600" />
                              Generate Tailored Resume
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 text-xs"
                              disabled={isCoverGenerating}
                              onClick={() => handleGenerate(job, 'cover_letter')}
                            >
                              <Mail className="w-3.5 h-3.5 text-amber-600" />
                              Generate Cover Letter
                            </Button>
                          </div>
                        </div>

                        {/* Scrollable Job Description Container */}
                        <div className="flex-1 min-h-0 overflow-y-auto rounded-md border bg-muted/30 p-4 shadow-inner my-2">
                          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground select-text">
                            {job.description}
                          </pre>
                        </div>

                        {/* Fixed Modal Footer */}
                        <div className="shrink-0 flex justify-between items-center pt-3 border-t mt-auto">
                          <Button variant="ghost" size="sm" onClick={() => handleReject(job.id)} className="text-rose-600 hover:text-rose-700">
                            Reject & Hide
                          </Button>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => window.open(job.url, '_blank')} className="gap-1.5">
                              <ExternalLink className="w-3.5 h-3.5" /> Open Posting
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Quick Reject Button */}
                    <Button variant="ghost" size="sm" onClick={() => handleReject(job.id)} className="text-xs text-muted-foreground hover:text-rose-600">
                      Reject
                    </Button>

                    {/* Apply Direct Link */}
                    <Button size="sm" onClick={() => window.open(job.url, '_blank')} className="gap-1.5 text-xs">
                      <ExternalLink className="w-3.5 h-3.5" /> Apply
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* DOCUMENT PREVIEW & EXPORT MODAL */}
        <Dialog open={!!activeDoc} onOpenChange={(open) => !open && setActiveDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
            <DialogHeader className="border-b pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {activeDoc?.type === 'resume' ? (
                    <FileText className="w-6 h-6 text-blue-600" />
                  ) : (
                    <Mail className="w-6 h-6 text-amber-600" />
                  )}
                  <div>
                    <DialogTitle className="text-xl">
                      {activeDoc?.type === 'resume' ? 'Tailored ATS Resume' : 'Targeted Cover Letter'}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Tailored for <strong>{activeDoc?.jobTitle}</strong> at <strong>{activeDoc?.company}</strong>
                    </DialogDescription>
                  </div>
                </div>

                {activeDoc?.atsScore && (
                  <Badge variant="default" className="bg-emerald-600 text-xs px-2.5 py-1">
                    ATS Match: {activeDoc.atsScore}%
                  </Badge>
                )}
              </div>

              {/* Matched Keywords Pill Row */}
              {activeDoc?.matchedKeywords && activeDoc.matchedKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <span className="text-xs text-muted-foreground self-center font-semibold">Matched:</span>
                  {activeDoc.matchedKeywords.slice(0, 8).map((kw, i) => (
                    <span key={i} className="text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded font-medium border border-emerald-200 dark:border-emerald-800">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </DialogHeader>

            {/* View Switcher Tabs */}
            <div className="flex items-center justify-between mt-3 mb-2">
              <div className="flex gap-1.5 bg-muted p-1 rounded-md text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 rounded transition-colors ${activeTab === 'preview' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Formatted Preview
                </button>
                <button
                  onClick={() => setActiveTab('text')}
                  className={`px-3 py-1 rounded transition-colors ${activeTab === 'text' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Plain Text (ATS-Copy)
                </button>
              </div>

              {/* Export Action Controls */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyText} className="gap-1.5 text-xs h-8">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy Text'}
                </Button>
                <Button size="sm" onClick={handlePrint} className="gap-1.5 text-xs h-8">
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save PDF
                </Button>
              </div>
            </div>

            {/* Content Display */}
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

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t mt-3 text-xs text-muted-foreground">
              <span>Saved locally in <code>generated/{activeDoc?.type === 'resume' ? 'resumes' : 'cover_letters'}</code></span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8 text-primary"
                  onClick={() => {
                    const job = jobs.find(j => j.id === activeDoc?.jobId);
                    if (job && activeDoc) {
                      handleGenerate(job, activeDoc.type, true);
                    }
                  }}
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setActiveDoc(null)} className="text-xs h-8">
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
