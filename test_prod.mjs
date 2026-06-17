import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting production test...');
  let browser;
  try {
    browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    // Clear cache to simulate hard refresh
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCache');

    page.on('console', msg => console.log('PROD BROWSER CONSOLE:', msg.type().toUpperCase(), msg.text()));
    page.on('pageerror', err => console.log('PROD BROWSER ERROR:', err.toString()));
    page.on('requestfailed', request => console.log('PROD REQUEST FAILED:', request.url(), request.failure()?.errorText));

    const url = 'https://mihika-sarwate.github.io/adonis_lab_sales_dashboard/';
    console.log('Navigating to', url);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    
    console.log('Waiting for 5 seconds to observe any loops...');
    await new Promise(r => setTimeout(r, 5000));
    
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    const title = await page.title();
    console.log('PAGE TITLE:', title);
    console.log('BODY HTML LENGTH:', bodyHTML.length);
    if (bodyHTML.length < 500) {
       console.log('BODY SNIPPET:', bodyHTML);
    }
    
  } catch (error) {
    console.error('Test script error:', error);
  } finally {
    if (browser) await browser.close();
    process.exit(0);
  }
})();
