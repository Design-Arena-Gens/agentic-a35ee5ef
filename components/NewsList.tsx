"use client";

import Image from 'next/image';
import type { NewsItem } from '@/lib/types';

export default function NewsList({
  items,
  selected,
  onSelect
}: {
  items: NewsItem[];
  selected: NewsItem | null;
  onSelect: (item: NewsItem) => void;
}) {
  return (
    <div className="list">
      {items.map((item) => (
        <button
          key={`${item.source}-${item.link}`}
          className="item"
          onClick={() => onSelect(item)}
          style={{
            textAlign: 'left',
            background: 'transparent',
            border: selected?.link === item.link ? '1px solid #2563eb' : '1px solid #1f2a44',
            padding: 8,
            borderRadius: 10,
            cursor: 'pointer'
          }}
        >
          <div>
            {item.image ? (
              <Image
                className="thumb"
                src={item.image}
                alt="thumb"
                width={80}
                height={60}
                unoptimized
              />
            ) : (
              <div className="thumb" />
            )}
          </div>
          <div>
            <div className="title">{item.title}</div>
            {item.summary && (
              <p className="small" style={{ marginTop: 4 }}>
                {item.summary.length > 140 ? item.summary.slice(0, 140) + '?' : item.summary}
              </p>
            )}
            <div className="small">{item.source} ? {new Date(item.date).toLocaleString()}</div>
          </div>
          <div>
            <a href={item.link} target="_blank" rel="noreferrer" className="link">Open</a>
          </div>
        </button>
      ))}
    </div>
  );
}
