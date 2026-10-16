import fs from 'fs';
import path from 'path';

// Store in root JobApplicationCopilot/generated directory
const ROOT_DIR = path.resolve(process.cwd(), '..');
const GENERATED_DIR = path.join(ROOT_DIR, 'generated');
const RESUMES_DIR = path.join(GENERATED_DIR, 'resumes');
const COVER_LETTERS_DIR = path.join(GENERATED_DIR, 'cover_letters');

function ensureDirectories() {
  if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });
  if (!fs.existsSync(RESUMES_DIR)) fs.mkdirSync(RESUMES_DIR, { recursive: true });
  if (!fs.existsSync(COVER_LETTERS_DIR)) fs.mkdirSync(COVER_LETTERS_DIR, { recursive: true });
}

export function saveGeneratedDocument(jobId: string, type: 'resume' | 'cover_letter', text: string, html: string) {
  ensureDirectories();
  const dir = type === 'resume' ? RESUMES_DIR : COVER_LETTERS_DIR;
  
  fs.writeFileSync(path.join(dir, `${jobId}.txt`), text, 'utf-8');
  fs.writeFileSync(path.join(dir, `${jobId}.html`), html, 'utf-8');
}

export function getGeneratedDocument(jobId: string, type: 'resume' | 'cover_letter'): { text: string; html: string } | null {
  ensureDirectories();
  const dir = type === 'resume' ? RESUMES_DIR : COVER_LETTERS_DIR;
  const txtPath = path.join(dir, `${jobId}.txt`);
  const htmlPath = path.join(dir, `${jobId}.html`);

  if (fs.existsSync(txtPath) && fs.existsSync(htmlPath)) {
    return {
      text: fs.readFileSync(txtPath, 'utf-8'),
      html: fs.readFileSync(htmlPath, 'utf-8'),
    };
  }
  return null;
}

export function hasGeneratedDocument(jobId: string, type: 'resume' | 'cover_letter'): boolean {
  const dir = type === 'resume' ? RESUMES_DIR : COVER_LETTERS_DIR;
  return fs.existsSync(path.join(dir, `${jobId}.txt`));
}

export function getMasterResume(): string {
  const possiblePaths = [
    path.join(ROOT_DIR, 'resume.txt'),
    path.join(process.cwd(), 'resume.txt'),
    path.join(ROOT_DIR, 'resume.example.txt'),
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
        return fs.readFileSync(/*turbopackIgnore: true*/ p, 'utf-8');
      }
    } catch (e) {
      // Continue searching next candidate path
    }
  }

  return 'Candidate Profile - Full Stack Engineer (React, TypeScript, Node.js, PostgreSQL)';
}
