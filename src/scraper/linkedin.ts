import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { PrismaClient } from '@prisma/client';
import path from 'path';

chromium.use(stealth());
const prisma = new PrismaClient();

export const ROLE_BOOLEAN_MAP: Record<string, string> = {
  software_engineer: '"Desenvolvedor" OR "Developer" OR "Software Engineer" OR "Engenheiro de Software"',
  fullstack: '"Full Stack" OR "Fullstack" OR "Desenvolvedor Full Stack" OR "Full Stack Developer" OR "Full Stack Engineer"',
  frontend: '"Frontend" OR "Front-end" OR "Desenvolvedor Front-end" OR "Frontend Developer" OR "Frontend Engineer" OR "React Developer"',
  backend: '"Backend" OR "Back-end" OR "Desenvolvedor Back-end" OR "Backend Developer" OR "Backend Engineer"',
  mobile: '"Mobile Developer" OR "Desenvolvedor Mobile" OR "React Native" OR "Flutter" OR "iOS Developer" OR "Android Developer"',
  devops: '"DevOps" OR "SRE" OR "Site Reliability Engineer" OR "Cloud Engineer" OR "Platform Engineer"',
  data: '"Data Engineer" OR "Engenheiro de Dados" OR "Data Scientist" OR "Cientista de Dados" OR "Data Analyst"',
  ai_ml: '"AI Engineer" OR "Machine Learning Engineer" OR "Engenheiro de IA" OR "LLM" OR "GenAI"',
  qa: '"QA" OR "Quality Assurance" OR "Analista de Testes" OR "Test Automation" OR "SDET"',
  tech_lead: '"Tech Lead" OR "Software Architect" OR "Arquiteto de Software" OR "Staff Engineer" OR "Engineering Manager"',
};

export const BASE_ROLE_KEYWORDS = `(${ROLE_BOOLEAN_MAP.software_engineer})`;
export const DEFAULT_SEARCH_KEYWORDS = `${BASE_ROLE_KEYWORDS} AND ("Junior" OR "Jr" OR "Pleno" OR "Mid level" OR "Mid-level") NOT ("Senior" OR "Sr" OR "Lead" OR "Principal" OR "Staff")`;

export interface LinkedInSearchOptions {
  roles?: string[];
  keywords?: string;
  seniority?: string; // 'all' | 'internship' | 'junior' | 'pleno' | 'jr-pleno' | 'senior'
  location?: string;
  timeRangeSeconds?: number; // e.g., 86400 (24h), 604800 (7d), 2592000 (30d), 0 (any)
  workplaceType?: string; // 'all' | 'remote' | 'hybrid' | 'onsite'
  maxPages?: number;
}

