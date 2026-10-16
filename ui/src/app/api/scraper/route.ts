import { NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

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
  // If running inside ui/
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
    return NextResponse.json({
      success: false,
      message: 'Scraper is already running',
      state: global.__scraperState,
    }, { status: 409 });
  }

  let maxPages = 3;
  let timeRangeSeconds = 86400; // 24 hours

  try {
    const body = await request.json().catch(() => ({}));
    if (body.maxPages) maxPages = Number(body.maxPages);
    if (body.timeRangeSeconds) timeRangeSeconds = Number(body.timeRangeSeconds);
  } catch (e) {
    // defaults
  }

  const rootDir = getRootDir();

  global.__scraperState = {
    status: 'running',
    startedAt: new Date().toISOString(),
    endedAt: null,
    logs: [`[${new Date().toLocaleTimeString()}] Starting scraper for jobs from the last 24 hours (maxPages=${maxPages})...`],
    message: 'Scraping LinkedIn jobs from the last 24 hours...',
  };

  const env = {
    ...process.env,
    SCRAPER_MAX_PAGES: String(maxPages),
    SCRAPER_TIME_RANGE: String(timeRangeSeconds),
  };

  // Launch scraper child process
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
        global.__scraperState.logs.push(`[${new Date().toLocaleTimeString()}] Scraping completed successfully (exit code 0).`);
      } else {
        global.__scraperState.status = 'error';
        global.__scraperState.message = `Scraper stopped with exit code ${code}. Check logs for details.`;
        global.__scraperState.logs.push(`[${new Date().toLocaleTimeString()}] Scraper process exited with code ${code}.`);
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
