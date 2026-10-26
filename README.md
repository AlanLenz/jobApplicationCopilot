# 🚀 Job Application Copilot

<p align="center">
  <b>AI-Powered Boolean Job Discovery, Encrypted Profile Vault & Tailored Application Assistant</b><br>
  <i>Assistente inteligente com busca booleana de vagas, cofre de perfil criptografado e geração de currículos ATS e cover letters sob medida</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/AI-Gemini%20%7C%20Claude%20%7C%20OpenAI%20%7C%20Ollama-orange?style=flat-square" alt="Any AI provider" />
  <img src="https://img.shields.io/badge/Security-AES--256--GCM%20%7C%20scrypt-emerald?style=flat-square&logo=letsencrypt" alt="AES-256-GCM Security" />
  <img src="https://img.shields.io/badge/Playwright-Stealth-green?style=flat-square&logo=playwright" alt="Playwright" />
  <img src="https://img.shields.io/badge/Prisma-PostgreSQL-indigo?style=flat-square&logo=prisma" alt="Prisma" />
</p>

---

## 🌐 Language / Idioma
- [English Documentation](#-english-documentation)
- [Documentação em Português (Brasil)](#-documentação-em-português-brasil)

---

# 🇺🇸 English Documentation

## 📖 Overview
**Job Application Copilot** is a full-stack AI platform built to streamline job discovery and application tailoring while keeping candidate data strictly private and encrypted:

1. **Customizable Boolean Job Search**: Build complex bilingual (EN/PT) LinkedIn boolean queries visually using a **Role Multi-Selector** (plus custom role tags), seniority filters, publication time windows, location, and workplace model (Remote, Hybrid, On-site).
2. **Stealth LinkedIn Scraping**: Extracts fresh job postings directly from LinkedIn Jobs using a persistent browser session and deduplicates listings in PostgreSQL.
3. **Encrypted Professional Profile Vault (`AES-256-GCM`)**: Users register an account and upload their **Resume (PDF, TXT, MD)** or **LinkedIn Profile PDF Export**. Files are parsed 100% in memory via multimodal AI and stored encrypted at rest with per-user derived keys (`HKDF-SHA256`).
4. **Tailored ATS Resumes & Cover Letters**: Generates job-specific, ATS-optimized resumes (with keyword matching and ATS score) and persuasive cover letters in the same language as the job posting, ready to copy as plain text or print/save as A4 PDF.
5. **Search & Application History (Zero Rejected Clutter)**: Tracks all boolean searches executed by the user for 1-click replay and maintains a dedicated history of **Applied Jobs** alongside their generated documents. Rejected jobs are immediately deleted from the database rather than stored.

---

## ✨ Key Features

### 1. 🎯 Boolean Role Multi-Selector & Dynamic Search Filters
- **Bilingual Role Multi-Select**: Combine one or multiple roles (`OR` operator) across 10 curated presets (*Software Engineer*, *Full Stack*, *Front-end*, *Back-end*, *Mobile*, *DevOps / Cloud / SRE*, *Data*, *AI / Machine Learning*, *QA / Test Automation*, *Tech Lead / Architecture*) or add custom role terms directly to the boolean expression.
- **Granular Filters**: Customize **Seniority** (*Internship, Junior, Mid-level, Jr & Mid, Senior, All*), **Time Range** (*1h, 12h, 24h, 3d, 7d, 30d, Any*), **Location**, and **Workplace Type** (*Remote, Hybrid, On-site*).
- **Live Boolean & URL Preview**: Inspect the exact boolean query string and test the generated LinkedIn URL at any time.

### 2. 🔐 User Accounts & Bank-Grade Data Security
- **Secure Authentication**: User registration and login powered by `scrypt` password hashing with random 16-byte salts, constant-time verification (`crypto.timingSafeEqual`), and `HttpOnly` (`SameSite=Lax`) session cookies backed by `SHA-256` token hashes in PostgreSQL.
- **Per-User `AES-256-GCM` Encryption at Rest**: Candidate profiles, resumes, and tailored application documents are encrypted before touching the database using authenticated `AES-256-GCM` with 96-bit random IVs and per-user keys derived via `HKDF-SHA256`.
- **In-Memory File Upload**: Uploaded Resume PDFs and LinkedIn PDF exports are processed purely in RAM (`Buffer`) (local text extraction with `unpdf`, then structured by the configured LLM; scanned PDFs go to providers that read PDFs natively)—never leaving raw personal files exposed on public disk directories.
- **Right to Erasure**: Users can permanently wipe their professional profile data from the database with a single click.

### 3. 📄 Tailored ATS Resume & Cover Letter Generation
- **Grounded Personalization**: Uses your decrypted professional profile to align your summary, skills, and quantified experience bullets with the target job description without fabricating credentials.
- **Automatic Language Detection**: Generates documents in English or Portuguese matching the target job description.
- **Dual Output**: Switch between a print-ready A4 HTML preview and ATS-friendly plain text.

### 4. 📊 Search History & Applied Jobs Log
- **Applied Jobs History**: Clicking **Apply** opens the job posting and records the application in your personal history (`AppliedJob`), preserving the tailored resume, cover letter, ATS score, and timestamp.
- **Clean Rejection Workflow**: Clicking **Reject** immediately deletes the job from the database (`DELETE`), ensuring rejected jobs are never registered or kept in history.
- **Search History**: Automatically logs every scraper search with its boolean query and filters so you can restore filters or re-run any previous search with one click.

### 5. 🤖 Bring Your Own AI & Settings Screen
- **Any LLM**: Google Gemini, Anthropic Claude, OpenAI, OpenRouter, Groq, DeepSeek, Mistral, local models via **Ollama / LM Studio**, or any OpenAI-compatible endpoint (vLLM, LiteLLM...). Chosen per user in **Configurações**, with a **Test connection** button; API keys are encrypted with `AES-256-GCM` and never sent back to the browser. The server `.env` (`AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL`) is the default.
- **AI Job Evaluation**: **Avaliar com IA** scores every pending job (0-100) against your profile and the criteria you write in plain language (e.g. *"remote only, except in my city"*), with an optional auto-discard below a minimum score.
- **Your Own Search Presets**: custom role presets (label + boolean terms), default filters, pages per search and favorite locations.

---

## 🏗 System Architecture

```mermaid
flowchart TD
    subgraph AuthSecurity["1. Auth & Crypto Layer (Node Crypto)"]
        U[Authenticated User] -->|scrypt + SHA-256 Session| AUTH[Auth & Session Guard]
        U -->|Upload Resume / LinkedIn PDF| MEM[In-Memory Buffer Parser]
        MEM -->|HKDF-SHA256 + AES-256-GCM| DB[(PostgreSQL Database)]
    end

    subgraph Scraping["2. Boolean Search & Scraping"]
        UI[Next.js 16 Dashboard] -->|Role Multi-Selector + Filters| S[Playwright Stealth Scraper]
        S -->|Log SearchHistory| DB
        S -->|Save New Listings| DB
    end

    subgraph Generation["3. AI Document Generation"]
        DB -->|Decrypt User Profile in RAM| AI[Configured LLM: Gemini / Claude / OpenAI-compatible / Ollama]
        AI -->|Tailored ATS Resume & Cover Letter| UI
        UI -->|Apply: Encrypt & Save AppliedJob| DB
        UI -->|Reject: Immediate DELETE| DB
    end
```

---

## 🛠 Tech Stack

- **Runtime & Language**: Node.js, TypeScript (v5+)
- **Frontend & API**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide React, Radix UI / shadcn/ui
- **AI (provider-agnostic)**: `ui/src/lib/ai/` wraps `@google/genai`, `@anthropic-ai/sdk` and `openai` (any OpenAI-compatible API) behind one `generateJSON`/`generateText` API; `unpdf` for local PDF text extraction
- **Security & Cryptography**: Node.js native `crypto` (`AES-256-GCM` authenticated encryption, `HKDF-SHA256` per-user key derivation, `scrypt` password hashing, `SHA-256` session token hashing)
- **Scraping Engine**: Playwright, `playwright-extra`, `puppeteer-extra-plugin-stealth`
- **Database & ORM**: PostgreSQL, Prisma ORM (`User`, `Session`, `UserSettings`, `SearchHistory`, `AppliedJob`, `GeneratedDocument`, `Job`)
- **Browser Extension**: Chrome Extension Manifest V3 (`extension/`)
- **Containerization**: Docker & Docker Compose

---

## 📁 Project Structure

```text
JobApplicationCopilot/
├── chrome-data/           # Persistent Chrome profile for authenticated LinkedIn scraping
├── extension/             # Manifest V3 Chrome Extension (Form Auto-Filler)
├── prisma/
│   └── schema.prisma      # PostgreSQL schema (User, Session, UserSettings, SearchHistory, AppliedJob, GeneratedDocument, Job)
├── src/
│   └── scraper/
│       ├── index.ts       # ATS job board scraper scaffold
│       └── linkedin.ts    # Stealth Playwright LinkedIn boolean scraper
├── ui/                    # Next.js 16 Full-Stack Web Application
│   ├── prisma/
│   │   └── schema.prisma  # Synced Prisma schema for Next.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── applications/route.ts # Applied jobs history CRUD (encrypted docs)
│   │   │   │   ├── auth/route.ts         # Register, login, logout & session check
│   │   │   │   ├── generate/route.ts     # Tailored ATS Resume & Cover Letter generator
│   │   │   │   ├── jobs/route.ts         # Pending jobs inbox & immediate delete on reject
│   │   │   │   ├── profile/route.ts      # In-memory PDF/TXT upload & AES-256-GCM vault
│   │   │   │   ├── scraper/route.ts      # Scraper process runner & SearchHistory logger
│   │   │   │   └── searches/route.ts     # User boolean search history CRUD
│   │   │   └── page.tsx                  # Main Dashboard (Inbox, Applied, Searches, Profile)
│   │   ├── components/
│   │   │   ├── AuthModal.tsx             # User registration & login dialog
│   │   │   ├── SearchFilters.tsx         # Boolean Role Multi-Selector & filter bar
│   │   │   ├── UserProfilePanel.tsx      # Resume / LinkedIn PDF upload & encrypted editor
│   │   │   └── ui/                       # Reusable UI primitives
│   │   └── lib/
│   │       ├── auth.ts                   # Cookie & DB session management
│   │       ├── prisma.ts                 # Prisma Client singleton
│   │       ├── security.ts               # AES-256-GCM, HKDF-SHA256, scrypt & token hashing
│   │       ├── ai/                       # Provider catalog, unified LLM client, prompts
│       ├── documents.ts              # Encrypted cache of generated resumes / cover letters
│       ├── search.ts                 # Shared LinkedIn boolean query builder
│       └── settings.ts               # Per-user settings & effective AI configuration
├── docker-compose.yml     # Local PostgreSQL container service
├── .env.example           # Environment variables template
└── package.json           # Root scripts and dependencies
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** 20.x or higher
- **Docker** & **Docker Compose** (for PostgreSQL)
- **Google Chrome** browser
- An **AI provider**: an API key for Gemini, Claude, OpenAI, OpenRouter... **or** a local model with [Ollama](https://ollama.com/) (no key)

### 2. Installation
```bash
# 1. Clone repository
git clone https://github.com/AlanLenz/jobApplicationCopilot.git
cd jobApplicationCopilot

# 2. Install root dependencies
npm install

# 3. Install web application dependencies
cd ui
npm install
cd ..
```

### 3. Environment Configuration
Copy `.env.example` to `.env` in both the project root and `ui/` directory:
```bash
cp .env.example .env
cp .env.example ui/.env
```

Configure your `.env`:
```env
# Database connection string (PostgreSQL)
DATABASE_URL="postgresql://copilot_user:copilot_password@localhost:5432/job_copilot?schema=public"

# Master secret for AES-256-GCM encryption at rest (strongly recommended: openssl rand -hex 32)
DATA_ENCRYPTION_KEY="your_32_byte_random_secret_here"

# Default AI provider (users can override it in the "Configurações" tab)
AI_PROVIDER="gemini"            # gemini | anthropic | openai | openrouter | groq | deepseek | mistral | ollama | lmstudio | custom
AI_MODEL="gemini-3.8-flash"
GEMINI_API_KEY="your_gemini_api_key_here"   # or AI_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY ...
```
An existing `.env` with only `GEMINI_API_KEY` keeps working exactly as before. You can also leave the AI variables empty and configure everything in the dashboard.

### 4. Database Setup
```bash
# Start PostgreSQL via Docker Compose
docker-compose up -d

# Push Prisma schema to PostgreSQL
npm run db:push
```

### 5. Running the Application
```bash
cd ui
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser:
1. Click **Criar Conta Segura** to register your user account.
2. Open **Configurações**, pick your AI provider/model and click **Testar conexão** (skip if the server `.env` already has one).
3. Go to the **Meu Perfil & Currículo Base** tab and upload your **Resume PDF/TXT** or **LinkedIn PDF Export** (*Save to PDF*).
4. Return to **Descobrir Vagas**, select your desired target roles in the **Boolean Role Multi-Selector**, and click **Buscar Vagas (Run Scraper)**.
5. Optionally click **Avaliar com IA** to score jobs, then generate tailored ATS Resumes and Cover Letters, click **Aplicar** to record applications in **Vagas Aplicadas**, or **Recusar** to discard unwanted listings.

---

# 🇧🇷 Documentação em Português (Brasil)

## 📖 Visão Geral
O **Job Application Copilot** é uma plataforma full-stack baseada em IA projetada para automatizar a descoberta de vagas e a personalização de candidaturas com foco em privacidade e segurança criptográfica:

1. **Busca Booleana com Multiseletor de Cargos**: Monte queries booleanas avançadas (PT/EN) visualmente selecionando múltiplos cargos (além de tags personalizadas), senioridade, tempo de publicação, localidade e modelo de trabalho (Remoto, Híbrido, Presencial).
2. **Scraper Stealth do LinkedIn**: Coleta vagas reais no LinkedIn mantendo sua sessão autenticada e evitando duplicidades no PostgreSQL.
3. **Cofre de Perfil Profissional Criptografado (`AES-256-GCM`)**: Faça upload do seu **Currículo (PDF, TXT, MD)** ou do **PDF exportado do LinkedIn** (*Salvar como PDF*). O arquivo é processado 100% em memória RAM via IA multimodal e salvo criptografado em repouso no banco com chave exclusiva por usuário (`HKDF-SHA256`).
4. **Geração de Currículo ATS e Cover Letter sob Medida**: Cria currículos otimizados para sistemas ATS (com score de aderência e palavras-chave alinhadas) e cartas de apresentação persuasivas no mesmo idioma da vaga, prontos para cópia em texto puro ou impressão em PDF A4.
5. **Histórico de Buscas e de Vagas Aplicadas (Sem Registro de Recusadas)**: Registra automaticamente todas as buscas realizadas pelo usuário e mantém um histórico dedicado das **Vagas Aplicadas** com os documentos gerados. Vagas recusadas são excluídas imediatamente do banco de dados (`DELETE`), sem poluir o sistema.

---

## ✨ Principais Funcionalidades

### 1. 🎯 Multiseletor Booleano de Cargos e Filtros Sincronizados
- **Multiseletor de Cargos (PT/EN)**: Combine um ou mais cargos com operador `OR` entre 10 categorias pré-configuradas (*Software Engineer / Dev Geral*, *Full Stack*, *Front-end*, *Back-end*, *Mobile*, *DevOps / Cloud / SRE*, *Dados*, *IA / Machine Learning*, *QA / Automação de Testes* e *Tech Lead / Arquitetura*) ou adicione termos específicos manualmente à query booleana.
- **Filtros de Busca**: Defina **Senioridade** (*Estágio, Júnior, Pleno, Júnior & Pleno, Sênior, Todos*), **Tempo de Publicação** (*1h, 12h, 24h, 3 dias, 7 dias, 30 dias, Qualquer data*), **Localidade** e **Modelo de Trabalho** (*Remoto, Híbrido, Presencial*).
- **Preview em Tempo Real**: Visualize a expressão booleana exata e teste a URL de busca diretamente no LinkedIn.

### 2. 🔐 Cadastro de Usuário e Segurança das Informações
- **Autenticação Segura**: Cadastro e login com hash de senha via `scrypt` + salt aleatório de 16 bytes, comparação em tempo constante (`crypto.timingSafeEqual`) e sessões em cookie `HttpOnly` (`SameSite=Lax`) validadas por hash `SHA-256` no banco.
- **Criptografia Autenticada `AES-256-GCM` em Repouso**: Todas as informações profissionais do usuário (`encryptedResume`) e os documentos de candidatura (`encryptedCustomResume`, `encryptedCoverLetter`) são cifrados com `AES-256-GCM` usando IV aleatório de 96 bits e chave derivada exclusivamente para cada `userId` via `HKDF-SHA256`.
- **Upload 100% em Memória RAM**: Os arquivos PDF/TXT enviados nunca são salvos de forma bruta em pastas públicas do disco; o texto do PDF é extraído localmente (`unpdf`) e estruturado pela IA configurada; PDFs escaneados vão para provedores que leem PDF nativamente.
- **Exclusão Imediata**: O usuário pode apagar permanentemente seus dados profissionais do banco a qualquer momento pelo painel.

### 3. 📄 Geração Assertiva de Currículo ATS e Cover Letter
- **Personalização Fiel ao Perfil**: Descriptografa o perfil do usuário em memória durante a geração para destacar as experiências, métricas e tecnologias mais relevantes para a vaga, sem inventar informações.
- **Detecção Automática de Idioma**: Gera o currículo e a carta no idioma do anúncio da vaga (Português ou Inglês).
- **Visualização A4 e Texto Puro**: Alterne entre a visualização formatada para impressão/PDF e o texto puro otimizado para colagem em plataformas ATS.

### 4. 📊 Histórico de Buscas e Histórico de Vagas Aplicadas
- **Vagas Aplicadas**: Ao clicar em **Aplicar**, o sistema abre o link da vaga e registra a candidatura no seu histórico pessoal (`AppliedJob`), salvando a data, o score ATS e o currículo/cover letter gerados.
- **Descarte Limpo de Vagas Recusadas**: Ao clicar em **Recusar**, a vaga é removida imediatamente do banco de dados (`DELETE`), cumprindo a diretriz de não registrar vagas recusadas.
- **Histórico de Buscas**: Todas as buscas executadas no scraper ficam salvas com seus filtros e query booleana, permitindo **Carregar Filtros** ou **Repetir Busca** com 1 clique.

### 5. 🤖 Use a IA que Quiser + Tela de Configurações
- **Qualquer LLM**: Google Gemini, Anthropic Claude, OpenAI, OpenRouter, Groq, DeepSeek, Mistral, modelos locais via **Ollama / LM Studio** ou qualquer endpoint compatível com OpenAI. Escolhido por usuário na aba **Configurações**, com botão **Testar conexão**; a chave de API é criptografada com `AES-256-GCM` e nunca volta para o navegador. O `.env` do servidor (`AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL`) é o padrão.
- **Avaliação de Vagas com IA**: o botão **Avaliar com IA** dá uma nota (0-100) para cada vaga com base no seu perfil e nos critérios que você escreve em linguagem natural (ex.: *"somente remoto, exceto na minha cidade"*), com descarte automático opcional abaixo da nota mínima.
- **Presets de Busca Próprios**: cargos personalizados (nome + termos booleanos), filtros padrão, páginas por busca e localidades favoritas.

---

## 🛠 Stack Tecnológica

- **Ambiente & Linguagem**: Node.js, TypeScript (v5+)
- **Frontend & API**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide React, Radix UI / shadcn/ui
- **Inteligência Artificial (agnóstica de provedor)**: `ui/src/lib/ai/` encapsula `@google/genai`, `@anthropic-ai/sdk` e `openai` (qualquer API compatível com OpenAI) atrás de uma única API `generateJSON`/`generateText`; `unpdf` para extrair texto de PDFs localmente
- **Segurança & Criptografia**: Módulo nativo `crypto` do Node.js (`AES-256-GCM`, derivação de chave por usuário `HKDF-SHA256`, hash de senhas `scrypt`, hash de sessão `SHA-256`)
- **Automação & Scraping**: Playwright, `playwright-extra`, `puppeteer-extra-plugin-stealth`
- **Banco de Dados & ORM**: PostgreSQL, Prisma ORM (`User`, `Session`, `UserSettings`, `SearchHistory`, `AppliedJob`, `GeneratedDocument`, `Job`)
- **Extensão do Navegador**: Chrome Extension Manifest V3 (`extension/`)
- **Infraestrutura**: Docker & Docker Compose

---

## 🚀 Instalação e Uso

### 1. Pré-requisitos
- **Node.js** 20.x ou superior
- **Docker** e **Docker Compose**
- Navegador **Google Chrome**
- Um **provedor de IA**: chave do Gemini, Claude, OpenAI, OpenRouter... **ou** um modelo local com [Ollama](https://ollama.com/) (sem chave)

### 2. Instalação
```bash
# 1. Clonar o repositório
git clone https://github.com/AlanLenz/jobApplicationCopilot.git
cd jobApplicationCopilot

# 2. Instalar dependências da raiz
npm install

# 3. Instalar dependências da aplicação web
cd ui
npm install
cd ..
```

### 3. Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` na raiz e em `ui/.env`:
```bash
cp .env.example .env
cp .env.example ui/.env
```

Edite o `.env`:
```env
# Conexão com o banco PostgreSQL
DATABASE_URL="postgresql://copilot_user:copilot_password@localhost:5432/job_copilot?schema=public"

# Segredo mestre da criptografia AES-256-GCM (fortemente recomendado: openssl rand -hex 32)
DATA_ENCRYPTION_KEY="seu_segredo_aleatorio_de_32_bytes"

# Provedor de IA padrão (cada usuário pode trocar na aba "Configurações")
AI_PROVIDER="gemini"            # gemini | anthropic | openai | openrouter | groq | deepseek | mistral | ollama | lmstudio | custom
AI_MODEL="gemini-3.8-flash"
GEMINI_API_KEY="sua_chave_do_gemini_aqui"   # ou AI_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY ...
```
Um `.env` antigo só com `GEMINI_API_KEY` continua funcionando como antes. Também é possível deixar as variáveis de IA vazias e configurar tudo pelo painel.

### 4. Banco de Dados
```bash
# Subir o container PostgreSQL
docker-compose up -d

# Sincronizar o schema Prisma com o banco
npm run db:push
```

### 5. Iniciando a Aplicação
```bash
cd ui
npm run dev
```
Acesse **[http://localhost:3000](http://localhost:3000)**:
1. Clique em **Criar Conta Segura** no topo da página para cadastrar seu usuário.
2. Abra **Configurações**, escolha o provedor/modelo de IA e clique em **Testar conexão** (dispensável se o `.env` do servidor já tiver um).
3. Acesse a aba **Meu Perfil & Currículo Base** e faça o upload do seu **Currículo (PDF/TXT/MD)** ou do **PDF do Perfil do LinkedIn**.
4. Na aba **Descobrir Vagas**, escolha os cargos desejados no **Multiseletor Booleano**, ajuste a senioridade/localidade e clique em **Buscar Vagas (Run Scraper)**.
5. Opcionalmente clique em **Avaliar com IA** para dar notas às vagas, gere currículos ATS e Cover Letters personalizados, clique em **Aplicar** para salvar a vaga no seu **Histórico de Vagas Aplicadas**, ou em **Recusar** para descartá-la imediatamente.

---

## 📄 Licença
Distribuído sob a licença ISC.
