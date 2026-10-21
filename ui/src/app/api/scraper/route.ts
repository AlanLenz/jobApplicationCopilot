import { NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import {
  buildBooleanQueryFromFilters,
  buildPreviewLinkedInUrl,
} from '@/components/SearchFilters';

interface ScraperState {
  status: 'idle' | 'running' | 'completed' | 'error';
  startedAt: string | null;
  endedAt: string | null;
  logs: string[];
  message: string;
}

declare global {
  var __scraperState: ScraperState | undefined;
  var __scraperProcess: ChildProcess | null | undefined;
}

if (!global.__scraperState) {
  global.__scraperState = {
    status: 'idle',
    startedAt: null,
    endedAt: null,
    logs: [],
    message: 'Scraper is idle',
  };
}

function getRootDir(): string {
  if (fs.existsSync(path.resolve(process.cwd(), '..', 'src', 'scraper', 'linkedin.ts'))) {
    return path.resolve(process.cwd(), '..');
  }
  return process.cwd();
}

export async function GET() {
  return NextResponse.json(global.__scraperState);
}

export async function POST(request: Request) {
  if (global.__scraperState?.status === 'running') {
    return NextResponse.json(
      {
        success: false,
        message: 'Scraper is already running',
        state: global.__scraperState,
      },
      { status: 409 }
    );
  }

  let roles: string[] = ['software_engineer'];
  let maxPages = 3;
  let timeRangeSeconds = 86400; // 24 hours by default
  let seniority = 'all';
  let location = 'Worldwide';
  let workplaceType = 'all';
  let keywords = '';

  try {
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body.roles) && body.roles.length > 0) {
      roles = body.roles.map(String);
    }
    if (body.maxPages !== undefined) maxPages = Number(body.maxPages);
    if (body.timeRangeSeconds !== undefined) timeRangeSeconds = Number(body.timeRangeSeconds);
    if (body.seniority) seniority = String(body.seniority);
    if (body.location) location = String(body.location);
    if (body.workplaceType) workplaceType = String(body.workplaceType);
    if (body.keywords) keywords = String(body.keywords);
  } catch (e) {
    // defaults
  }

  const filterSnapshot = {
    roles,
    seniority,
    timeRangeSeconds,
    location,
    workplaceType,
  };
  const { finalKeywords } = buildBooleanQueryFromFilters(filterSnapshot);
  const searchUrl = buildPreviewLinkedInUrl(filterSnapshot);

  // Record search in user's SearchHistory if logged in
  let recordedSearch = null;
  try {
    const user = await getCurrentUser();
    if (user) {
      recordedSearch = await prisma.searchHistory.create({
        data: {
          userId: user.id,
          roles,
          seniority,
          location,
          workplaceType,
          timeRangeSeconds,
          booleanQuery: keywords || finalKeywords,
          searchUrl,
        },
      });
    }
  } catch (err) {
    console.warn('Could not save search history:', err);
  }

  const rootDir = getRootDir();

  global.__scraperState = {
    status: 'running',
    startedAt: new Date().toISOString(),
    endedAt: null,
    logs: [
      `[${new Date().toLocaleTimeString()}] Starting scraper (roles=${roles.join(',')}, seniority=${seniority}, location="${location}", workplace=${workplaceType}, timeRange=${timeRangeSeconds}s, maxPages=${maxPages})...`,
      `[${new Date().toLocaleTimeString()}] Boolean Query: ${keywords || finalKeywords}`,
    ],
    message: 'Scraping LinkedIn jobs with custom boolean filters...',
  };

  const env = {
    ...process.env,
    SCRAPER_ROLES: roles.join(','),
    SCRAPER_MAX_PAGES: String(maxPages),
    SCRAPER_TIME_RANGE: String(timeRangeSeconds),
    SCRAPER_SENIORITY: seniority,
    SCRAPER_LOCATION: location,
    SCRAPER_WORKPLACE: workplaceType,
    ...(keywords ? { SCRAPER_KEYWORDS: keywords } : {}),
  };

  const child = spawn('npx tsx src/scraper/linkedin.ts', {
    cwd: rootDir,
    env,
    shell: true,
  });

  global.__scraperProcess = child;

  child.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;
      console.log(`[Scraper] ${cleanLine}`);
      global.__scraperState?.logs.push(`[${new Date().toLocaleTimeString()}] ${cleanLine}`);
      if (global.__scraperState && global.__scraperState.logs.length > 200) {
        global.__scraperState.logs.shift();
      }
    }
  });

  child.stderr?.on('data', (data) => {
    const text = data.toString().trim();
    if (text) {
      console.error(`[Scraper Error] ${text}`);
      global.__scraperState?.logs.push(`[${new Date().toLocaleTimeString()}] [WARN/ERR] ${text}`);
    }
  });

  child.on('close', (code) => {
    global.__scraperProcess = null;
    if (global.__scraperState) {
      global.__scraperState.endedAt = new Date().toISOString();
      if (code === 0) {
        global.__scraperState.status = 'completed';
        global.__scraperState.message = 'Scraping completed successfully!';
        global.__scraperState.logs.push(
          `[${new Date().toLocaleTimeString()}] Scraping completed successfully (exit code 0).`
        );
      } else {
        global.__scraperState.status = 'error';
        global.__scraperState.message = `Scraper stopped with exit code ${code}. Check logs for details.`;
        global.__scraperState.logs.push(
          `[${new Date().toLocaleTimeString()}] Scraper process exited with code ${code}.`
        );
      }
    }
  });

  child.on('error', (err) => {
    global.__scraperProcess = null;
    if (global.__scraperState) {
      global.__scraperState.status = 'error';
      global.__scraperState.endedAt = new Date().toISOString();
      global.__scraperState.message = `Scraper error: ${err.message}`;
      global.__scraperState.logs.push(`[${new Date().toLocaleTimeString()}] Scraper error: ${err.message}`);
    }
  });

  return NextResponse.json({
    success: true,
    message: 'Scraper started',
    state: global.__scraperState,
    recordedSearch,
  });
}

export async function DELETE() {
  if (global.__scraperProcess) {
    global.__scraperProcess.kill();
    global.__scraperProcess = null;
    if (global.__scraperState) {
      global.__scraperState.status = 'idle';
      global.__scraperState.message = 'Scraper terminated by user.';
      global.__scraperState.logs.push(`[${new Date().toLocaleTimeString()}] Scraper terminated by user.`);
    }
    return NextResponse.json({ success: true, message: 'Scraper stopped' });
  }

  return NextResponse.json({ success: false, message: 'No scraper is running' });
}
