'use client';

import { useState, useEffect, useCallback, useRef, useMemo, ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import Fuse, { FuseResultMatch } from 'fuse.js';
import searchIndex from '@/generated/search-index.json';

interface SearchItem {
  href: string;
  title: string;
  section: string;
  content: string;
  headings: string[];
}

interface SearchResult {
  item: SearchItem;
  matches?: readonly FuseResultMatch[];
}

const fuse = new Fuse(searchIndex as SearchItem[], {
  keys: [
    { name: 'title', weight: 3 },
    { name: 'headings', weight: 2 },
    { name: 'content', weight: 1 },
    { name: 'section', weight: 0.5 },
  ],
  threshold: 0.4,
  includeMatches: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
});

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (query.length === 0) {
      return (searchIndex as SearchItem[]).slice(0, 8).map(item => ({ item }));
    }
    return fuse.search(query).slice(0, 12) as SearchResult[];
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (resultsRef.current && selectedIndex >= 0) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleSelect = useCallback((href: string) => {
    router.push(href);
    onClose();
  }, [router, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex].item.href);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [results, selectedIndex, handleSelect, onClose]);

  const getMatchPreview = (result: SearchResult): string | null => {
    if (!result.matches || !query) return null;

    // Find content match
    const contentMatch = result.matches.find(m => m.key === 'content');
    if (contentMatch && contentMatch.indices.length > 0) {
      const content = result.item.content;
      const [start] = contentMatch.indices[0];
      const previewStart = Math.max(0, start - 30);
      const previewEnd = Math.min(content.length, start + 100);
      let preview = content.slice(previewStart, previewEnd);
      if (previewStart > 0) preview = '...' + preview;
      if (previewEnd < content.length) preview = preview + '...';
      return preview;
    }

    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-modal-header">
          <svg className="search-modal-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="search-modal-input"
            placeholder="Search documentation..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="search-modal-kbd">ESC</kbd>
        </div>

        <div className="search-modal-results" ref={resultsRef}>
          {results.length === 0 ? (
            <div className="search-modal-empty">
              No results found for "{query}"
            </div>
          ) : (
            results.map((result, index) => {
              const preview = getMatchPreview(result);
              return (
                <button
                  key={result.item.href}
                  className={`search-modal-result ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleSelect(result.item.href)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="search-modal-result-icon">
                    <PageIcon section={result.item.section} />
                  </div>
                  <div className="search-modal-result-content">
                    <span className="search-modal-result-title">{result.item.title}</span>
                    {preview ? (
                      <span className="search-modal-result-preview">{preview}</span>
                    ) : (
                      <span className="search-modal-result-section">{result.item.section}</span>
                    )}
                  </div>
                  <svg className="search-modal-result-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              );
            })
          )}
        </div>

        <div className="search-modal-footer">
          <span className="search-modal-hint">
            <kbd>↑</kbd><kbd>↓</kbd> to navigate
          </span>
          <span className="search-modal-hint">
            <kbd>↵</kbd> to select
          </span>
          <span className="search-modal-hint">
            <kbd>esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}

function PageIcon({ section }: { section: string }) {
  const sectionIcons: Record<string, ReactElement> = {
    'Get Started': (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    'Core Concepts': (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
    'Sources': (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    'API Reference': (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    'CLI': (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
    'Guides': (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  };

  return sectionIcons[section] || (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
