import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function scrapeJobs() {
  const browser = await chromium.launch({ headless: false }); // Set to true in production
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Starting Playwright Scraper...');
  // Example: Scraping a dummy job board or an ATS board like Greenhouse
  // You would replace this URL and selectors with your target board.
  const targetUrl = 'https://example.com/jobs?q=Full+Stack+Developer&remote=true';
  await page.goto(targetUrl);

  // Wait for job listings to load
  // await page.waitForSelector('.job-listing');

  // Dummy data extraction for demonstration
  // In reality, you'd map over elements and extract real URLs and descriptions
  const extractedJobs = [
    {
      title: 'Mid-Level Full Stack Developer',
      company: 'Tech Innovators Inc.',
      url: 'https://example.com/jobs/1234',
      description: 'We are looking for a remote Full Stack Developer with React and Node.js experience.',
      requirements: '3+ years experience, React, Node.js, PostgreSQL',
    }
  ];

  console.log(`Found ${extractedJobs.length} jobs. Saving to database...`);

  for (const job of extractedJobs) {
    try {
      await prisma.job.upsert({
        where: { url: job.url },
        update: {}, // Don't update if it already exists
        create: {
          title: job.title,
          company: job.company,
          url: job.url,
          description: job.description,
          requirements: job.requirements,
          status: 'pending_evaluation'
        }
      });
      console.log(`Saved: ${job.title} at ${job.company}`);
    } catch (e) {
      console.error(`Error saving job ${job.url}:`, e);
    }
  }

  await browser.close();
  await prisma.$disconnect();
}

// scrapeJobs().catch(console.error);

