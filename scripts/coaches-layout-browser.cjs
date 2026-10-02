// Run after the frontend build. Requires Playwright and an installed Chromium.
// PLAYWRIGHT_MODULE_PATH and CHROME_EXECUTABLE can point to existing local tools.
// All API responses and remote images are synthetic; external requests are blocked.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'dist/public');
const out = path.resolve(process.argv[2] || path.join(root, '../browser-evidence/after'));
const coaches = [
  { users: { id: 901, name: 'Sample Master', bio: 'Synthetic openings coach for local layout validation.' }, coach_profiles: { title: 'GM', hourlyRateCents: 12000, averageRating: '4.9', totalLessons: 40, totalStudents: 12, specialties: '["Openings"]', isAvailable: true } },
  { users: { id: 902, name: 'Sample Tutor', bio: 'Synthetic tactics coach for local layout validation.' }, coach_profiles: { title: 'none', hourlyRateCents: 6000, averageRating: '4.5', totalLessons: 20, totalStudents: 8, specialties: '["Tactics"]', isAvailable: true } },
];
const filterNames = ['All', 'GM/IM', 'Under $100', 'Openings', 'Endgames', 'Tactics'];
const sortNames = ['Best Match', 'Top Rated', 'Price: Low to High', 'Most Lessons', 'Newest'];
const controlNames = [...filterNames, ...sortNames, 'Grid view', 'List view'];
const logo = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="32"><text x="0" y="25" font-family="sans-serif" font-size="26" fill="#E8633A">BooGMe</text></svg>';

async function geometry(page, controls = true) {
  const metrics = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')].filter(el => !el.closest('.sticky'));
    return {
      viewport: innerWidth, document: document.documentElement.scrollWidth,
      pageOverflow: [document.documentElement, document.body, document.getElementById('root')].map(el => getComputedStyle(el).overflowX),
      buttons: buttons.map(el => {
        const r = el.getBoundingClientRect();
        return { name: el.textContent || el.title, x: r.x, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, scroll: el.scrollWidth, client: el.clientWidth };
      }),
    };
  });
  assert.equal(metrics.document, metrics.viewport, 'No horizontal page overflow');
  assert.ok(metrics.pageOverflow.every(v => v !== 'hidden' && v !== 'clip'), 'Page overflow must not be masked');
  await page.evaluate(() => window.scrollTo(10000, window.scrollY));
  assert.equal(await page.evaluate(() => scrollX), 0, 'Page cannot scroll horizontally');
  if (controls) {
    for (const b of metrics.buttons) {
      assert.ok(b.x >= 0 && b.right <= metrics.viewport + 0.5 && b.width > 0 && b.height > 0, `Control stays in viewport: ${b.name}`);
      assert.ok(b.scroll <= b.client + 1, `Control label is not clipped: ${b.name}`);
    }
    for (let i = 0; i < metrics.buttons.length; i++) for (let j = i + 1; j < metrics.buttons.length; j++) {
      const a = metrics.buttons[i], b = metrics.buttons[j];
      assert.ok(Math.min(a.right,b.right) <= Math.max(a.x,b.x) + 0.5 || Math.min(a.bottom,b.bottom) <= Math.max(a.top,b.top) + 0.5, `Controls do not overlap: ${a.name}, ${b.name}`);
    }
  }
  return metrics;
}

async function cardContent(page) {
  // Check text ranges against the existing card's clipping boundary. Names retain
  // their intentional ellipsis; bio, specialties, statistics and CTA must fit.
  const violations = await page.locator('.cursor-pointer.group').evaluateAll(cards => cards.flatMap(card => {
    const bounds = card.getBoundingClientRect();
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    const bad = [];
    for (let node; (node = walker.nextNode());) {
      if (!node.textContent.trim() || node.parentElement.closest('h3')) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      for (const r of range.getClientRects()) if (r.width && (r.x < bounds.x - 1 || r.right > bounds.right + 1 || r.top < bounds.top - 1 || r.bottom > bounds.bottom + 1)) bad.push(node.textContent);
    }
    return bad;
  }));
  assert.deepEqual(violations, [], 'Card content stays inside the card');
}

