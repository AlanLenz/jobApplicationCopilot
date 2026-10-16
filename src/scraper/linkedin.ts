import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { PrismaClient } from '@prisma/client';
import path from 'path';

chromium.use(stealth());
const prisma = new PrismaClient();

export const DEFAULT_SEARCH_KEYWORDS = '("Desenvolvedor" OR "Developer" OR "Software Engineer" OR "Engenheiro de Software") AND ("Junior" OR "Jr" OR "Pleno" OR "Mid level" OR "Mid-level") NOT ("Senior" OR "Sr" OR "Lead" OR "Principal" OR "Staff")';

export async function scrapeLinkedInJobs(keywords: string = DEFAULT_SEARCH_KEYWORDS, location: string = 'Worldwide', maxPages = 3, timeRangeSeconds = 86400) {
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

  // f_TPR=r86400 limits the search to the last 24 hours (86400 seconds)
  const baseUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&f_TPR=r${timeRangeSeconds}`; 
  
  let currentPage = 1;

  while (currentPage <= maxPages) {
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
  const timeRange = parseInt(process.env.SCRAPER_TIME_RANGE || '86400', 10);
  console.log(`Starting LinkedIn Scraper: maxPages=${maxPages}, timeRangeSeconds=${timeRange} (Last 24h)`);
  scrapeLinkedInJobs(DEFAULT_SEARCH_KEYWORDS, 'Worldwide', maxPages, timeRange).catch(console.error);
}