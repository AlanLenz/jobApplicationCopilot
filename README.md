# 🚀 Job Application Copilot

<p align="center">
  <b>Autonomous, AI-Powered Job Search, Evaluation, and Application Assistant</b><br>
  <i>Assistente autônomo baseado em IA para busca, avaliação e aplicação em vagas de emprego</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Google%20Gemini-3.8%20Flash-orange?style=flat-square&logo=google" alt="Gemini AI" />
  <img src="https://img.shields.io/badge/Playwright-Stealth-green?style=flat-square&logo=playwright" alt="Playwright" />
  <img src="https://img.shields.io/badge/Prisma-PostgreSQL-indigo?style=flat-square&logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/Chrome_Extension-Manifest_V3-yellow?style=flat-square&logo=googlechrome" alt="Chrome Extension" />
</p>

---

## 🌐 Language / Idioma
- [English Documentation](#-english-documentation)
- [Documentação em Português (Brasil)](#-documentação-em-português-brasil)

---

# 🇺🇸 English Documentation

## 📖 Overview
**Job Application Copilot** is a full-stack automation platform designed to end job search fatigue. Instead of manually scrolling through job boards, guessing ATS compatibility, and hand-crafting cover letters for every application, this copilot automates the complete pipeline:

1. **Scrapes fresh job listings** directly from LinkedIn Jobs (and configurable ATS boards) with stealth automation.
2. **Evaluates job-to-candidate fit** with Google Gemini AI (`gemini-3.8-flash`), matching against your master resume and strict custom criteria (e.g., location, remote flexibility, visa sponsorship).
3. **Generates tailored ATS-optimized resumes and cover letters** for high-match opportunities, providing both plain text and clean, print-ready A4 HTML.
4. **Visualizes and tracks applications** via a modern Next.js 16 web dashboard featuring real-time scraper controls and streaming terminal logs.
5. **Auto-fills job applications** via an accompanying Manifest V3 Chrome Extension.

---

## ✨ Key Features

### 1. 🔍 Automated LinkedIn Job Scraper
- **Targeted Listing Extraction**: Scrapes real LinkedIn job search listings by customizable boolean keywords (e.g. Junior/Mid-level software engineering roles) and time windows (e.g. posted within the last 24 hours).
- **Stealth & Session Persistence**: Uses `playwright-extra` with `puppeteer-extra-plugin-stealth` and a persistent Chrome user data directory (`chrome-data/`) to preserve your LinkedIn login session and prevent bot detection.
- **Deduplication**: Automatically checks URLs against PostgreSQL via Prisma before saving, avoiding duplicate records.

### 2. 🧠 Smart AI Fit Evaluation (Google Gemini)
- **Fast Pre-filtering**: Analyzes title and description against fast regex criteria (e.g., location/remote/visa rules) before invoking the LLM, reducing API consumption and rate limits.
- **Deep Semantic Matching**: Evaluates the candidate's master resume (`resume.txt`) against the job description using `gemini-3.8-flash` with structured JSON schema output (`match_score`, `reason`, `custom_cover_letter`).
- **Automated Triage**: Automatically categorizes jobs into `approved` (match score > 80) or `rejected`.

### 3. 📄 Tailored Document Generation
- **ATS Resume Optimization**: Creates tailored resumes aligning technical keywords, summary, and experience bullet points directly with the target job requirements without fabricating experience.
- **Persuasive Cover Letters**: Generates 3–4 paragraph personalized cover letters with compelling opening hooks, concrete project metrics, and calls to action.
- **Dual Format Output**: Provides clean raw text for online forms and elegant, print-ready A4 HTML for PDF export.
- **Disk & DB Caching**: Automatically saves generated documents to disk (`generated/`) and updates database records.

### 4. 💻 Interactive Web Dashboard (Next.js 16 + Tailwind CSS)
- **Job Opportunity Kanban / List**: View all scraped jobs with company, title, match score badges, and AI reasoning.
- **Live Scraper Controller**: Trigger scraping runs directly from the browser UI with customizable page depth and time range, complete with a real-time streaming terminal log dialog.
- **Document Previews & Actions**: One-click preview of tailored resumes and cover letters with raw text copy and print-to-PDF triggers.
- **Application Status Management**: Transition jobs between `pending_evaluation`, `approved`, `rejected`, and `applied`.

### 5. 🧩 Chrome Extension (Auto-Filler)
- Manifest V3 browser extension to communicate with the dashboard and auto-populate personal details (name, email, LinkedIn, GitHub) into application forms.

---

## 🏗 System Architecture

```mermaid
flowchart TD
    subgraph Scraping["1. Scraping Layer"]
        A[Playwright Stealth Session] -->|Targeted LinkedIn Search| B[Extract Job Listings]
        B -->|Deduplicate & Persist| DB[(PostgreSQL Database)]
    end

    subgraph AI["2. AI Evaluation & Generation"]
        DB -->|Pending Jobs| C[Fast Pre-Filter]
        C -->|Passed Jobs| D[Google Gemini 3.8 Flash]
        D -->|Score & Reason| DB
        D -->|Tailored Resume & Letter| CACHE[Disk Cache & DB]
    end

    subgraph UI["3. Interface & Execution"]
        E[Next.js Dashboard] <-->|Prisma ORM & REST APIs| DB
        E -->|Trigger & Stream Logs| A
        E -->|Preview & Print| CACHE
        F[Chrome Extension] <-->|Auto-Fill Application Forms| E
    end
```

---

## 🛠 Tech Stack

- **Runtime & Language**: Node.js, TypeScript (v5+)
- **Frontend Dashboard**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide React, Radix UI / shadcn/ui
- **AI & LLM**: Google Gemini API via `@google/genai` (`gemini-3.8-flash`)
- **Scraping Engine**: Playwright, `playwright-extra`, `puppeteer-extra-plugin-stealth`
- **Database & ORM**: PostgreSQL, Prisma ORM
- **Browser Extension**: Chrome Extension Manifest V3
- **Containerization**: Docker & Docker Compose

---

## 📁 Project Structure

```text
JobApplicationCopilot/
├── chrome-data/           # Persistent Chrome profile for authenticated scraping
├── extension/             # Manifest V3 Chrome Extension (Auto-Filler)
│   ├── manifest.json      # Extension metadata & permissions
│   ├── popup.html         # Extension popup UI
│   ├── popup.js           # Autofill script launcher
│   └── content.js         # Content script for web interaction
├── generated/             # Cached generated resumes and cover letters
├── prisma/
│   └── schema.prisma      # Database schema (Job entity & statuses)
├── scripts/
│   └── clean_db.ts        # Database cleanup helper utility
├── src/
│   ├── ai/
│   │   └── evaluator.ts   # Gemini AI job evaluator & scorer
│   └── scraper/
│       ├── index.ts       # ATS job board scraper scaffold
│       └── linkedin.ts    # Stealth Playwright LinkedIn job listings scraper
├── ui/                    # Next.js 16 Web Dashboard
│   ├── src/
│   │   ├── app/           # App Router pages and API routes
│   │   │   ├── api/generate/route.ts  # Resume & Cover letter AI generator
│   │   │   ├── api/jobs/route.ts      # Jobs CRUD & filtering
│   │   │   ├── api/scraper/route.ts   # Scraper runner & streaming log manager
│   │   │   └── page.tsx               # Main Dashboard UI
│   │   ├── components/ui/             # Reusable UI components
│   │   └── lib/                       # Prisma client, storage helpers, utils
├── docker-compose.yml     # Local PostgreSQL container service
├── package.json           # Root scripts and scraper dependencies
├── resume.example.txt     # Template for candidate master profile / resume
└── tsconfig.json          # TypeScript configuration
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** 20.x or higher
- **npm** or **pnpm**
- **Docker** & **Docker Compose** (for PostgreSQL)
- **Google Chrome** browser
- **Google Gemini API Key** (obtainable via [Google AI Studio](https://aistudio.google.com/))

### 2. Installation
Clone the repository and install dependencies in both the root and UI directories:

```bash
# 1. Clone repository
git clone https://github.com/your-username/JobApplicationCopilot.git
cd JobApplicationCopilot

# 2. Install root dependencies
npm install

# 3. Install dashboard dependencies
cd ui
npm install
cd ..
```

### 3. Environment Configuration
Create a `.env` file in the root directory (you can copy `.env.example`):

```bash
cp .env.example .env
```

Ensure your `.env` contains:
```env
# Database connection string
DATABASE_URL="postgresql://copilot_user:copilot_password@localhost:5432/job_copilot?schema=public"

# Google Gemini API Key
GEMINI_API_KEY="your_actual_gemini_api_key_here"
```

### 4. Database Setup
Start the local PostgreSQL container and push the Prisma schema:

```bash
# Start PostgreSQL via Docker Compose
docker-compose up -d

# Push the Prisma schema to create tables
npm run db:push
```

### 5. Candidate Profile Configuration
Copy the template to create your `resume.txt` (which is safely ignored by Git):

```bash
cp resume.example.txt resume.txt
```

Edit `resume.txt` with your complete work experience, skills, projects, and education. The AI evaluator and document generators will use this file as the ground truth.

---

## 🎮 Usage Guide

### Option A: Using the Web Dashboard (Recommended)
1. Start the Next.js development server:
   ```bash
   cd ui
   npm run dev
   ```
2. Open [http://localhost:3000](http://localhost:3000) in your browser.
3. Click **"Run Scraper (Last 24h)"** to launch the LinkedIn scraper in the background with live log streaming.
4. Review scraped jobs, view AI fit evaluations, and generate tailored resumes and cover letters with a single click.

### Option B: Running via CLI

#### 1. Scrape LinkedIn Job Listings
```bash
npm run scrape:linkedin
```
> **Note**: On the first run, a browser window will open if you are not logged in. Log into LinkedIn manually; your session will be saved in `chrome-data/` for future automated runs.

#### 2. Run AI Job Evaluation
```bash
npm run evaluate
```
This evaluates all unrated jobs (`pending_evaluation`) against `resume.txt` using Gemini 3.8 Flash, assigning fit scores and updating job records.

#### 3. Inspect Database
To browse and manage your database interactively:
```bash
npm run db:studio
```

### Loading the Chrome Extension
1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** (top-right corner).
3. Click **Load unpacked** and select the `extension/` folder from this project.
4. When on an active application page, click the extension icon to auto-fill form inputs.

---

# 🇧🇷 Documentação em Português (Brasil)

## 📖 Visão Geral
O **Job Application Copilot** é uma plataforma completa de automação desenvolvida para eliminar o cansaço do processo de busca por emprego. Em vez de passar horas procurando vagas manualmente, tentando adivinhar como agradar sistemas ATS e escrevendo cartas de apresentação do zero para cada vaga, o copilot automatiza todo o ciclo:

1. **Varre vagas recentes** diretamente do LinkedIn Jobs (e plataformas ATS configuráveis) de forma silenciosa e resiliente a bloqueios.
2. **Avalia a compatibilidade da vaga com o candidato** usando a inteligência artificial do Google Gemini (`gemini-3.8-flash`), comparando a vaga com seu currículo mestre e regras personalizadas (ex.: localização, trabalho remoto e visto).
3. **Gera currículos customizados otimizados para ATS e cartas de apresentação** para as vagas com alta aderência, tanto em texto simples quanto em templates HTML A4 prontos para impressão.
4. **Permite gerenciar e visualizar as candidaturas** por meio de um dashboard moderno em Next.js 16 com controle em tempo real do scraper e terminal de logs ao vivo.
5. **Preenche formulários de candidatura** com uma extensão para Google Chrome (Manifest V3).

---

## ✨ Principais Funcionalidades

### 1. 🔍 Scraper Automatizado do LinkedIn Jobs
- **Extração Focada em Vagas**: Busca anúncios de emprego reais no LinkedIn usando filtros booleanos (ex.: desenvolvedores Júnior/Pleno, excluindo Sênior/Lead/Principal) e janelas temporais configuráveis (ex.: últimas 24 horas).
- **Modo Stealth e Sessão Persistente**: Utiliza `playwright-extra` com `puppeteer-extra-plugin-stealth` e diretório de sessão local (`chrome-data/`), mantendo você logado e evitando bloqueios de automação.
- **Deduplicação Inteligente**: Verifica se o link já existe no banco PostgreSQL antes de salvar, garantindo uma base limpa.

### 2. 🧠 Avaliação Inteligente de Fit com IA (Google Gemini)
- **Pré-filtro Rápido por Regex**: Antes de gastar tokens da API, filtra requisitos indispensáveis (ex.: vagas em Cascavel, vagas remotas ou com visto), economizando custos e evitando limites de taxa.
- **Análise Semântica Estruturada**: Avalia o perfil mestre (`resume.txt`) contra a descrição completa da vaga através do modelo `gemini-3.8-flash` com saída em JSON estrito (`match_score`, `reason`, `custom_cover_letter`).
- **Triagem Automática**: Classifica automaticamente vagas como aprovadas (`approved`, pontuação > 80) ou rejeitadas (`rejected`).

### 3. 📄 Geração de Documentos Personalizados
- **Currículo Otimizado para ATS**: Reorganiza e ajusta palavras-chave, resumo e conquistas para a vaga desejada sem inventar informações falsas.
- **Cartas de Apresentação Persuasivas**: Redige cartas direcionadas de 3 a 4 parágrafos com ganchos de abertura fortes, menção a projetos relevantes e chamada para ação.
- **Saída Dupla**: Disponibiliza texto puro para colar em formulários e template HTML formatado em folha A4 para impressão ou salvamento em PDF.
- **Cache Local e no Banco**: Salva documentos em pasta local (`generated/`) e atualiza o banco de dados.

### 4. 💻 Painel Web Interativo (Next.js 16 + Tailwind CSS)
- **Visualização de Vagas**: Lista interativa com empresa, cargo, nota de match e justificativa da IA.
- **Acionamento do Scraper com Logs**: Permite disparar o scraper diretamente da interface web, acompanhando a saída do terminal em tempo real.
- **Pré-visualização e Ações**: Modal com abas para visualizar o HTML formatado ou copiar o texto simples com um clique.
- **Fluxo de Candidatura**: Gerencie o ciclo de vida da vaga (`pending_evaluation`, `approved`, `rejected`, `applied`).

### 5. 🧩 Extensão para Google Chrome
- Extensão em Manifest V3 que preenche automaticamente dados pessoais (nome, e-mail, perfil do LinkedIn, GitHub) em páginas de formulários de emprego.

---

## 🛠 Stack Tecnológica

- **Linguagem & Ambiente**: Node.js, TypeScript (v5+)
- **Dashboard Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide React, Radix UI / shadcn/ui
- **Inteligência Artificial**: Google Gemini API via `@google/genai` (`gemini-3.8-flash`)
- **Automação & Scraping**: Playwright, `playwright-extra`, `puppeteer-extra-plugin-stealth`
- **Banco de Dados & ORM**: PostgreSQL, Prisma ORM
- **Extensão do Navegador**: Chrome Extensions API (Manifest V3)
- **Infraestrutura**: Docker & Docker Compose

---

## 🚀 Instalação e Configuração

### 1. Pré-requisitos
- **Node.js** 20.x ou superior
- **npm** ou **pnpm**
- **Docker** e **Docker Compose**
- Navegador **Google Chrome** instalado
- Chave de API do **Google Gemini** ([Google AI Studio](https://aistudio.google.com/))

### 2. Clonando o Repositório e Instalando
```bash
# 1. Clonar o repositório
git clone https://github.com/seu-usuario/JobApplicationCopilot.git
cd JobApplicationCopilot

# 2. Instalar dependências da raiz (scraper e IA)
npm install

# 3. Instalar dependências da interface web
cd ui
npm install
cd ..
```

### 3. Configuração de Variáveis de Ambiente
Copie o arquivo de exemplo para criar seu `.env`:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:
```env
# Conexão com o banco PostgreSQL
DATABASE_URL="postgresql://copilot_user:copilot_password@localhost:5432/job_copilot?schema=public"

# Chave de API do Google Gemini
GEMINI_API_KEY="sua_chave_do_gemini_aqui"
```

### 4. Inicializando o Banco de Dados
Inicie o container PostgreSQL e sincronize o schema do Prisma:

```bash
# Subir o container PostgreSQL
docker-compose up -d

# Criar as tabelas no banco de dados
npm run db:push
```

### 5. Adicionando seu Currículo
Copie o template de exemplo para criar seu `resume.txt` (que está protegido e ignorado pelo Git):

```bash
cp resume.example.txt resume.txt
```

Edite o arquivo `resume.txt` com seu currículo completo (experiências, formação, projetos e tecnologias). Esse texto servirá como base de verdade para a IA.

---

## 🎮 Como Usar

### Pelo Painel Web (Recomendado)
1. Inicie o servidor do dashboard:
   ```bash
   cd ui
   npm run dev
   ```
2. Acesse [http://localhost:3000](http://localhost:3000).
3. Clique em **"Run Scraper (Last 24h)"** para iniciar a busca de vagas em segundo plano com logs ao vivo.
4. Visualize as vagas coletadas, analise a pontuação de aderência e gere currículos e cartas personalizados com um clique.

### Pela Linha de Comando (CLI)

#### 1. Coleta de Vagas no LinkedIn
```bash
npm run scrape:linkedin
```
> **Dica**: Na primeira execução, o navegador abrirá caso você não esteja autenticado. Faça o login normalmente no LinkedIn; os cookies e sessão serão gravados na pasta `chrome-data/` para execuções futuras.

#### 2. Avaliação de Vagas com Gemini
```bash
npm run evaluate
```
Avalia todas as vagas pendentes em lote contra seu `resume.txt`, atribuindo notas de 0 a 100 e justificativas detalhadas.

#### 3. Visualizador do Banco de Dados
```bash
npm run db:studio
```

### Instalando a Extensão no Chrome
1. Abra o Google Chrome e navegue até `chrome://extensions/`.
2. Ative o **Modo do desenvolvedor** no canto superior direito.
3. Clique em **Carregar sem compactação** e selecione a pasta `extension/` deste projeto.
4. Ao abrir uma página de candidatura, use a extensão para preencher os campos automaticamente.

---

## 📄 Licença
Distribuído sob a licença ISC. Sinta-se livre para customizar e adaptar para sua própria busca de emprego!
