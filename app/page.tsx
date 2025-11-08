"use client";

import { useEffect, useMemo, useState } from 'react';
import NewsList from '@/components/NewsList';
import VideoComposer from '@/components/VideoComposer';
import type { NewsItem } from '@/lib/types';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NewsItem | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((i) =>
      [i.title, i.source, i.summary ?? '', i.link].some((t) => t?.toLowerCase().includes(q))
    );
  }, [items, query]);

  useEffect(() => {
    setLoading(true);
    fetch('/api/news')
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to fetch news');
        return (await r.json()) as { items: NewsItem[] };
      })
      .then((data) => {
        setItems(data.items);
        if (data.items.length > 0) setSelected(data.items[0]);
      })
      .catch((e) => setError(e?.message || 'Unknown error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="grid">
      <section className="card panel">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="input"
            placeholder="Search AI tool news?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="button secondary" onClick={() => setQuery('')}>Clear</button>
        </div>
        {loading && <div>Loading news?</div>}
        {error && <div className="small" style={{ color: '#fca5a5' }}>{error}</div>}
        <NewsList items={filtered} selected={selected} onSelect={setSelected} />
      </section>

      <section className="card panel">
        <div className="preview">
          {!selected ? (
            <div>Select an article to compose a video</div>
          ) : (
            <div style={{ width: '100%' }}>
              <h3 style={{ marginBottom: 8 }}>{selected.title}</h3>
              <div className="small" style={{ marginBottom: 12 }}>{selected.source} ? {new Date(selected.date).toLocaleString()}</div>
              <VideoComposer item={selected} />
            </div>
          )}
        </div>
        <div className="note">Videos are generated entirely in your browser as WebM with background audio.</div>
      </section>
    </div>
  );
}
