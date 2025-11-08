import Parser from 'rss-parser';
import { extractOgImage } from '@/lib/extractOg';
import type { NewsItem } from '@/lib/types';
import { NextResponse } from 'next/server';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'user-agent': 'Mozilla/5.0 (compatible; AI-News-Video/1.0; +https://agentic-a35ee5ef.vercel.app)'
  }
});

const FEEDS: { source: string; url: string; type: 'rss' }[] = [
  { source: 'TechCrunch AI', url: 'https://techcrunch.com/tag/artificial-intelligence/feed/', type: 'rss' },
  { source: 'The Verge AI', url: 'https://www.theverge.com/rss/artificial-intelligence/index.xml', type: 'rss' },
  { source: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', type: 'rss' },
  { source: 'Product Hunt', url: 'https://www.producthunt.com/feed', type: 'rss' }
];

async function tryExtractImage(item: any): Promise<string | undefined> {
  const direct = (item.enclosure && (item.enclosure.url || item.enclosure.link)) || undefined;
  if (direct) return direct;
  const content: string = item['content:encoded'] || item.content || '';
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (imgMatch) return imgMatch[1];
  if (item.link) {
    const og = await extractOgImage(item.link);
    if (og) return og;
  }
  return undefined;
}

export const revalidate = 0;

export async function GET() {
  try {
    const results = await Promise.all(
      FEEDS.map(async (f) => {
        try {
          const feed = await parser.parseURL(f.url);
          const items: NewsItem[] = await Promise.all(
            (feed.items || []).slice(0, 15).map(async (it) => ({
              title: it.title || 'Untitled',
              link: it.link || '#',
              date: it.isoDate || it.pubDate || new Date().toISOString(),
              source: f.source,
              summary: it.contentSnippet || (it.content ? String(it.content).replace(/<[^>]+>/g, '').slice(0, 240) : undefined),
              image: await tryExtractImage(it)
            }))
          );
          return items;
        } catch {
          return [] as NewsItem[];
        }
      })
    );

    // Flatten, filter AI-related for Product Hunt if needed, sort by date
    let items = results.flat();

    items = items.filter((i) => {
      if (i.source !== 'Product Hunt') return true;
      return /\b(ai|gpt|copilot|llm|agent|ml)\b/i.test(i.title);
    });

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // De-duplicate by link
    const seen = new Set<string>();
    const deduped: NewsItem[] = [];
    for (const it of items) {
      if (seen.has(it.link)) continue;
      seen.add(it.link);
      deduped.push(it);
    }

    return NextResponse.json({ items: deduped.slice(0, 50) }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load feeds' }, { status: 500 });
  }
}
