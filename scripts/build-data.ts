/**
 * Builds assets/data/channels.json (Tamil + English channels only) from the iptv-org
 * generated language playlists (gh-pages branch: languages/tam.m3u, languages/eng.m3u).
 * Usage: npx tsx scripts/build-data.ts <path-to>/languages
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseM3U, channelId, type Channel } from '../src/lib/m3u';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: tsx scripts/build-data.ts <languages-dir>');
  process.exit(1);
}

const byUrl = new Map<string, Channel>();
for (const [file, lang] of [['tam.m3u', 'ta'], ['eng.m3u', 'en']] as const) {
  for (const c of parseM3U(readFileSync(join(dir, file), 'utf8'), 'XX')) {
    const have = byUrl.get(c.id);
    if (have) have.lang = [...new Set([...(have.lang ?? []), lang])];
    else byUrl.set(c.id, { ...c, lang: [lang] });
  }
}
// hand-maintained channels (assets/data/extra.json) win over playlist entries and survive rebuilds
for (const e of JSON.parse(readFileSync('assets/data/extra.json', 'utf8')) as Omit<Channel, 'id'>[]) {
  byUrl.set(channelId(e.url), { ...e, id: channelId(e.url) });
}
const key = (n: string) => (/^[\p{L}\p{N}]/u.test(n) ? '0' : '1') + n.toLowerCase();
const secure = (c: Channel) => (c.url.startsWith('https:') ? 0 : 1); // https links first among same-named channels
const all = [...byUrl.values()].sort((a, b) => key(a.name).localeCompare(key(b.name)) || secure(a) - secure(b));

// compact tuple form keeps the bundled file small
const rows = all.map((c) => [c.id, c.name, c.url, c.country, c.quality, c.userAgent ?? 0, c.referrer ?? 0, c.group ?? 0, c.logo ?? 0, (c.lang ?? []).join(',')]);
mkdirSync('assets/data', { recursive: true });
writeFileSync('assets/data/channels.json', JSON.stringify(rows));
const n = (l: string) => all.filter((c) => c.lang?.includes(l as 'ta')).length;
console.log(`Wrote ${rows.length} channels (Tamil ${n('ta')}, English ${n('en')})`);
