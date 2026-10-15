#!/usr/bin/env node
/**
 * CritterDB public catalog bulk crawl (Node — no CORS).
 *
 * Usage:
 *   node tools/critterdb-bulk-crawl.mjs
 *   node tools/critterdb-bulk-crawl.mjs --max-bestiaries 200 --out critterdb-bulk.json
 *
 * Then in DSCToolkt → Tools → CritterDB → Import CritterDB JSON file
 */
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return def;
}
const MAX_BESTIARIES = parseInt(arg('--max-bestiaries', '500'), 10) || 500;
const MAX_LIST_PAGES = parseInt(arg('--max-list-pages', '100'), 10) || 100;
const OUT = arg('--out', 'critterdb-bulk.json');
const DELAY = parseInt(arg('--delay', '120'), 10) || 120;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'DSCToolkt-CritterDB-Crawl/1.0' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function listBestiaries() {
  const byId = new Map();
  for (const list of ['recent', 'popular']) {
    for (let page = 1; page <= MAX_LIST_PAGES; page++) {
      const url = `https://critterdb.com/api/publishedbestiaries/${list}/${page}`;
      process.stdout.write(`\rIndex ${list} p${page} (${byId.size} bestiaries)…`);
      let batch;
      try {
        batch = await getJson(url);
      } catch (e) {
        if (page === 1) throw e;
        break;
      }
      if (!Array.isArray(batch) || !batch.length) break;
      batch.forEach((b) => {
        const id = b._id || b.id;
        if (id) byId.set(id, { id, name: b.name || id });
      });
      if (batch.length < 5) break;
      await sleep(DELAY);
    }
  }
  try {
    const data = await getJson('https://critterdb.com/api/publishedbestiaries/mostpopular');
    const arr = Array.isArray(data) ? data : data.bestiaries || data.results || [];
    arr.forEach((b) => {
      const id = b._id || b.id;
      if (id) byId.set(id, { id, name: b.name || id });
    });
  } catch (_) {}
  console.log(`\nFound ${byId.size} unique published bestiaries`);
  return [...byId.values()];
}

async function fetchCreatures(bestiaryId) {
  const all = [];
  for (let page = 1; page <= 80; page++) {
    const url = `https://critterdb.com/api/publishedbestiaries/${bestiaryId}/creatures/${page}`;
    let batch;
    try {
      batch = await getJson(url);
    } catch (e) {
      if (page === 1) throw e;
      break;
    }
    if (!Array.isArray(batch) || !batch.length) break;
    all.push(...batch);
    if (batch.length < 20) break;
    await sleep(DELAY);
  }
  return all;
}

console.log('CritterDB bulk crawl →', OUT);
const index = await listBestiaries();
const slice = index.slice(0, MAX_BESTIARIES);

// Dedupe by CritterDB _id first, then by lowercase name
const byCreatureId = new Map();
const byCreatureName = new Map();
let skippedDup = 0;

for (let i = 0; i < slice.length; i++) {
  const b = slice[i];
  process.stdout.write(`\rBestiary ${i + 1}/${slice.length}: ${b.name}          `);
  try {
    const rows = await fetchCreatures(b.id);
    for (const c of rows) {
      if (!c || typeof c !== 'object') continue;
      c._bestiaryName = b.name;
      const cid = String(c._id || c.id || '').trim();
      const nm = String(c.name || '').trim().toLowerCase();
      if (cid && byCreatureId.has(cid)) {
        skippedDup++;
        continue;
      }
      if (nm && byCreatureName.has(nm)) {
        skippedDup++;
        continue;
      }
      if (cid) byCreatureId.set(cid, c);
      if (nm) byCreatureName.set(nm, cid || nm);
      // store under stable key in id map even if only name
      if (!cid && nm) byCreatureId.set('name:' + nm, c);
    }
  } catch (e) {
    console.warn(`\n  skip ${b.name}: ${e.message}`);
  }
  await sleep(DELAY);
}

const creatures = [...byCreatureId.values()];
const pack = {
  format: 'DSCToolkt-compendium-v1',
  edition: '5e-critterdb-bulk',
  source: 'CritterDB public catalog',
  attribution: 'Crawled from CritterDB published bestiaries (https://critterdb.com). Respect authors\' licenses.',
  creatures
};
const outPath = path.isAbsolute(OUT) ? OUT : path.resolve(process.cwd(), OUT);
fs.writeFileSync(outPath, JSON.stringify(pack));
console.log(`\nWrote ${creatures.length} unique creatures (${skippedDup} duplicates skipped) → ${outPath}`);
console.log('Import this file in DSCToolkt → Tools → CritterDB → Import CritterDB JSON file');
