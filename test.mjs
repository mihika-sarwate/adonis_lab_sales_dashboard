import puppeteer from 'puppeteer';
import handler from 'serve-handler';
import http from 'http';

const server = http.createServer((request, response) => {
  return handler(request, response, {
    public: '.',
    rewrites: [
      { source: '/adonis_lab_sales_dashboard/**', destination: '/index.html' }
    ]
  });
});

server.listen(3000, async () => {
  console.log('Server running at http://localhost:3000/');
  
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    // Capture console messages
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type().toUpperCase(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER PAGE ERROR:', err.toString()));
    page.on('requestfailed', request => console.log('BROWSER REQUEST FAILED:', request.url(), request.failure().errorText));

    console.log('Navigating to http://localhost:3000/adonis_lab_sales_dashboard/');
    await page.goto('http://localhost:3000/adonis_lab_sales_dashboard/', { waitUntil: 'networkidle0' });
    
    console.log('Waiting for 5 seconds...');
    await new Promise(r => setTimeout(r, 5000));
    
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    console.log('BODY HTML LENGTH:', bodyHTML.length);
    console.log('BODY HTML SNIPPET:', bodyHTML.substring(0, 500));
    
    await browser.close();
  } catch (error) {
    console.error('Test script error:', error);
  } finally {
    server.close();
    process.exit(0);
  }
});
