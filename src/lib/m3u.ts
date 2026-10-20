export type Channel = {
  /** stable id (hash of url) */
  id: string;
  name: string;
  url: string;
  /** ISO-3166 alpha-2 code, "INT" for international, "XX" unknown */
  country: string;
  /** vertical resolution (e.g. 720) or 0 when unknown */
  quality: number;
  group?: string;
  logo?: string;
  tvgId?: string;
  userAgent?: string;
  referrer?: string;
  /** languages: 'ta' (Tamil), 'en' (English) */
  lang?: ('ta' | 'en')[];
};

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function channelId(url: string): string {
  return hash(url) + url.length.toString(36);
}

function attr(line: string, key: string): string | undefined {
  const m = line.match(new RegExp(key + '="([^"]*)"', 'i'));
  return m && m[1] ? m[1] : undefined;
}

const QUALITY_RE = /\s*\((\d{3,4})p\)\s*/;

/** Parse M3U text. `defaultCountry` is used when a channel has no tvg-id country suffix. */
export function parseM3U(text: string, defaultCountry = 'XX'): Channel[] {
  const out: Channel[] = [];
  let pending: Partial<Channel> | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const comma = line.indexOf(',', line.lastIndexOf('"') + 1);
      let name = (comma >= 0 ? line.slice(comma + 1) : '').trim();
      let quality = 0;
      const q = name.match(QUALITY_RE);
      if (q) {
        quality = parseInt(q[1], 10);
        name = name.replace(QUALITY_RE, ' ').trim();
      }
      const tvgId = attr(line, 'tvg-id');
      const idCountry = tvgId?.match(/\.([a-z]{2})(?:@|$)/i)?.[1]?.toUpperCase();
      pending = {
        name: name || 'Unnamed',
        quality,
        tvgId,
        logo: attr(line, 'tvg-logo'),
        group: attr(line, 'group-title')?.split(';')[0],
        country: idCountry ?? defaultCountry,
      };
    } else if (line.startsWith('#EXTVLCOPT:')) {
      if (!pending) continue;
      const v = line.slice('#EXTVLCOPT:'.length);
      if (v.startsWith('http-user-agent=')) pending.userAgent = v.slice(16);
      else if (v.startsWith('http-referrer=')) pending.referrer = v.slice(14);
    } else if (!line.startsWith('#')) {
      if (pending && /^https?:\/\//i.test(line)) {
        out.push({ ...(pending as Channel), url: line, id: channelId(line) });
      }
      pending = null;
    }
  }
  return out;
}

export function dedupe(list: Channel[]): Channel[] {
  const seen = new Set<string>();
  return list.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}
