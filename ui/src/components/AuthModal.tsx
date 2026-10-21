"use client";

import { FC, useState, FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Lock, UserPlus, LogIn, Loader2, AlertCircle } from 'lucide-react';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  hasResume: boolean;
  resumeSource: string | null;
  resumeUpdatedAt: string | null;
}

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (user: AuthUser) => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: FC<AuthModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode,
          name: mode === 'register' ? name : undefined,
          email,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao autenticar');
      }

      onSuccess(data.user);
      onOpenChange(false);
      setName('');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {mode === 'register' ? (
              <>
                <UserPlus className="w-5 h-5 text-primary" />
                Criar Conta Segura
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5 text-primary" />
                Entrar na sua Conta
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'register'
              ? 'Cadastre-se para salvar seu perfil profissional criptografado, histórico de buscas e vagas aplicadas.'
              : 'Acesse seu perfil profissional, histórico de buscas e candidaturas.'}
          </DialogDescription>
        </DialogHeader>

        {/* Tabs Login / Cadastro */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-md text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-1.5 rounded transition-colors ${
              mode === 'login'
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Já tenho conta (Login)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-1.5 rounded transition-colors ${
              mode === 'register'
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Novo Cadastro
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {error && (
            <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-1.5">
              <label htmlFor="auth-name" className="text-xs font-semibold block">
                Nome Completo
              </label>
              <input
                id="auth-name"
                type="text"
                required
                placeholder="Ex: Alan Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="auth-email" className="text-xs font-semibold block">
              E-mail
            </label>
            <input
              id="auth-email"
              type="email"
              required
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="auth-password" className="text-xs font-semibold block">
              Senha (mín. 6 caracteres)
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <strong>Segurança de Nível Bancário:</strong> Sua senha é protegida com hash{' '}
              <code>scrypt</code> + salt aleatório, e todas as informações do seu currículo são
              criptografadas em repouso com <strong>AES-256-GCM</strong> (chave exclusiva por usuário).
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando...
              </>
            ) : mode === 'register' ? (
              <>
                <Lock className="w-4 h-4" />
                Criar Conta e Proteger Dados
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Entrar
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
