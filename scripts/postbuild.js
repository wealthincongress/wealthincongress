#!/usr/bin/env node
/**
 * Postbuild script for Wealth in Congress.
 *
 * After Vite builds the SPA into dist/, this script:
 *   1. Generates dist/member/[slug]/index.html for each of the 540 members
 *      (each with proper per-member OG meta tags pointing to /api/og)
 *   2. Generates dist/state/[xx]/index.html for each state
 *   3. Generates dist/press/index.html for the press kit page
 *   4. Generates dist/sitemap.xml with all URLs
 *
 * Each stub HTML loads the SPA bundle from index.html so the React app
 * boots normally and shows the right content based on pathname.
 *
 * Crawlers (Twitter, Facebook, Slack, etc.) read the OG tags directly
 * without running JS, so per-page link previews work correctly.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const indexPath = path.join(distDir, 'index.html');
const appJsxPath = path.join(root, 'src', 'App.jsx');
const SITE = 'https://wealthincongress.com';

if (!fs.existsSync(indexPath)) {
  console.error('postbuild: dist/index.html not found. Did vite build run first?');
  process.exit(1);
}

const indexHtml = fs.readFileSync(indexPath, 'utf8');
const appSrc = fs.readFileSync(appJsxPath, 'utf8');

// ─── Extract member array from App.jsx ──────────────────────────────────
function extractMembers() {
  const start = appSrc.indexOf('const MR=[\n');
  if (start === -1) throw new Error('Could not find MR array in App.jsx');
  let i = start + 'const MR=[\n'.length;
  let depth = 1;
  while (depth > 0 && i < appSrc.length) {
    if (appSrc[i] === '[') depth++;
    else if (appSrc[i] === ']') depth--;
    i++;
  }
  const mrText = appSrc.slice(start + 'const MR=[\n'.length, i - 1);
  const re = /\{s:"([^"]+)",nm:"([^"]+)",ch:"([^"]+)",p:"([^"]+)",y:(\d+),ew:(-?\d+),cw:(-?\d+)/g;
  const members = [];
  let m;
  while ((m = re.exec(mrText)) !== null) {
    members.push({ s: m[1], nm: m[2], ch: m[3], p: m[4], y: +m[5], ew: +m[6], cw: +m[7] });
  }
  return members;
}

// ─── S&P 500 CAGR table (subset that matters for entries 1981-2025) ─────
const SP500 = {1981:11.5,1982:11.8,1983:12.1,1984:11.9,1985:12.3,1986:12.0,1987:11.4,1988:11.7,1989:11.4,1990:10.8,1991:11.2,1992:10.9,1993:10.8,1994:10.6,1995:11.1,1996:10.7,1997:10.4,1998:9.7,1999:8.7,2000:7.4,2001:7.6,2002:8.0,2003:9.2,2004:9.0,2005:9.1,2006:9.3,2007:9.0,2008:9.7,2009:11.5,2010:11.1,2011:11.3,2012:11.7,2013:11.7,2014:11.0,2015:11.0,2016:12.0,2017:12.4,2018:12.0,2019:13.5,2020:13.7,2021:13.3,2022:11.5,2023:14.5,2024:13.0,2025:10.0};

// ─── Slug + enrichment (mirror of App.jsx logic) ────────────────────────
function slug(m) {
  const n = m.nm.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return `${n}-${m.s}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function enrich(m) {
  const yrs = Math.max(2026 - m.y, 1);
  const ann = (m.ew > 0 && yrs > 0) ? (Math.pow(m.cw / m.ew, 1 / yrs) - 1) * 100 : null;
  const pct = m.ew > 0 ? ((m.cw - m.ew) / Math.abs(m.ew)) * 100 : null;
  const bench = SP500[m.y] ?? 10.5;
  return { ...m, yrs, ann, pct, bench, gain: m.cw - m.ew };
}

// ─── Build per-member meta tags ─────────────────────────────────────────
function buildOgUrl(m) {
  const params = new URLSearchParams({
    name: m.nm, party: m.p, state: m.s, chamber: m.ch,
    ew: String(m.ew), cw: String(m.cw), yrs: String(m.yrs),
    ...(m.pct !== null ? { pct: m.pct.toFixed(2) } : {}),
    ...(m.ann !== null ? { ann: m.ann.toFixed(2), bench: m.bench.toFixed(2) } : {})
  });
  return `${SITE}/api/og?${params.toString()}`;
}

function describe(m) {
  const role = m.ch === 'S' ? 'Sen.' : 'Rep.';
  if (m.ew === m.cw) return `${role} ${m.nm} (${m.p}-${m.s}). Net worth: $${(m.cw / 1e6).toFixed(1)}M. Entered Congress ${m.y}.`;
  if (m.pct === null) return `${role} ${m.nm} (${m.p}-${m.s}). Net worth went from $${(m.ew / 1e6).toFixed(1)}M to $${(m.cw / 1e6).toFixed(1)}M over ${m.yrs} years.`;
  const sign = m.pct >= 0 ? '+' : '';
  return `${role} ${m.nm} (${m.p}-${m.s}). Net worth ${sign}${m.pct.toFixed(0)}% over ${m.yrs} years. ${m.ann !== null ? `S&P 500 same period: ${m.bench.toFixed(0)}%/yr.` : ''}`;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildMemberHtml(m) {
  const role = m.ch === 'S' ? 'Sen.' : 'Rep.';
  const title = `${role} ${m.nm} (${m.p}-${m.s}) — Wealth in Congress`;
  const desc = describe(m);
  const ogUrl = buildOgUrl(m);
  const canonical = `${SITE}/member/${slug(m)}`;
  return indexHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description"[^>]*\/>/, `<meta name="description" content="${escapeHtml(desc)}" />`)
    .replace(/<link rel="canonical"[^>]*\/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:title"[^>]*\/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta property="og:description"[^>]*\/>/, `<meta property="og:description" content="${escapeHtml(desc)}" />`)
    .replace(/<meta property="og:url"[^>]*\/>/, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta property="og:image"[^>]*\/>/, `<meta property="og:image" content="${ogUrl}" />`)
    .replace(/<meta name="twitter:title"[^>]*\/>/, `<meta name="twitter:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta name="twitter:image"[^>]*\/>/, `<meta name="twitter:image" content="${ogUrl}" />`)
    .replace(/<meta name="twitter:description"[^>]*\/>/, `<meta name="twitter:description" content="${escapeHtml(desc)}" />`);
}

function buildStateHtml(stateCode, stateName, memberCount) {
  const title = `${stateName} Congressional Delegation — Wealth in Congress`;
  const desc = `Wealth profiles for the ${memberCount} member${memberCount === 1 ? '' : 's'} of Congress representing ${stateName}.`;
  const canonical = `${SITE}/state/${stateCode.toLowerCase()}`;
  return indexHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description"[^>]*\/>/, `<meta name="description" content="${escapeHtml(desc)}" />`)
    .replace(/<link rel="canonical"[^>]*\/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:title"[^>]*\/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta property="og:description"[^>]*\/>/, `<meta property="og:description" content="${escapeHtml(desc)}" />`)
    .replace(/<meta property="og:url"[^>]*\/>/, `<meta property="og:url" content="${canonical}" />`);
}

function buildPressHtml() {
  const title = 'Press Kit — Wealth in Congress';
  const desc = 'Press kit for Wealth in Congress: data downloads, methodology summary, attribution guidance, and contact information for journalists and researchers.';
  const canonical = `${SITE}/press`;
  return indexHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description"[^>]*\/>/, `<meta name="description" content="${escapeHtml(desc)}" />`)
    .replace(/<link rel="canonical"[^>]*\/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:title"[^>]*\/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta property="og:description"[^>]*\/>/, `<meta property="og:description" content="${escapeHtml(desc)}" />`)
    .replace(/<meta property="og:url"[^>]*\/>/, `<meta property="og:url" content="${canonical}" />`);
}

// ─── State name lookup ──────────────────────────────────────────────────
const SN = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia'};

// ─── Run ────────────────────────────────────────────────────────────────
const raw = extractMembers();
const members = raw.map(enrich);
console.log(`postbuild: parsed ${members.length} members`);

// Per-state counts
const stateCounts = {};
for (const m of members) stateCounts[m.s] = (stateCounts[m.s] || 0) + 1;

// Generate member stubs
let memberCount = 0;
for (const m of members) {
  const dir = path.join(distDir, 'member', slug(m));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), buildMemberHtml(m));
  memberCount++;
}
console.log(`postbuild: wrote ${memberCount} member stubs`);

// Generate state stubs
let stateCount = 0;
for (const [code, count] of Object.entries(stateCounts)) {
  const dir = path.join(distDir, 'state', code.toLowerCase());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), buildStateHtml(code, SN[code] || code, count));
  stateCount++;
}
console.log(`postbuild: wrote ${stateCount} state stubs`);

// Press kit stub
fs.mkdirSync(path.join(distDir, 'press'), { recursive: true });
fs.writeFileSync(path.join(distDir, 'press', 'index.html'), buildPressHtml());
console.log('postbuild: wrote press kit stub');

// Sitemap
const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: SITE, priority: '1.0', changefreq: 'weekly' },
  { loc: `${SITE}/press`, priority: '0.7', changefreq: 'monthly' },
  ...Object.keys(stateCounts).map(code => ({
    loc: `${SITE}/state/${code.toLowerCase()}`, priority: '0.7', changefreq: 'weekly'
  })),
  ...members.map(m => ({
    loc: `${SITE}/member/${slug(m)}`, priority: '0.6', changefreq: 'weekly'
  }))
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap);
console.log(`postbuild: wrote sitemap with ${urls.length} URLs`);
console.log('postbuild: ✓ done');
