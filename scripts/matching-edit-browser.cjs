// Run against a local build. All API responses and writes are synthetic.
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
const out = path.resolve(process.argv[2] || path.join(root, '../browser-evidence/edits'));
const answers = { rating: 0, ratingSystem: 'fide', primaryGoal: 'rating', teachingArchetype: 'sage', improvementAreas: ['Opening preparation'], availability: ['Morning (9am-12pm)'], timezone: 'America/New_York', lessonFrequency: 'weekly', budgetMin: 0, budgetMax: 80, feedbackStyle: 0, techComfort: 0 };
const coach = toCoachForMatching({ users: { id: 902, name: 'Synthetic Coach' }, coach_profiles: { userId: 902, teachingStyle: 'analytical', specialties: '["Openings"]', hourlyRateCents: 6000 } });
const deferred = () => { let release; const promise = new Promise(r => release = r); return { promise, release }; };

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
  const origin = `http://localhost:${server.address().port}`;
  let browser;
  const evidence = { fixtures: 'Synthetic only; external requests blocked', results: [] };
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
    evidence.browser = await browser.version();
    for (const width of [320, 360, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      let profile = { id: 7, userId: 901, ...mapAssessmentToProfile(answers) };
      let saveFail = false, saveHold, matchHold, matchPrepared, inventory = [coach], userType = 'student';
      const calls = [], writes = [], errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin !== origin) return route.abort('blockedbyclient');
        if (!url.pathname.startsWith('/api/trpc/')) return route.continue();
        const names = url.pathname.slice('/api/trpc/'.length).split(',');
        calls.push(...names);
        const save = names.includes('student.saveQuizResults');
        assert.equal(req.method(), save ? 'POST' : 'GET');
        if (save) {
          const payload = JSON.parse(req.postData());
          const submitted = (payload[0] || payload).json.assessmentData;
          writes.push(structuredClone(submitted));
          if (saveHold) await saveHold.promise;
          if (!saveFail) profile = { ...profile, ...mapAssessmentToProfile(submitted) };
        }
        const body = names.map(name => {
          if (save && saveFail) return { error: { json: { message: 'Synthetic save unavailable', code: -32603, data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 } } } };
          let value = [];
          if (name === 'auth.me') value = { id: 901, name: 'Synthetic Student', userType, role: 'user', email: 'student@example.invalid' };
          if (name === 'student.getProfile') value = profile;
          if (name === 'student.saveQuizResults') value = { success: true, profileId: 7 };
          if (name === 'match.getMatchedCoaches') value = profile ? rankCoachesForStudent(inventory, profile) : [];
          if (name === 'notifications.unreadCount') value = 0;
          if (name === 'coach.getProfile') value = null;
          return { result: { data: { json: value } } };
        });
        const frozen = JSON.stringify(body);
        if (names.includes('match.getMatchedCoaches')) {
          const gate = matchHold;
          matchPrepared?.release();
          if (gate) await gate.promise;
        }
        await route.fulfill({ contentType: 'application/json', body: frozen }).catch(e => { if (!req.failure()) throw e; });
      });
      const panel = page.getByRole('region', { name: 'Your coach matching' });
      const ready = () => panel.getByRole('status').filter({ hasText: 'Coaches to consider' }).waitFor();
      const edit = async () => { await page.getByRole('button', { name: 'Edit matching answers', exact: true }).click(); await page.getByRole('heading', { name: "What's your current chess rating?" }).waitFor(); };
      const next = async index => {
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByText(`Question ${index + 1} of 20`, { exact: false }).waitFor();
        // Motion's exiting frame must finish before interacting with a question.
        await page.waitForTimeout(350);
      };
      try {
        await page.goto(origin + '/dashboard');
        await page.getByRole('button', { name: 'Find Another Coach', exact: true }).waitFor();
        assert.equal(await page.getByText('Saved matching preferences', { exact: true }).count(), 0);
        await page.getByRole('button', { name: 'Find Another Coach', exact: true }).click();
        await page.waitForURL('**/find-another-coach'); await ready();
        await edit();
        assert.equal(await page.getByRole('slider').getAttribute('aria-valuenow'), '0', 'saved zero rating is prefilled');
        assert.equal(await page.getByRole('combobox').innerText(), 'FIDE');
        for (let i = 1; i <= 4; i++) await next(i);
        await page.getByText('Enjoyment', { exact: true }).click();
        await page.getByRole('button', { name: 'Back', exact: true }).click();
        await page.getByText('Question 4 of 20', { exact: false }).waitFor();
        await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await ready();
        assert.equal(writes.length, 0, 'cancel writes nothing');
        await panel.getByText('Reach a specific rating target', { exact: true }).waitFor();
        await edit();
        // An untouched edit preserves absent fields and saved zero values.
        await page.getByRole('button', { name: 'Save answers', exact: true }).click(); await ready();
        assert.deepEqual(writes.at(-1), answers);
        // A save must replace a frozen recommendation response from before it.
        inventory = [{ ...coach, name: 'Obsolete Synthetic Coach' }];
        matchHold = deferred(); matchPrepared = deferred();
        await panel.getByRole('button', { name: 'Refresh matching', exact: true }).click();
        await matchPrepared.promise;
        const obsolete = matchHold; matchHold = null; matchPrepared = null;
        inventory = [{ ...coach, name: 'Current Synthetic Coach' }];
        await edit(); await page.getByRole('button', { name: 'Save answers', exact: true }).click();
        await ready(); await panel.getByRole('heading', { name: 'Current Synthetic Coach', exact: true }).waitFor();
        obsolete.release();
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        assert.equal(await panel.getByRole('heading', { name: 'Obsolete Synthetic Coach', exact: true }).count(), 0);
        await edit();
        await page.getByRole('slider').focus(); await page.keyboard.press('ArrowRight');
        assert.equal(await page.getByRole('slider').getAttribute('aria-valuenow'), '50');
        saveFail = true;
        await page.getByRole('button', { name: 'Save answers', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: "couldn't save" }).waitFor();
        assert.equal(await page.getByRole('slider').getAttribute('aria-valuenow'), '50', 'failed save preserves draft');
        assert.equal(JSON.parse(profile.assessmentData).rating, 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'editing fits viewport');
        await page.screenshot({ path: path.join(out, `${width}-save-error.png`), fullPage: true });
        saveFail = false; saveHold = deferred();
        const before = writes.length;
        await page.getByRole('button', { name: 'Save answers', exact: true }).click();
        await page.getByRole('button', { name: /Saving answers/ }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Cancel', exact: true }).isDisabled(), true);
        assert.equal(await page.getByRole('slider').getAttribute('data-disabled'), '');
        await page.getByRole('slider').focus().catch(() => {}); await page.keyboard.press('ArrowRight');
        assert.equal(await page.getByRole('slider').getAttribute('aria-valuenow'), '50', 'custom controls cannot change during save');
        saveHold.release(); saveHold = null; await ready();
        assert.equal(writes.length, before + 1, 'single write per save');
        assert.equal(writes.at(-1).rating, 50);
        await panel.getByText('50 (FIDE)', { exact: true }).waitFor();
        // Back/navigation discards an unsaved draft; reload reads persisted data.
        await edit(); await page.getByRole('slider').focus(); await page.keyboard.press('ArrowRight');
        await page.getByRole('link', { name: 'Back to dashboard', exact: true }).click();
        await page.goBack(); await ready(); await edit();
        assert.equal(await page.getByRole('slider').getAttribute('aria-valuenow'), '50');
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await page.reload(); await ready();
        // Existing sidebar entry and legacy section deep links enter the flow.
        await page.goto(origin + '/dashboard');
        if (width >= 1440) {
          await page.getByRole('button', { name: 'Coach matching', exact: true }).click();
          await page.waitForURL('**/find-another-coach'); await ready();
        }
        await page.goto(origin + '/dashboard#coach-matching');
        await page.waitForURL('**/find-another-coach'); await ready();
        userType = 'both'; await page.reload(); await ready(); await edit();
        await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await ready();
        await page.screenshot({ path: path.join(out, `${width}-preferences.png`), fullPage: true });
        profile = null; inventory = []; await page.reload();
        await panel.getByRole('status').filter({ hasText: 'No saved questionnaire answers' }).waitFor();
        await edit(); await page.getByRole('button', { name: 'Save answers', exact: true }).click();
        await panel.getByRole('status').filter({ hasText: 'No recommendations available' }).waitFor();
        assert.deepEqual(writes.at(-1), {}, 'missing answers do not become defaults');
        assert.equal(await panel.locator('dd').filter({ hasText: 'Not saved' }).count(), 11);
        assert.deepEqual(errors, []);
        assert.ok(calls.every(name => !/generate|update|create/.test(name)), 'only original save endpoint writes');
        evidence.results.push({ width, checks: 'PASS', writes: writes.length, calls: calls.length });
        console.log(JSON.stringify(evidence.results.at(-1)));
      } catch (error) {
        console.error(JSON.stringify({ width, url: page.url(), errors, writes, body: (await page.locator('body').innerText()).slice(0, 4500) }));
        await page.screenshot({ path: path.join(out, `${width}-failure.png`), fullPage: true });
        throw error;
      } finally { saveHold?.release(); matchHold?.release(); await page.close(); }
    }
    await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(evidence, null, 2));
  } finally { await browser?.close(); await new Promise(r => server.close(r)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