export function buildRolesBooleanClause(roles?: string[]): string {
  if (!roles || roles.length === 0) {
    return BASE_ROLE_KEYWORDS;
  }

  const expressions = roles
    .map((r) => r.trim())
    .filter(Boolean)
    .map((roleKey) => {
      if (ROLE_BOOLEAN_MAP[roleKey]) {
        return ROLE_BOOLEAN_MAP[roleKey];
      }
      const sanitized = roleKey.replace(/"/g, '').trim();
      return `"${sanitized}"`;
    });

  if (expressions.length === 0) {
    return BASE_ROLE_KEYWORDS;
  }

  return `(${expressions.join(' OR ')})`;
}

export function buildBooleanSearchQuery(roles?: string[], seniority = 'all'): { finalKeywords: string; f_E: string } {
  const roleClause = buildRolesBooleanClause(roles);
  let finalKeywords = roleClause;
  let f_E = '';

  switch (seniority) {
    case 'internship':
      finalKeywords = `${roleClause} AND ("Estágio" OR "Estagiário" OR "Intern" OR "Internship" OR "Trainee")`;
      f_E = '1';
      break;
    case 'junior':
    case 'entry':
      finalKeywords = `${roleClause} AND ("Junior" OR "Júnior" OR "Jr" OR "Entry Level" OR "Entry-level") NOT ("Senior" OR "Sr" OR "Pleno" OR "Lead" OR "Staff")`;
      f_E = '2';
      break;
    case 'pleno':
    case 'mid':
      finalKeywords = `${roleClause} AND ("Pleno" OR "Mid level" OR "Mid-level" OR "Middle") NOT ("Senior" OR "Sr" OR "Lead" OR "Principal" OR "Staff")`;
      f_E = '3,4';
      break;
    case 'jr-pleno':
      finalKeywords = `${roleClause} AND ("Junior" OR "Jr" OR "Pleno" OR "Mid level" OR "Mid-level") NOT ("Senior" OR "Sr" OR "Lead" OR "Principal" OR "Staff")`;
      f_E = '2,3,4';
      break;
    case 'senior':
      finalKeywords = `${roleClause} AND ("Senior" OR "Sênior" OR "Sr" OR "Lead" OR "Staff" OR "Principal" OR "Especialista")`;
      f_E = '4,5';
      break;
    case 'all':
    default:
      finalKeywords = roleClause;
      f_E = '';
      break;
  }

  return { finalKeywords, f_E };
}

export function buildLinkedInSearchUrl(options: LinkedInSearchOptions): string {
  const {
    roles,
    keywords,
    seniority = 'all',
    location = 'Worldwide',
    timeRangeSeconds = 86400,
    workplaceType = 'all',
  } = options;

  const built = buildBooleanSearchQuery(roles, seniority);
  const finalKeywords = keywords?.trim() ? keywords.trim() : built.finalKeywords;
  const f_E = built.f_E;

  // LinkedIn f_WT codes: 1=On-site (Presencial), 2=Remote (Remoto), 3=Hybrid (Híbrido)
  let f_WT = '';
  switch (workplaceType) {
    case 'onsite':
    case 'presencial':
    case '1':
      f_WT = '1';
      break;
    case 'remote':
    case 'remoto':
    case '2':
      f_WT = '2';
      break;
    case 'hybrid':
    case 'hibrido':
    case '3':
      f_WT = '3';
      break;
    default:
      f_WT = '';
      break;
  }

  const params = new URLSearchParams();
  params.set('keywords', finalKeywords);
  if (location && location.trim()) {
    params.set('location', location.trim());
  }
  if (timeRangeSeconds && timeRangeSeconds > 0) {
    params.set('f_TPR', `r${timeRangeSeconds}`);
  }
  if (f_E) {
    params.set('f_E', f_E);
  }
  if (f_WT) {
    params.set('f_WT', f_WT);
  }

  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

export async function scrapeLinkedInJobs(optionsOrKeywords: LinkedInSearchOptions | string = {}, location = 'Worldwide', maxPages = 3, timeRangeSeconds = 86400) {
  const options: LinkedInSearchOptions = typeof optionsOrKeywords === 'string'
    ? { keywords: optionsOrKeywords, location, maxPages, timeRangeSeconds }
    : {
        roles: optionsOrKeywords.roles,
        location: optionsOrKeywords.location || location,
        maxPages: optionsOrKeywords.maxPages ?? maxPages,
        timeRangeSeconds: optionsOrKeywords.timeRangeSeconds ?? timeRangeSeconds,
        seniority: optionsOrKeywords.seniority || 'all',
        workplaceType: optionsOrKeywords.workplaceType || 'all',
        keywords: optionsOrKeywords.keywords,
      };

  const pagesToScrape = options.maxPages ?? 3;
  console.log('Launching Persistent Chrome Session...');
  const userDataDir = path.join(process.cwd(), 'chrome-data');
  
  const context = await chromium.launchPersistentContext(userDataDir, { 
      headless: false,
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  console.log('Checking LinkedIn Authentication...');
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
  
  if (page.url().includes('login') || page.url().includes('signup') || await page.$('.sign-in-form__submit-button')) {
      console.log('⚠️ You are NOT logged in. Please log in manually in the browser window.');
      console.log('Waiting up to 3 minutes for you to log in...');
      try {
          await page.waitForURL('**/feed/**', { timeout: 180000 });
          console.log('✅ Login detected! Proceeding to job search...');
      } catch (e) {
          console.error('❌ Login timeout. Exiting.');
          await context.close();
          return;
      }
  }

  const baseUrl = buildLinkedInSearchUrl(options);
  console.log(`Constructed Search URL: ${baseUrl}`);
  
  let currentPage = 1;

  while (currentPage <= pagesToScrape) {
      console.log(`\n--- Scraping Page ${currentPage} ---`);
      
      const pageOffset = (currentPage - 1) * 25;
      const pageUrl = `${baseUrl}&start=${pageOffset}`;
      console.log(`Navigating to Job Search: ${pageUrl}`);
      
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      
      try {
          await page.waitForSelector('li.jobs-search-results__list-item, div.job-card-container, div[data-job-id]', { timeout: 10000 });
      } catch (e) {
          console.log('No job cards found on this page or end of results reached.');
          break;
      }

      console.log('Scrolling down the list to load all jobs on this page...');
      let previousCount = 0;
      for (let i = 0; i < 8; i++) { 
          const currentCards = await page.$$('li.jobs-search-results__list-item, div.job-card-container, div[data-job-id]');
          if (currentCards.length === previousCount && i > 0) break; // no new cards loaded
          
          if (currentCards.length > 0) {
             const lastCard = currentCards[currentCards.length - 1];
             await lastCard.scrollIntoViewIfNeeded();
             await page.waitForTimeout(1500); // wait for lazy load
          }
          previousCount = currentCards.length;
      }

      const jobCards = await page.$$('li.jobs-search-results__list-item, div.job-card-container, div[data-job-id]');
      console.log(`Found ${jobCards.length} potential jobs on page ${currentPage}. Extracting...`);

      if (jobCards.length === 0) break;

      for (const card of jobCards) {
          try {
              // Click the card to load details in the right pane
              await card.scrollIntoViewIfNeeded();
              await card.click();
              await page.waitForTimeout(1500 + Math.random() * 1000); 

              const titleEl = await card.$('.job-card-list__title, strong');
              const companyEl = await card.$('.artdeco-entity-lockup__subtitle, .job-card-container__primary-description');
              const locationEl = await card.$('.artdeco-entity-lockup__caption, .job-card-container__metadata-wrapper li');
              
              if (!titleEl || !companyEl) continue;

              const title = (await titleEl.innerText()).trim();
              const company = (await companyEl.innerText()).trim();
              const jobLocation = locationEl ? (await locationEl.innerText()).trim() : 'Location not specified';
              
              const urlObj = new URL(page.url());
              const currentJobId = urlObj.searchParams.get('currentJobId');
              let url = currentJobId ? `https://www.linkedin.com/jobs/view/${currentJobId}/` : page.url();

              // Check if already saved
              const existingJob = await prisma.job.findUnique({ where: { url } });
              if (existingJob) {
                  continue;
              }

              let description = '';
              try {
                  await page.waitForSelector('.jobs-description-content__text, .jobs-description__container', { timeout: 3000 });
                  const descEl = await page.$('.jobs-description-content__text, .jobs-description__container');
                  if (descEl) description = await descEl.innerText();
              } catch (e) {
                  console.log(`Failed to load description pane for ${title}`);
              }

              if (description) {
                  const fullDescription = `Location: ${jobLocation}\n\n${description}`;

                  await prisma.job.create({
                      data: {
                          title,
                          company,
                          url,
                          description: fullDescription,
                          status: 'pending_evaluation'
                      }
                  });
                  console.log(`Saved: ${title} at ${company}`);
              }
          } catch (e) {
              console.error('Error extracting job card:', e);
          }
      }

      currentPage++;
  }

  console.log('Scraping complete.');
  await context.close();
  await prisma.$disconnect();
}

if (process.argv[1]?.includes('linkedin.ts') || process.argv[1]?.includes('linkedin')) {
  const maxPages = parseInt(process.env.SCRAPER_MAX_PAGES || '3', 10);
  const timeRangeSeconds = parseInt(process.env.SCRAPER_TIME_RANGE ?? '86400', 10);
  const seniority = process.env.SCRAPER_SENIORITY || 'all';
  const location = process.env.SCRAPER_LOCATION || 'Worldwide';
  const workplaceType = process.env.SCRAPER_WORKPLACE || 'all';
  const keywords = process.env.SCRAPER_KEYWORDS || undefined;
  const rolesEnv = process.env.SCRAPER_ROLES || '';
  const roles = rolesEnv ? rolesEnv.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

  console.log(
    `Starting LinkedIn Scraper: roles=${JSON.stringify(roles || ['software_engineer'])}, seniority=${seniority}, location="${location}", workplaceType=${workplaceType}, timeRangeSeconds=${timeRangeSeconds}, maxPages=${maxPages}`
  );
  scrapeLinkedInJobs({
    roles,
    keywords,
    seniority,
    location,
    timeRangeSeconds,
    workplaceType,
    maxPages,
  }).catch(console.error);
}
