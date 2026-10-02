// Build first. Uses an installed Playwright/Chromium and synthetic responses only.
// PLAYWRIGHT_MODULE_PATH / CHROME_EXECUTABLE may select existing local tools.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
require('tsx/cjs');
const { mapAssessmentToProfile } = require('../shared/assessmentMapping.ts');
const { rankCoachesForStudent, toCoachForMatching } = require('../shared/coachMatching.ts');
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'dist/public');
const out = path.resolve(process.argv[2] || path.join(root, '../browser-evidence'));
const answers = { primaryGoal: 'rating', teachingArchetype: 'sage', improvementAreas: ['Opening preparation', 'Endgame technique', 'Tactical calculation'], availability: ['Morning (9am-12pm)'], timezone: 'America/New_York', lessonFrequency: 'weekly', budgetMin: 40, budgetMax: 80 };
const profileFixture = { userId: 901, ...mapAssessmentToProfile(answers) };
const coaches = [toCoachForMatching({ users: { id: 902, name: 'Synthetic Coach' }, coach_profiles: { userId: 902, teachingStyle: 'analytical', specialties: '["Openings","Endgames","Tactics"]', hourlyRateCents: 6000, availabilitySchedule: '{"monday":[{"start":"09:00","end":"12:00"}]}' } })];
const deferred = () => { let release; const promise = new Promise(r => release = r); return { promise, release }; };

async function geometry(panel) {
  return panel.evaluate(el => {
    const r = el.getBoundingClientRect();
    const bad = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode());) {
      if (!node.textContent.trim() || node.parentElement.closest('.sr-only') || node.parentElement.getClientRects().length === 0) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      for (const b of range.getClientRects()) if (b.width && (b.left < r.left - 1 || b.right > r.right + 1)) bad.push(node.textContent);
    }
    return { viewport: innerWidth, pageWidth: document.documentElement.scrollWidth, left: r.left, right: r.right, bad };
  });
}

