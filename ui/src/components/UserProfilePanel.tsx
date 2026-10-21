"use client";

import { FC, useState, useEffect, ChangeEvent } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  ShieldCheck,
  Lock,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileUp,
  Globe,
} from 'lucide-react';

interface UserProfilePanelProps {
  onProfileUpdated?: () => void;
}

export const UserProfilePanel: FC<UserProfilePanelProps> = ({ onProfileUpdated }) => {
  const [resumeText, setResumeText] = useState('');
  const [resumeSource, setResumeSource] = useState<string | null>(null);
  const [resumeUpdatedAt, setResumeUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<'resume' | 'linkedin' | 'manual' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setResumeText(data.resumeText || '');
        setResumeSource(data.resumeSource || null);
        setResumeUpdatedAt(data.resumeUpdatedAt || null);
      }
    } catch (e) {
      console.error('Failed to load profile:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>, uploadType: 'resume' | 'linkedin') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFeedback(null);
    setUploading(uploadType);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadType', uploadType);

      const res = await fetch('/api/profile', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao processar o arquivo enviado.');
      }

      setResumeText(data.resumeText || '');
      setResumeSource(data.resumeSource || null);
      setResumeUpdatedAt(data.resumeUpdatedAt || null);
      setFeedback({
        type: 'success',
        message: `Arquivo "${file.name}" extraído em memória e criptografado com sucesso via AES-256-GCM!`,
      });
      onProfileUpdated?.();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao enviar arquivo.',
      });
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  };

  const handleSaveManual = async () => {
    setFeedback(null);
    setUploading('manual');

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText,
          source: resumeSource || 'Edição Direta no Painel Seguro',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao salvar informações.');
      }

      setResumeSource(data.resumeSource);
      setResumeUpdatedAt(data.resumeUpdatedAt);
      setFeedback({
        type: 'success',
        message: 'Informações profissionais atualizadas e criptografadas com AES-256-GCM!',
      });
      onProfileUpdated?.();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message,
      });
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteProfile = async () => {
    if (!confirm('Tem certeza que deseja apagar permanentemente suas informações profissionais do banco de dados?')) {
      return;
    }

    setFeedback(null);
    try {
      const res = await fetch('/api/profile', { method: 'DELETE' });
      if (res.ok) {
        setResumeText('');
        setResumeSource(null);
        setResumeUpdatedAt(null);
        setFeedback({
          type: 'success',
          message: 'Suas informações profissionais foram permanentemente apagadas.',
        });
        onProfileUpdated?.();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Erro ao remover dados.',
      });
    }
  };

  if (loading) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Descriptografando seu perfil profissional seguro...
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de Segurança das Informações */}
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-foreground">
                  Cofre de Dados Profissionais (AES-256-GCM)
                </h3>
                <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                  Criptografia Autenticada em Repouso
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Seus arquivos de currículo ou PDF do LinkedIn são lidos <strong>exclusivamente em memória RAM</strong> (sem salvar arquivos brutos no disco) e armazenados criptografados com chave exclusiva derivada via <code>HKDF-SHA256</code> para o seu usuário.
              </p>
            </div>
          </div>
          {resumeSource && (
            <div className="text-right shrink-0 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground flex items-center gap-1 justify-end">
                <Lock className="w-3 h-3 text-emerald-600" />
                {resumeSource}
              </div>
              {resumeUpdatedAt && (
                <div className="text-[11px]">
                  Atualizado em {new Date(resumeUpdatedAt).toLocaleString('pt-BR')}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Opções de Upload: Currículo ou Arquivo do LinkedIn */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Upload de Currículo */}
        <Card className="border hover:border-primary/50 transition-all">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileUp className="w-5 h-5 text-blue-600" />
              Opção 1: Upload do seu Currículo
            </CardTitle>
            <CardDescription className="text-xs">
              Envie seu currículo atual em <strong>PDF (.pdf)</strong>, <strong>Texto (.txt)</strong> ou <strong>Markdown (.md)</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-muted/50 transition-colors">
              {uploading === 'resume' ? (
                <div className="flex flex-col items-center gap-2 text-xs text-primary font-medium">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Extraindo com IA em memória e criptografando...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <Upload className="w-6 h-6 text-blue-600" />
                  <span className="text-xs font-semibold text-foreground">
                    Clique para selecionar seu Currículo (PDF, TXT, MD)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Processamento 100% em memória • Máx. 10 MB
                  </span>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.txt,.md,application/pdf,text/plain"
                className="hidden"
                disabled={uploading !== null}
                onChange={(e) => handleFileUpload(e, 'resume')}
              />
            </label>
          </CardContent>
        </Card>

        {/* Card 2: Upload do PDF do LinkedIn */}
        <Card className="border hover:border-primary/50 transition-all">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-5 h-5 text-sky-600" />
              Opção 2: Upload do Perfil do LinkedIn
            </CardTitle>
            <CardDescription className="text-xs">
              No seu perfil do LinkedIn, clique em <strong>&quot;Mais / Recursos&quot; → &quot;Salvar como PDF&quot;</strong> e faça upload do arquivo aqui.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-muted/50 transition-colors">
              {uploading === 'linkedin' ? (
                <div className="flex flex-col items-center gap-2 text-xs text-primary font-medium">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Extraindo dados do LinkedIn e criptografando...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <Upload className="w-6 h-6 text-sky-600" />
                  <span className="text-xs font-semibold text-foreground">
                    Clique para enviar o PDF ou Exportação do LinkedIn
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Extrai experiências, métricas, skills, formação e idiomas
                  </span>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.txt,.md,.json,application/pdf,text/plain"
                className="hidden"
                disabled={uploading !== null}
                onChange={(e) => handleFileUpload(e, 'linkedin')}
              />
            </label>
          </CardContent>
        </Card>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-md border text-xs flex items-center gap-2 ${
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
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Editor / Visualizador das Informações Profissionais Base */}
      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Suas Informações Profissionais (Base para Currículo ATS e Cover Letter)
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Revise ou complemente abaixo suas experiências, tecnologias, projetos, formação e idiomas. A IA usará exatamente estas informações para personalizar cada candidatura sem inventar dados.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {resumeText && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDeleteProfile}
                className="text-xs text-rose-600 hover:text-rose-700 gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Apagar Dados
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={uploading !== null || resumeText.trim().length < 20}
              onClick={handleSaveManual}
              className="text-xs gap-1.5"
            >
              {uploading === 'manual' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Criptografando...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Salvar & Criptografar Perfil
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <textarea
            rows={16}
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Faça upload do seu currículo PDF / LinkedIn PDF acima, ou cole aqui seu resumo profissional, experiências, tecnologias, formação acadêmica e idiomas..."
            className="w-full rounded-md border border-input bg-muted/20 p-3 font-mono text-xs leading-relaxed shadow-inner focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </CardContent>
      </Card>
    </div>
  );
};
