'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Reset active state on page change
    setActiveId('');

    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Small delay to ensure DOM is updated after navigation
    const timeoutId = setTimeout(() => {
      // Get all headings from the main content area
      const elements = document.querySelectorAll('.docs-content h2, .docs-content h3');
      const items: TocItem[] = [];

      elements.forEach((element) => {
        const id = element.id;
        const text = element.textContent || '';
        const level = element.tagName === 'H2' ? 2 : 3;
        if (id && text) {
          items.push({ id, text, level });
        }
      });

      setHeadings(items);

      // Set first heading as active initially
      if (items.length > 0) {
        setActiveId(items[0].id);
      }

      // Set up intersection observer for active state
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveId(entry.target.id);
            }
          });
        },
        {
          rootMargin: '-80px 0px -80% 0px',
          threshold: 0,
        }
      );

      elements.forEach((element) => {
        if (element.id) {
          observerRef.current?.observe(element);
        }
      });
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [pathname]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (headings.length === 0) {
    return null;
  }

  return (
    <aside className="docs-sidebar-right">
      <div className="docs-toc">
          <h4 className="docs-toc-title">On this page</h4>
          <nav className="docs-toc-nav">
            {headings.map((heading) => (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                className={`docs-toc-link ${activeId === heading.id ? 'active' : ''}`}
                style={{ paddingLeft: heading.level === 3 ? '24px' : '12px' }}
                onClick={(e) => {
                  e.preventDefault();
                  const element = document.getElementById(heading.id);
                  if (element) {
                    const offset = 100;
                    const elementPosition = element.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - offset;
                    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                    setActiveId(heading.id);
                  }
                }}
              >
                {heading.text}
              </a>
            ))}
          </nav>
          <div className="docs-toc-footer">
            <button onClick={scrollToTop} className="docs-toc-back-to-top">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              Back to top
            </button>
          </div>
        </div>
    </aside>
  );
}