async function main() {
  await fs.mkdir(out, { recursive: true });
  const server = http.createServer(async (req, res) => {
    try {
      assert.equal(req.method, 'GET');
      const url = new URL(req.url, 'http://localhost');
      const file = path.resolve(publicDir, '.' + decodeURIComponent(url.pathname));
      assert.ok(file.startsWith(publicDir + path.sep));
      const actual = path.extname(file) ? file : path.join(publicDir, 'index.html');
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': types[path.extname(actual)] || 'application/octet-stream' });
      res.end(await fs.readFile(actual));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  // The app's existing HTTPS bootstrap explicitly permits localhost previews.
  const origin = `http://localhost:${server.address().port}`;
  let browser;
  const evidence = { fixtures: 'Synthetic saved profiles and coaches; no live APIs; external requests blocked', results: [] };
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
    evidence.browser = await browser.version();
    for (const width of [320, 360, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      const errors = [], calls = [];
      let profile = structuredClone(profileFixture), inventory = [], fail = '', hold, profileHold, onMatchPrepared;
      const pendingHolds = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin !== origin) return route.abort('blockedbyclient');
        if (!url.pathname.startsWith('/api/trpc/')) return route.continue();
        assert.equal(req.method(), 'GET', 'Dashboard inspection/refresh must never mutate');
        const names = url.pathname.slice('/api/trpc/'.length).split(',');
        calls.push(...names);
        const requestHold = hold;
        const body = names.map(name => {
          if (name === fail) return { error: { json: { message: 'Synthetic request error', code: -32603, data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 } } } };
          let value = [];
          if (name === 'auth.me') value = { id: 901, name: 'Synthetic Student', userType: 'student', role: 'user', email: 'student@example.invalid' };
          if (name === 'student.getProfile') value = profile;
          if (name === 'match.getMatchedCoaches') value = profile ? rankCoachesForStudent(inventory, profile) : [];
          if (name === 'notifications.unreadCount') value = 0;
          if (name === 'coach.getProfile') value = null;
          return { result: { data: { json: value } } };
        });
        // Freeze the response when the request arrives, before any gate is
        // released. A later profile must not rewrite an earlier response.
        const responseBody = JSON.stringify(body);
        if (profileHold && names.includes('student.getProfile')) await profileHold.promise;
        if (names.includes('match.getMatchedCoaches')) {
          onMatchPrepared?.(responseBody);
          if (requestHold) await requestHold.promise;
        }
        await route.fulfill({ contentType: 'application/json', body: responseBody }).catch(error => { if (!req.failure()) throw error; });
      });
      const panel = page.getByRole('region', { name: 'Your coach matching' });
      const status = panel.getByRole('status');
      const button = () => panel.getByRole('button', { name: /matching$/ });
      const waitText = async text => { await status.filter({ hasText: text }).waitFor(); };
      const refresh = async () => {
        // Synchronize with the new read, not a previous ready-state DOM frame.
        // An offline retry intentionally pauses before issuing a request.
        const offline = await page.evaluate(() => !navigator.onLine);
        const started = offline ? null : page.waitForRequest(req => req.url().includes('/api/trpc/') && req.url().includes('student.getProfile'));
        await button().click();
        if (started) await started;
      };
      const check = async state => {
        const g = await geometry(panel);
        assert.ok(g.left >= 0 && g.right <= width + 1, `${state}: panel fits viewport`);
        assert.deepEqual(g.bad, [], `${state}: no panel text spills horizontally`);
        evidence.results.push({ width, state, ...g });
      };
      try {
        // Regression: no match data is cached yet. B must start a distinct read
        // while the first computed response for A is still held in flight.
        const responseA = deferred(), responseB = deferred();
        const preparedA = deferred(), preparedB = deferred();
        pendingHolds.push(responseA, responseB);
        inventory = [{ ...coaches[0], name: 'Profile A Coach' }];
        hold = responseA;
        onMatchPrepared = body => { assert.ok(body.includes('Profile A Coach')); preparedA.release(); };
        await page.goto(origin + '/find-another-coach');
        await preparedA.promise;
        profile = { ...profileFixture, learningStyle: 'interactive', assessmentData: JSON.stringify({ ...answers, teachingArchetype: 'innovator' }) };
        inventory = [{ ...coaches[0], name: 'Profile B Coach', teachingStyle: 'interactive' }];
        hold = responseB;
        onMatchPrepared = body => { assert.ok(body.includes('Profile B Coach')); preparedB.release(); };
        await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
        await panel.getByText('The Creative Innovator', { exact: true }).waitFor();
        let timeout;
        try {
          await Promise.race([preparedB.promise, new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error('Profile B must start its own matching read while first response A is held')), 5000);
          })]);
        } finally { clearTimeout(timeout); }
        responseB.release();
        await waitText('Coaches to consider');
        await panel.getByRole('heading', { name: 'Profile B Coach', exact: true }).waitFor();
        responseA.release();
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        assert.equal(await panel.getByRole('heading', { name: 'Profile A Coach', exact: true }).count(), 0);
        await check('first-request-profile-race');
        onMatchPrepared = undefined;
        profile = structuredClone(profileFixture); inventory = [];

        hold = deferred();
        await page.reload();
        await waitText('Checking your saved preferences');
        assert.equal(await button().isDisabled(), true);
        hold.release(); hold = null;
        await waitText('No recommendations available right now');
        assert.equal(await panel.locator('dd').filter({ hasText: 'America/New_York' }).count(), 1);
        assert.equal(await panel.locator('dd').filter({ hasText: 'Not saved' }).count(), 4);
        assert.equal(await panel.locator('input,select,textarea').count(), 0);
        assert.equal(await status.getAttribute('aria-live'), 'polite');
        await check('empty');
        await panel.screenshot({ path: path.join(out, `${width}-empty.png`) });

        await panel.getByRole('button', { name: 'Edit matching answers' }).focus(); await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.tagName), 'SUMMARY');
        await page.keyboard.press('Enter');
        assert.equal(await panel.locator('details').getAttribute('open'), null);
        await page.keyboard.press('Space');
        assert.notEqual(await panel.locator('details').getAttribute('open'), null);

        for (let i = 0; i < 3; i++) {
          const before = calls.filter(n => n === 'match.getMatchedCoaches').length;
          hold = deferred(); await refresh(); await waitText('Checking your saved preferences');
          assert.equal(await button().isDisabled(), true);
          hold.release(); hold = null;
          await waitText('No recommendations available right now');
          assert.equal(calls.filter(n => n === 'match.getMatchedCoaches').length, before + 1);
          assert.deepEqual(JSON.parse(profile.assessmentData), answers);
        }

        inventory = coaches;
        await refresh(); await waitText('Coaches to consider');
        await panel.getByText('Specializes in your improvement areas', { exact: true }).waitFor();
        assert.ok(!(await panel.innerText()).includes('Available when you are'));
        assert.ok(!(await panel.innerText()).includes('Within your budget range'));
        assert.ok(!(await panel.innerText()).includes('%'));
        const link = panel.getByRole('link', { name: 'View profile for Synthetic Coach' });
        assert.equal(await link.getAttribute('href'), '/coach/902');
        await panel.getByRole('button', { name: 'Edit matching answers' }).focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '/coach/902');
        await check('recommendations');
        await panel.screenshot({ path: path.join(out, `${width}-recommendations.png`) });

        // A profile read triggered outside this panel must refresh its matches.
        // React Query listens to visibilitychange for window-focus refetching.
        profile = { ...profileFixture, assessmentData: JSON.stringify({ ...answers, teachingArchetype: 'innovator' }), learningStyle: 'interactive' };
        inventory = [{ ...coaches[0], name: 'Updated Synthetic Coach', teachingStyle: 'interactive' }];
        const beforeFocus = calls.filter(n => n === 'match.getMatchedCoaches').length;
        hold = deferred();
        await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
        await waitText('Checking your saved preferences');
        await panel.getByText('The Creative Innovator', { exact: true }).waitFor();
        assert.equal(await panel.getByRole('list', { name: 'Recommended coaches' }).count(), 0, 'Hide old matches after an independent profile refresh');
        hold.release(); hold = null;
        await waitText('Coaches to consider');
        await panel.getByRole('heading', { name: 'Updated Synthetic Coach' }).waitFor();
        assert.equal(calls.filter(n => n === 'match.getMatchedCoaches').length, beforeFocus + 1);
        await check('background-profile-freshness');
        profile = structuredClone(profileFixture); inventory = coaches;

        // Let a profile response arrive while offline, so the next dependent
        // matching request pauses before it has any new successful response.
        profileHold = deferred(); await refresh();
        await waitText('Checking your saved preferences');
        await page.context().setOffline(true);
        await page.evaluate(() => window.dispatchEvent(new Event('offline')));
        profileHold.release(); profileHold = null;
        await waitText('Waiting for a connection');
        assert.equal(await panel.getByRole('list', { name: 'Recommended coaches' }).count(), 0);
        assert.equal(await button().isDisabled(), true);
        await check('offline-matching');
        await page.context().setOffline(false);
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await waitText('Coaches to consider');

        fail = 'match.getMatchedCoaches'; await refresh(); await waitText(/couldn.t load recommendations/);
        assert.equal(await panel.getByRole('list', { name: 'Recommended coaches' }).count(), 0);
        await panel.getByText('America/New_York', { exact: true }).waitFor();
        await check('match-error');
        fail = ''; await button().focus(); await page.keyboard.press('Enter'); await waitText('Coaches to consider');

        fail = 'student.getProfile'; await refresh(); await waitText(/couldn.t load your saved preferences/);
        assert.equal(await panel.getByRole('list', { name: 'Recommended coaches' }).count(), 0);
        fail = ''; await refresh(); await waitText('Coaches to consider');

        profile = { userId: 901, ...mapAssessmentToProfile({}) };
        await refresh(); await waitText('Coaches to consider');
        await panel.getByText('No specific preference match established', { exact: true }).waitFor();
        assert.equal(await panel.locator('dd').filter({ hasText: 'Not saved' }).count(), 11);
        await check('incomplete');
        profile.assessmentData = '{'; await refresh(); await waitText('Coaches to consider');
        assert.equal(await panel.locator('dd').filter({ hasText: 'Not saved' }).count(), 11);
        profile = null; await refresh(); await waitText('No saved questionnaire answers');
        assert.equal(await panel.getByRole('list', { name: 'Recommended coaches' }).count(), 0);

        profile = { ...profileFixture, assessmentData: JSON.stringify({ ...answers, timezone: 'InvalidZone'.repeat(12), improvementAreas: ['LongPreference'.repeat(16)] }) };
        inventory = [{ ...coaches[0], name: 'LongCoachName'.repeat(12) }];
        await refresh(); await waitText('Coaches to consider');
        await check('long-saved-values');

        profile = structuredClone(profileFixture); inventory = coaches;
        hold = deferred(); await refresh(); await waitText('Checking your saved preferences');
        await page.getByRole('link', { name: 'Back to dashboard', exact: true }).click();
        await page.waitForURL('**/dashboard*');
        assert.equal(await page.getByText('Saved matching preferences', { exact: true }).count(), 0);
        hold.release(); hold = null;
        await page.goBack(); await waitText('Coaches to consider');
        await panel.getByText('America/New_York', { exact: true }).waitFor();
        await page.reload(); await waitText('Coaches to consider');
        await check('reload-and-navigation-back');

        // A paused first profile retry must not claim there are no saved answers.
        fail = 'student.getProfile'; await page.reload(); await waitText(/couldn.t load your saved preferences/);
        await page.context().setOffline(true);
        await page.evaluate(() => window.dispatchEvent(new Event('offline')));
        fail = ''; await refresh(); await waitText('Waiting for a connection');
        assert.ok(!(await status.innerText()).includes('No saved'));
        await check('offline-profile-without-data');
        await page.context().setOffline(false);
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await waitText('Coaches to consider');
        profile = { ...profileFixture, assessmentData: JSON.stringify({ ...answers, primaryGoal: '__proto__', teachingArchetype: 'constructor' }) };
        await refresh(); await waitText('Coaches to consider');
        await panel.getByText('__proto__', { exact: true }).waitFor();
        await panel.getByText('constructor', { exact: true }).waitFor();
        assert.deepEqual(errors, [], 'No uncaught browser errors');
        assert.ok(calls.every(n => !/save|generate|update|create/i.test(n)), 'Only read procedures called');
        console.log(JSON.stringify({ width, checks: 'PASS', calls: calls.length }));
      } catch (error) {
        console.error(JSON.stringify({ width, url: page.url(), errors, calls, body: (await page.locator('body').innerText()).slice(0, 5000) }));
        await page.screenshot({ path: path.join(out, `${width}-failure.png`), fullPage: true });
        throw error;
      } finally { for (const gate of pendingHolds) gate.release(); if (hold) hold.release(); if (profileHold) profileHold.release(); await page.close(); }
    }
    await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(evidence, null, 2));
  } finally { await browser?.close(); await new Promise(r => server.close(r)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