async function main() {
  await fs.mkdir(out, {recursive:true});
  const server = http.createServer(async (req,res) => {
    try {
      assert.equal(req.method,'GET');
      const u = new URL(req.url,'http://localhost');
      const file = path.resolve(publicDir,'.'+decodeURIComponent(u.pathname));
      assert.ok(file.startsWith(publicDir+path.sep));
      const actual = path.extname(file) ? file : path.join(publicDir,'index.html');
      const type = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'}[path.extname(actual)] || 'application/octet-stream';
      res.writeHead(200,{'Content-Type':type});res.end(await fs.readFile(actual));
    } catch {res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin = `http://localhost:${server.address().port}`;
  let browser;
  const result = {
    sourceCommit: execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    pageBlob: execFileSync('git',['hash-object','client/src/pages/CoachBrowse.tsx'],{cwd:root,encoding:'utf8'}).trim(),
    data: 'Mocked anonymous public tRPC; external requests blocked; synthetic 128x32 logo; fallback fonts',
    viewports: [],
  };
  try {
    browser = await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE ? {executablePath:process.env.CHROME_EXECUTABLE} : {})});
    result.browser = await browser.version();
    for (const width of [320,360,768,1440]) {
      const page = await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
      let data = coaches, loading;
      const errors = [], procedures = new Set();
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',async route=>{
        const u = new URL(route.request().url());
        if(u.origin!==origin) return u.hostname==='files.manuscdn.com' ? route.fulfill({contentType:'image/svg+xml',body:logo}) : route.abort('blockedbyclient');
        if(!u.pathname.startsWith('/api/trpc/')) return route.continue();
        assert.equal(route.request().method(),'GET','Public reads only');
        const names = u.pathname.slice('/api/trpc/'.length).split(',');
        names.forEach(n=>procedures.add(n));
        if(loading && names.includes('coach.listActive')) await loading;
        await route.fulfill({contentType:'application/json',body:JSON.stringify(names.map(n=>({result:{data:{json:n==='coach.listActive'?data:null}}})))});
      });
      const button = name => page.getByRole('button',{name,exact:true});
      const open = async () => {await page.goto(origin+'/coaches');await page.getByRole('heading',{name:'Find Your Chess Coach'}).waitFor();};
      const shot = name => page.screenshot({path:path.join(out,`${width}-${name}.png`),fullPage:true});
      const row = {width};
      try {
        await open();await page.getByRole('heading',{name:'Sample Master',exact:true}).waitFor();
        row.grid = await geometry(page);await cardContent(page);await shot('grid');
        // Walk the real Tab sequence, including both original header buttons on main.
        const visited = [];
        for(let i=0;i<25 && visited.length<controlNames.length;i++) {
          await page.keyboard.press('Tab');
          const name = await page.evaluate(()=>document.activeElement.textContent || document.activeElement.title);
          if(controlNames.includes(name)) visited.push(name);
        }
        assert.deepEqual(visited,controlNames,'Every browse control is reachable in DOM order');
        await page.keyboard.press('Space'); // focused List view
        assert.equal(await page.locator('.cursor-pointer.group').first().evaluate(el=>el.parentElement.classList.contains('flex')),true);
        row.list = await geometry(page);await cardContent(page);await shot('list');
        await page.keyboard.press('Shift+Tab');await page.keyboard.press('Enter');
        assert.equal(await page.locator('.cursor-pointer.group').first().evaluate(el=>el.parentElement.classList.contains('grid')),true);
        await page.keyboard.press('Shift+Tab');await page.keyboard.press('Space'); // Newest
        assert.equal(await page.locator('h3').first().textContent(),'Sample Tutor');
        await page.keyboard.press('Shift+Tab');await page.keyboard.press('Enter'); // Most Lessons
        assert.equal(await page.locator('h3').first().textContent(),'Sample Master');
        await shot('keyboard-focus');
        await button('Under $100').focus();await page.keyboard.press('Enter');
        assert.equal(await page.locator('h3').count(),1);
        assert.equal(await page.locator('h3').textContent(),'Sample Tutor');
        await button('Endgames').focus();await page.keyboard.press('Space');
        await page.getByText('No coaches match your filters',{exact:true}).waitFor();
        row.filteredEmpty = await geometry(page);
        await button('Reset filters').focus();await page.keyboard.press('Enter');
        assert.equal(await page.locator('h3').count(),2);
        await button('Price: Low to High').click();assert.equal(await page.locator('h3').first().textContent(),'Sample Tutor');
        row.keyboard = 'PASS: complete Tab order; Enter/Space filter, reset, sort, grid/list';
        // Stress labels by changing only DOM text, retaining the actual React handlers.
        for(const name of [...filterNames,...sortNames]) await button(name).evaluate((el,label)=>{el.textContent=label;},`${name} — Extended coaching label ${'LongLabel'.repeat(12)}`);
        row.longLabels = await geometry(page);await shot('long-labels');
        await open();
        await page.locator('.cursor-pointer.group').first().click();await page.waitForURL(origin+'/coach/901');
        row.cardRoute = 'PASS: click routes to /coach/901';
        await open();
        await page.locator('.sticky button').first().focus();await page.keyboard.press('Enter');await page.waitForURL(origin+'/');
        row.homeRoute = 'PASS: existing Home keyboard routing';
        data=[];await open();await page.getByText('No coaches match your filters',{exact:true}).waitFor();
        row.empty = await geometry(page);await shot('empty');
        data=coaches;
        let release;loading=new Promise(r=>release=r);
        await page.goto(origin+'/coaches',{waitUntil:'domcontentloaded'});await page.locator('.animate-pulse').first().waitFor();
        row.loading = await geometry(page,false);await shot('loading');
        release();loading=undefined;await page.getByRole('heading',{name:'Sample Master',exact:true}).waitFor();
        row.ready = await geometry(page);await cardContent(page);
        assert.deepEqual(errors,[],'No uncaught browser errors');
        row.errors=errors;row.mockedProcedures=[...procedures];result.viewports.push(row);
        await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));
        console.log(JSON.stringify({width,grid:row.grid.document,list:row.list.document,empty:row.empty.document,loading:row.loading.document,longLabels:row.longLabels.document,keyboard:'PASS'}));
      } catch(e) {await shot('failure');throw e;} finally {await page.close();}
    }
  } finally {await browser?.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1});
