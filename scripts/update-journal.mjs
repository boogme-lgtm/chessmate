import { readFileSync, writeFileSync } from 'fs';
const j = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
const tag = '0025_luxuriant_layla_miller';
if (!j.entries.find(e => e.tag === tag)) {
  j.entries.push({ idx: 25, version: '7', when: Date.now(), tag, breakpoints: true });
  writeFileSync('drizzle/meta/_journal.json', JSON.stringify(j, null, 2));
  console.log('Journal updated with', tag);
} else {
  console.log('Already present:', tag);
}
