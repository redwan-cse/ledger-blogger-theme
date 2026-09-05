/**
 * Ledger Blogger Theme — Main Client Script
 * Milestone 3: Interactive Client Script Enhancements
 */

// Progressive enhancement marker
if (typeof document !== 'undefined') {
  document.documentElement.classList.add('js');
}





// ---------------------------------------------------------------------------
// Accessibility & Focus Management Helpers
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTOR =
  'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0
  );
}

function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const focusables = getFocusableElements(container);
  if (focusables.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (!first || !last) return;

  if (event.shiftKey) {
    if (document.activeElement === first || !container.contains(document.activeElement)) {
      event.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last || !container.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    }
  }
}

// ---------------------------------------------------------------------------
// Module 1: Reading Progress Bar (Post Views)
// ---------------------------------------------------------------------------

/**
 * Initializes the reading progress bar for post views.
 * Attaches passive scroll and resize listeners throttled via requestAnimationFrame.
 */
export function initReadingProgress(): void {
  const container = document.getElementById('reading-progress');
  if (!container) return;

  const bar = container.querySelector<HTMLElement>('.reading-progress-bar');
  if (!bar) return;

  const progressContainer: HTMLElement = container;
  const progressBar: HTMLElement = bar;

  let ticking = false;

  function update(): void {
    const doc = document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop || 0;
    const scrollHeight = doc.scrollHeight || document.body.scrollHeight || 0;
    const clientHeight = window.innerHeight || doc.clientHeight || 0;
    const maxScroll = scrollHeight - clientHeight;

    const percentage = maxScroll > 0
      ? Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100))
      : 0;

    progressBar.style.width = `${percentage}%`;
    progressContainer.setAttribute('aria-valuenow', Math.round(percentage).toString());
  }

  function onScrollOrResize(): void {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    }
  }

  // Initial calculation for pre-scrolled page loads
  update();

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });
}

// ---------------------------------------------------------------------------
// Module 2: Mobile Navigation Drawer
// ---------------------------------------------------------------------------

export interface MobileDrawerController {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
}

/**
 * Initializes the mobile slide-in drawer navigation.
 */
export function initMobileDrawer(): MobileDrawerController | null {
  const drawer = document.querySelector<HTMLElement>('#mobile-drawer');
  const backdrop = document.querySelector<HTMLElement>('.drawer-backdrop');
  const toggleButtons = document.querySelectorAll<HTMLElement>('.drawer-toggle');
  const closeButtons = drawer ? drawer.querySelectorAll<HTMLElement>('.drawer-close') : [];

  if (!drawer || !backdrop) return null;

  let lastActiveElement: HTMLElement | null = null;

  function isDrawerOpen(): boolean {
    return drawer!.classList.contains('is-open') || document.body.classList.contains('drawer-open');
  }

  function setDrawerState(open: boolean): void {
    drawer!.classList.toggle('is-open', open);
    backdrop!.classList.toggle('is-open', open);
    document.body.classList.toggle('drawer-open', open);

    drawer!.setAttribute('aria-hidden', open ? 'false' : 'true');
    backdrop!.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      drawer!.removeAttribute('inert');
    } else {
      drawer!.setAttribute('inert', 'true');
    }

    toggleButtons.forEach((btn) => {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    if (open) {
      lastActiveElement = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';
      const firstFocusable = drawer!.querySelector<HTMLElement>('.drawer-close, a, button');
      if (firstFocusable) {
        firstFocusable.focus();
      }
    } else {
      document.body.style.overflow = '';
      if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
        lastActiveElement.focus();
      }
    }
  }

  function openDrawer(): void {
    setDrawerState(true);
  }

  function closeDrawer(): void {
    setDrawerState(false);
  }

  toggleButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (isDrawerOpen()) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });
  });

  closeButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeDrawer();
    });
  });

  backdrop.addEventListener('click', () => {
    closeDrawer();
  });

  drawer.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDrawer();
    } else if (e.key === 'Tab') {
      trapFocus(drawer, e);
    }
  });

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isDrawerOpen()) {
      closeDrawer();
    }
  });

  return { open: openDrawer, close: closeDrawer, isOpen: isDrawerOpen };
}

// ---------------------------------------------------------------------------
// Module 3: Inline Live Header Search & Sidebar Dynamic Hydration
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function extractPlainText(html: string): string {
  if (!html) return '';
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  }
  let prev: string;
  let text = html;
  do {
    prev = text;
    text = text.replace(/<[^>]+>/g, '');
  } while (text !== prev);
  return text;
}

export function initLiveSearch(): void {
  const searchContainers = document.querySelectorAll<HTMLElement>(
    '.sidebar-search-card, .drawer-search-wrap, .header-search-wrap'
  );

  searchContainers.forEach((container) => {
    const searchInput = container.querySelector<HTMLInputElement>(
      '.sidebar-search-input, .drawer-search-input, .header-search-input'
    );
    const resultsDropdown = container.querySelector<HTMLElement>('.search-results-dropdown');
    if (!searchInput || !resultsDropdown) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let activeIndex = -1;
    let currentResults: Array<{ title: string; url: string; date?: string; label?: string; snippet?: string }> = [];

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim();
      if (debounceTimer) clearTimeout(debounceTimer);

      if (query.length < 2) {
        resultsDropdown.style.display = 'none';
        resultsDropdown.innerHTML = '';
        currentResults = [];
        activeIndex = -1;
        return;
      }

      resultsDropdown.style.display = 'block';
      resultsDropdown.innerHTML = '<div class="search-status-message">Searching publications…</div>';

      debounceTimer = setTimeout(async () => {
        try {
          const feedUrl = `/feeds/posts/summary?alt=json&q=${encodeURIComponent(query)}&max-results=6`;
          const res = await fetch(feedUrl, { headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error('Search request failed');
          const data = await res.json();
          const entries = data?.feed?.entry || [];

          if (entries.length === 0) {
            resultsDropdown.innerHTML = '<div class="search-status-message">No matching publications found.</div>';
            currentResults = [];
            activeIndex = -1;
            return;
          }

          currentResults = entries.map((entry: any) => {
            const title = entry.title?.$t || 'Untitled';
            const link = entry.link?.find((l: any) => l.rel === 'alternate')?.href || '#';
            const date = entry.published?.$t
              ? new Date(entry.published.$t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '';
            const label = entry.category?.[0]?.term || '';
            const snippet = entry.summary?.$t ? extractPlainText(entry.summary.$t).slice(0, 90) + '…' : '';
            return { title, url: link, date, label, snippet };
          });

          renderResults();
        } catch {
          resultsDropdown.innerHTML = '<div class="search-status-message">Search unavailable. Press Enter for full search.</div>';
          currentResults = [];
          activeIndex = -1;
        }
      }, 250);
    });

    function renderResults(): void {
      if (currentResults.length === 0) {
        resultsDropdown!.style.display = 'none';
        resultsDropdown!.innerHTML = '';
        return;
      }

      resultsDropdown!.innerHTML = `
        <ul class="search-results-list" role="listbox">
          ${currentResults
            .map(
              (item, idx) => `
            <li class="search-result-item ${idx === activeIndex ? 'is-active' : ''}" role="option" aria-selected="${idx === activeIndex}">
              <a class="search-result-link" href="${item.url}">
                <span class="search-result-title">${escapeHtml(item.title)}</span>
                <div class="search-result-meta">
                  ${item.label ? `<span class="search-result-tag">${escapeHtml(item.label)}</span>` : ''}
                  ${item.date ? `<span class="search-result-date">${escapeHtml(item.date)}</span>` : ''}
                </div>
              </a>
            </li>
          `
            )
            .join('')}
        </ul>
      `;
      resultsDropdown!.style.display = 'block';
    }

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resultsDropdown.style.display = 'none';
        resultsDropdown.innerHTML = '';
        activeIndex = -1;
      } else if (e.key === 'ArrowDown') {
        if (currentResults.length > 0) {
          e.preventDefault();
          activeIndex = (activeIndex + 1) % currentResults.length;
          renderResults();
        }
      } else if (e.key === 'ArrowUp') {
        if (currentResults.length > 0) {
          e.preventDefault();
          activeIndex = (activeIndex - 1 + currentResults.length) % currentResults.length;
          renderResults();
        }
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0) {
          const item = currentResults[activeIndex];
          if (item) {
            e.preventDefault();
            window.location.href = item.url;
          }
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (!container.contains(e.target as Node)) {
        resultsDropdown.style.display = 'none';
      }
    });
  });

  const searchToggles = document.querySelectorAll<HTMLElement>('.search-toggle');
  searchToggles.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const searchInput = document.querySelector<HTMLInputElement>('.sidebar-search-input, .drawer-search-input');
      const drawerToggle = document.querySelector<HTMLElement>('.drawer-toggle');
      const drawer = document.getElementById('mobile-drawer');
      if (window.innerWidth < 1024 && drawer && !drawer.classList.contains('is-open')) {
        drawerToggle?.click();
        setTimeout(() => searchInput?.focus(), 150);
      } else if (searchInput) {
        searchInput.focus();
        searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });
}

// Backward compatibility alias
export const initInlineLiveSearch = initLiveSearch;

export function initSidebarRecentPosts(): void {
  const recentList = document.querySelector<HTMLElement>('.sidebar-recent-list');
  if (!recentList) return;

  if (recentList.querySelectorAll('.sidebar-recent-item').length >= 2) return;

  fetch('/feeds/posts/summary?alt=json&max-results=5', { headers: { Accept: 'application/json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const entries = data?.feed?.entry || [];
      if (entries.length === 0) return;

      recentList.innerHTML = entries
        .map((entry: any) => {
          const title = entry.title?.$t || 'Untitled';
          const link = entry.link?.find((l: any) => l.rel === 'alternate')?.href || '#';
          const date = entry.published?.$t
            ? new Date(entry.published.$t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '';
          const label = entry.category?.[0]?.term || '';

          return `
          <article class="sidebar-recent-item">
            <a class="sidebar-recent-link" href="${link}">
              <span class="sidebar-recent-title">${escapeHtml(title)}</span>
              <div class="sidebar-recent-meta">
                ${label ? `<span class="sidebar-recent-tag">${escapeHtml(label)}</span>` : ''}
                ${date ? `<time class="sidebar-recent-date">${escapeHtml(date)}</time>` : ''}
              </div>
            </a>
          </article>
        `;
        })
        .join('');
    })
    .catch(() => {});
}

// ---------------------------------------------------------------------------
// Module 4: Toast Notification System & Copy-to-Clipboard
// ---------------------------------------------------------------------------

const MAX_TOASTS = 3;
const DEFAULT_TOAST_DURATION = 3000;

/**
 * Retrieves or creates the fixed toast notification container.
 */
function getToastContainer(): HTMLElement {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Dismisses a toast element with exit animation and DOM cleanup.
 */
function dismissToast(toast: HTMLElement): void {
  if (toast.classList.contains('is-hiding')) return;

  toast.classList.remove('is-visible');
  toast.classList.add('is-hiding');

  let cleaned = false;
  const cleanup = () => {
    if (!cleaned) {
      cleaned = true;
      toast.remove();
    }
  };

  toast.addEventListener('transitionend', cleanup, { once: true });
  setTimeout(cleanup, 350);
}

/**
 * Displays a toast notification message.
 */
export function showToast(message: string, duration = DEFAULT_TOAST_DURATION): HTMLElement {
  const container = getToastContainer();

  while (container.children.length >= MAX_TOASTS) {
    const oldest = container.firstElementChild as HTMLElement | null;
    if (oldest) {
      oldest.remove();
    } else {
      break;
    }
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.textContent = message;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  setTimeout(() => {
    dismissToast(toast);
  }, duration);

  return toast;
}

/**
 * Determines the target URL to copy.
 */
function getShareUrl(button?: HTMLElement | null): string {
  if (button?.dataset['url']) {
    return button.dataset['url'];
  }
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical?.href) {
    return canonical.href;
  }
  return window.location.href;
}

/**
 * Copies plain text to the clipboard with modern API and fallback support.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  const textarea = document.createElement('textarea');
  try {
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    if (textarea.parentNode) {
      textarea.parentNode.removeChild(textarea);
    }
  }
}

/**
 * Initializes the delegated click listener for copy-link buttons.
 */
export function initShareCopy(): void {
  document.addEventListener('click', async (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target) return;

    const copyBtn = target.closest<HTMLElement>('[data-action="copy-link"]');
    if (!copyBtn) return;

    event.preventDefault();

    const url = getShareUrl(copyBtn);
    const copied = await copyToClipboard(url);

    if (copied) {
      showToast('Link copied to clipboard!');
    } else {
      showToast('Unable to copy link.');
    }
  });
}

// ---------------------------------------------------------------------------
// Module 5: Theme Toggle (Dark / Light)
// ---------------------------------------------------------------------------

export function initThemeToggle(): void {
  const toggleButtons = document.querySelectorAll<HTMLElement>('.theme-toggle');
  if (toggleButtons.length === 0) return;

  const STORAGE_KEY = 'ledger_theme';
  let savedTheme: string | null = null;
  try {
    savedTheme = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage unavailable
  }
  const initialTheme = savedTheme || 'dark';

  document.documentElement.setAttribute('data-theme', initialTheme);

  function toggleTheme(): void {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable
    }
    showToast(`Switched to ${next} theme`);
    initMermaidDiagrams(next === 'dark' ? 'dark' : 'default');
  }

  toggleButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleTheme();
    });
  });
}

// ---------------------------------------------------------------------------
// Module 6: Code Block Copy & Terminal Header
// ---------------------------------------------------------------------------

export function initCodeBlockEnhancements(): void {
  // 1. Header-based or existing copy buttons
  document.querySelectorAll<HTMLButtonElement>('.code-copy-btn').forEach((btn) => {
    if (btn.dataset['initialized']) return;
    btn.dataset['initialized'] = 'true';

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const wrap = btn.closest('.code-block-wrap');
      const pre = wrap ? wrap.querySelector('pre') : btn.closest('pre');
      if (!pre) return;
      const code = pre.querySelector('code');
      const textToCopy = (code ? code.innerText : pre.innerText) || '';
      const copied = await copyToClipboard(textToCopy);
      if (copied) {
        btn.classList.add('copied');
        const span = btn.querySelector('span');
        if (span) span.textContent = 'Copied!';
        showToast('Code copied to clipboard!');
        setTimeout(() => {
          btn.classList.remove('copied');
          if (span) span.textContent = 'Copy';
        }, 2000);
      }
    });
  });

  // 2. Legacy / bare <pre> elements without a copy button
  const preElements = document.querySelectorAll<HTMLPreElement>('.post-body pre');
  preElements.forEach((pre) => {
    // Ignore Mermaid diagrams
    if (pre.classList.contains('mermaid') || pre.closest('.mermaid') || pre.closest('.mermaid-diagram-wrap')) {
      return;
    }
    if (pre.closest('.code-block-wrap')) return;
    // Avoid double-attaching
    if (pre.querySelector('.code-copy-btn')) return;

    pre.style.position = 'relative';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'code-copy-btn';
    copyBtn.setAttribute('aria-label', 'Copy code to clipboard');
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg><span>Copy</span>`;

    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const code = pre.querySelector('code');
      const textToCopy = (code ? code.innerText : pre.innerText) || '';
      const copied = await copyToClipboard(textToCopy);
      if (copied) {
        copyBtn.classList.add('copied');
        const span = copyBtn.querySelector('span');
        if (span) span.textContent = 'Copied!';
        showToast('Code copied to clipboard!');
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          if (span) span.textContent = 'Copy';
        }, 2000);
      }
    });

    pre.appendChild(copyBtn);
  });
}

// ---------------------------------------------------------------------------
// Module 6b: Prism.js Asynchronous Syntax Highlighting
// ---------------------------------------------------------------------------

export function initSyntaxHighlighting(): void {
  const codeBlocks = document.querySelectorAll('.post-body pre code[class*="language-"]');
  if (codeBlocks.length === 0) return;

  const win = window as any;
  function runHighlight(): void {
    if (win.Prism) {
      if (win.Prism.plugins && win.Prism.plugins.autoloader) {
        win.Prism.plugins.autoloader.languages_path = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/';
      }
      win.Prism.highlightAll();
    }
  }

  if (win.Prism) {
    runHighlight();
    return;
  }

  const prismScript = document.createElement('script');
  prismScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';
  prismScript.setAttribute('data-manual', 'true');
  prismScript.onload = () => {
    const autoloaderScript = document.createElement('script');
    autoloaderScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js';
    autoloaderScript.onload = runHighlight;
    document.head.appendChild(autoloaderScript);
  };
  document.head.appendChild(prismScript);
}

// ---------------------------------------------------------------------------
// Module 7: Auto Table of Contents (TOC) with Active Heading Tracking
// ---------------------------------------------------------------------------

export function initTableOfContents(): void {
  const postBody = document.querySelector<HTMLElement>('.is-post .post-body');
  if (!postBody) return;

  const headings = Array.from(postBody.querySelectorAll<HTMLHeadingElement>('h2, h3'));
  if (headings.length < 2) return;

  const tocNav = document.createElement('nav');
  tocNav.className = 'table-of-contents';
  tocNav.setAttribute('aria-label', 'Table of Contents');

  // Header container with title and section badge
  const tocHeader = document.createElement('div');
  tocHeader.className = 'toc-header';

  const tocTitle = document.createElement('div');
  tocTitle.className = 'toc-title';
  tocTitle.innerHTML = `
    <svg class="toc-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6"></line>
      <line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line>
      <line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
    <span>Table of Contents</span>
  `;

  const tocBadge = document.createElement('span');
  tocBadge.className = 'toc-badge';
  tocBadge.textContent = `${headings.length} sections`;

  const tocActions = document.createElement('div');
  tocActions.className = 'toc-actions';

  const tocToggle = document.createElement('button');
  tocToggle.type = 'button';
  tocToggle.className = 'toc-toggle';
  tocToggle.setAttribute('aria-expanded', 'true');
  tocToggle.setAttribute('aria-label', 'Toggle Table of Contents');
  tocToggle.innerHTML = `
    <span class="toc-toggle-text">Collapse</span>
    <svg class="toc-toggle-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;

  tocToggle.addEventListener('click', () => {
    tocNav.classList.toggle('is-collapsed');
    const isCollapsed = tocNav.classList.contains('is-collapsed');
    tocToggle.setAttribute('aria-expanded', String(!isCollapsed));
    const text = tocToggle.querySelector('.toc-toggle-text');
    if (text) text.textContent = isCollapsed ? 'Expand' : 'Collapse';
  });

  tocActions.appendChild(tocBadge);
  tocActions.appendChild(tocToggle);

  tocHeader.appendChild(tocTitle);
  tocHeader.appendChild(tocActions);
  tocNav.appendChild(tocHeader);

  const tocList = document.createElement('ol');
  tocList.className = 'toc-list';

  let h2Index = 0;
  headings.forEach((heading, idx) => {
    // Clone heading to extract clean text without anchor (#) or icons
    const clone = heading.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.heading-anchor, a[href^="#"]').forEach((el) => el.remove());
    const cleanTitle = (clone.textContent || '')
      .replace(/^[#\s]+/, '')
      .replace(/[#\s]+$/, '')
      .trim();

    if (!heading.id) {
      const slug = cleanTitle
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      heading.id = slug || `section-${idx + 1}`;
    }

    const isH2 = heading.tagName.toLowerCase() === 'h2';
    if (isH2) h2Index++;

    const li = document.createElement('li');
    li.className = `toc-item toc-${heading.tagName.toLowerCase()}`;

    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    link.className = 'toc-link';

    const numSpan = document.createElement('span');
    numSpan.className = 'toc-num';
    numSpan.textContent = isH2 ? String(h2Index).padStart(2, '0') : '—';

    const textSpan = document.createElement('span');
    textSpan.className = 'toc-text';
    textSpan.textContent = cleanTitle || `Section ${idx + 1}`;

    link.appendChild(numSpan);
    link.appendChild(textSpan);

    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(heading.id);
      if (target) {
        const headerOffset = 85;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        history.pushState(null, '', `#${heading.id}`);
      }
    });

    li.appendChild(link);
    tocList.appendChild(li);
  });

  tocNav.appendChild(tocList);

  const firstHeading = headings[0];
  if (firstHeading && firstHeading.parentNode) {
    firstHeading.parentNode.insertBefore(tocNav, firstHeading);
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            tocList.querySelectorAll('.toc-link').forEach((a) => {
              if (a.getAttribute('href') === `#${id}`) {
                a.classList.add('is-active');
              } else {
                a.classList.remove('is-active');
              }
            });
          }
        });
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 }
    );

    headings.forEach((h) => observer.observe(h));
  }
}

// ---------------------------------------------------------------------------
// Module 8: Article Audio Reader ("Listen to Article" - Medium Style)
// ---------------------------------------------------------------------------

export function initArticleAudioReader(): void {
  const listenBtn = document.querySelector<HTMLButtonElement>('[data-action="listen-article"]');
  if (!listenBtn) return;

  const postBody = document.querySelector<HTMLElement>('.post-body');
  if (!postBody) return;

  const playIcon = listenBtn.querySelector<HTMLElement>('.listen-icon-play');
  const pauseIcon = listenBtn.querySelector<HTMLElement>('.listen-icon-pause');
  const label = listenBtn.querySelector<HTMLElement>('.listen-label');
  const statusEl = document.querySelector<HTMLElement>('.listen-status');

  if (!('speechSynthesis' in window)) {
    listenBtn.style.display = 'none';
    return;
  }

  let isPlaying = false;
  let isPaused = false;
  let currentUtterance: SpeechSynthesisUtterance | null = null;

  function setPlayingState(playing: boolean, paused: boolean): void {
    isPlaying = playing;
    isPaused = paused;
    if (playIcon) playIcon.style.display = playing && !paused ? 'none' : 'inline-block';
    if (pauseIcon) pauseIcon.style.display = playing && !paused ? 'inline-block' : 'none';
    if (label) {
      label.textContent = playing ? (paused ? 'Resume Audio' : 'Pause Audio') : 'Listen (Audio)';
    }
    if (statusEl) {
      statusEl.textContent = playing ? (paused ? 'Audio paused' : 'Playing audio...') : '';
    }
  }

  function getCleanArticleText(): string {
    const clone = postBody!.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('pre, code, script, style, .table-of-contents').forEach((el) => el.remove());
    const title = document.querySelector<HTMLElement>('.post-title')?.textContent || '';
    return `${title}. ${clone.textContent || ''}`.replace(/\s+/g, ' ').trim();
  }

  listenBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!isPlaying) {
      window.speechSynthesis.cancel();
      const text = getCleanArticleText();
      if (!text) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        setPlayingState(false, false);
        currentUtterance = null;
        showToast('Finished audio narration');
      };

      utterance.onerror = () => {
        setPlayingState(false, false);
        currentUtterance = null;
      };

      currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
      setPlayingState(true, false);
      showToast('Playing audio narration');
    } else if (isPaused) {
      window.speechSynthesis.resume();
      setPlayingState(true, false);
      showToast('Resumed audio');
    } else {
      window.speechSynthesis.pause();
      setPlayingState(true, true);
      showToast('Paused audio');
    }
  });

  window.addEventListener('beforeunload', () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
    }
  });
}

// ---------------------------------------------------------------------------
// Module 9: Accessible Iframe Titles (Comment Form & Embeds)
// ---------------------------------------------------------------------------

/**
 * Ensures embedded iframes (e.g. Blogger comment form) always carry an accessible title attribute.
 */
export function initIframeAccessibility(): void {
  function fixIframes(): void {
    document.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
      if (!iframe.getAttribute('title')) {
        const id = iframe.id || iframe.name || 'comment-form';
        iframe.setAttribute('title', id.includes('comment') ? 'Comment Form' : 'Embedded Content');
      }
      if (!iframe.getAttribute('aria-label')) {
        const id = iframe.id || iframe.name || 'comment-form';
        iframe.setAttribute('aria-label', id.includes('comment') ? 'Comment Form' : 'Embedded Content');
      }
    });
  }

  fixIframes();
}

// ---------------------------------------------------------------------------
// Module 10: GitHub-Style Alert Callouts ([!NOTE], [!TIP], etc.)
// ---------------------------------------------------------------------------

const ALERT_TYPES: Record<string, { title: string; class: string; svg: string }> = {
  NOTE: {
    title: 'Note',
    class: 'alert-callout-note',
    svg: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>'
  },
  TIP: {
    title: 'Tip',
    class: 'alert-callout-tip',
    svg: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>'
  },
  IMPORTANT: {
    title: 'Important',
    class: 'alert-callout-important',
    svg: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'
  },
  WARNING: {
    title: 'Warning',
    class: 'alert-callout-warning',
    svg: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>'
  },
  CAUTION: {
    title: 'Caution',
    class: 'alert-callout-caution',
    svg: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>'
  }
};

export function initAlertCallouts(): void {
  const blockquotes = document.querySelectorAll<HTMLQuoteElement>('.post-body blockquote');
  blockquotes.forEach((bq) => {
    const text = bq.textContent || '';
    const match = text.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
    if (!match || !match[1]) return;

    const alertKey = match[1].toUpperCase();
    const alertConfig = ALERT_TYPES[alertKey];
    if (!alertConfig) return;

    bq.classList.add('alert-callout', alertConfig.class);

    const firstP = bq.querySelector('p') || bq;
    if (firstP.firstChild && firstP.firstChild.nodeType === Node.TEXT_NODE) {
      firstP.firstChild.textContent = (firstP.firstChild.textContent || '').replace(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i, '');
    }

    const titleEl = document.createElement('div');
    titleEl.className = 'alert-callout-title';
    titleEl.innerHTML = `${alertConfig.svg}<span>${alertConfig.title}</span>`;
    bq.insertBefore(titleEl, bq.firstChild);
  });
}

// ---------------------------------------------------------------------------
// Module 11: Dynamic Client-Side Reading Time
// ---------------------------------------------------------------------------

export function initReadingTime(): void {
  const postBody = document.querySelector<HTMLElement>('.post-body');
  const mount = document.getElementById('reading-time-mount');
  const sep = document.querySelector<HTMLElement>('.reading-time-sep');
  if (!postBody || !mount) return;

  const text = postBody.innerText || '';
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words < 20) return;

  const minutes = Math.max(1, Math.ceil(words / 200));
  mount.textContent = `⏱️ ${minutes} min read`;
  mount.style.display = 'inline';
  if (sep) sep.style.display = 'inline';
}

// ---------------------------------------------------------------------------
// Module 12: Global Keyboard Shortcuts
// ---------------------------------------------------------------------------

export function initKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable) {
        return;
      }
    }

    if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      const searchInput = document.querySelector<HTMLInputElement>('.sidebar-search-input, .drawer-search-input');
      if (searchInput) {
        const drawerToggle = document.querySelector<HTMLElement>('.drawer-toggle');
        const drawer = document.getElementById('mobile-drawer');
        if (window.innerWidth < 1024 && drawer && !drawer.classList.contains('is-open')) {
          drawerToggle?.click();
          setTimeout(() => searchInput.focus(), 150);
        } else {
          searchInput.focus();
        }
      }
    } else if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const themeToggle = document.querySelector<HTMLElement>('.theme-toggle');
      if (themeToggle) {
        themeToggle.click();
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Module 13: Centered Native Blogger Follow Popup Dialog
// ---------------------------------------------------------------------------

/**
 * Intercepts clicks on Google Blogger Follow links and opens a centered,
 * clean OAuth-style modal popup window instead of navigating away.
 * Keeps the visitor on the site while Google's compact follow dialog completes.
 */
export function initBloggerFollowPopup(): void {
  document.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target) return;

    const followLink = target.closest<HTMLAnchorElement>('a[href*="followers/follow"], [data-action="blogger-follow"]');
    if (!followLink) return;

    // Allow middle click or keyboard modifier clicks to open in background if explicitly desired
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();

    const width = 540;
    const height = 520;

    // Center window relative to current monitor screen and browser window
    const screenLeft = window.screenX !== undefined ? window.screenX : (window as any).screenLeft || 0;
    const screenTop = window.screenY !== undefined ? window.screenY : (window as any).screenTop || 0;
    const outerWidth = window.outerWidth || document.documentElement.clientWidth || screen.width;
    const outerHeight = window.outerHeight || document.documentElement.clientHeight || screen.height;

    const left = Math.max(0, Math.round(screenLeft + (outerWidth - width) / 2));
    const top = Math.max(0, Math.round(screenTop + (outerHeight - height) / 2));

    const popupFeatures = [
      `width=${width}`,
      `height=${height}`,
      `top=${top}`,
      `left=${left}`,
      'resizable=yes',
      'scrollbars=yes',
      'status=no',
      'location=yes',
      'toolbar=no',
      'menubar=no'
    ].join(',');

    try {
      const popup = window.open(followLink.href, 'BloggerFollowPrompt', popupFeatures);

      if (popup) {
        popup.focus();

        // Check for popup closure to provide feedback on the parent page
        const checkClosed = setInterval(() => {
          try {
            if (popup.closed) {
              clearInterval(checkClosed);
              showToast('Thank you for following on Blogger!');
            }
          } catch {
            clearInterval(checkClosed);
          }
        }, 800);
      } else {
        // If popup was blocked by browser, fallback gracefully to opening in a new tab
        window.open(followLink.href, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(followLink.href, '_blank', 'noopener,noreferrer');
    }
  });
}

// ---------------------------------------------------------------------------
// Global Initialization
// ---------------------------------------------------------------------------

function init(): void {
  initThemeToggle();
  initPostHeroImage();

  const defer = typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 50);

  defer(() => {
    initMobileDrawer();
    initInlineLiveSearch();
    initSidebarRecentPosts();
    initShareCopy();
    initBloggerFollowPopup();
    initIframeAccessibility();
    initKeyboardShortcuts();

    const isPost = document.body?.classList.contains('is-post') || Boolean(document.querySelector('.is-post'));
    if (isPost) {
      initReadingProgress();
      initCodeBlockEnhancements();
      initSyntaxHighlighting();
      initTableOfContents();
      initAlertCallouts();
      initReadingTime();
      initArticleAudioReader();
      initMermaidDiagrams();
      initPostHeroImage();
    } else {
      initHomepageCatalog();
    }
  });
}

// ---------------------------------------------------------------------------
// Module 13: Homepage Auto-Filtered Catalog & Numbered Pagination Suite
// ---------------------------------------------------------------------------

interface CatalogPost {
  id: string;
  title: string;
  url: string;
  published: string;
  dateStr: string;
  year: string;
  month: string;
  categories: string[];
  excerpt: string;
  thumbnail?: string;
}

export function initHomepageCatalog(): void {
  const filterBar = document.getElementById('posts-filter-bar');
  if (!filterBar) return;

  const searchInput = document.getElementById('catalog-search') as HTMLInputElement | null;
  const yearSelect = document.getElementById('catalog-year') as HTMLSelectElement | null;
  const monthSelect = document.getElementById('catalog-month') as HTMLSelectElement | null;
  const categorySelect = document.getElementById('catalog-category') as HTMLSelectElement | null;
  const postsContainer = document.querySelector<HTMLElement>('.blog-posts, #page_body .blog-posts, .main-content .blog-posts');

  if (!postsContainer) return;

  let allPosts: CatalogPost[] = [];
  let filteredPosts: CatalogPost[] = [];
  let currentPage = 1;
  const getPageSize = () => (window.innerWidth >= 768 ? 8 : 4);

  fetch('/feeds/posts/default?alt=json&max-results=150', { headers: { Accept: 'application/json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const entries = data?.feed?.entry || [];
      if (entries.length === 0) return;

      allPosts = entries.map((entry: any) => {
        const id = entry.id?.$t || '';
        const title = entry.title?.$t || 'Untitled';
        const url = entry.link?.find((l: any) => l.rel === 'alternate')?.href || '#';
        const published = entry.published?.$t || '';
        const dateObj = published ? new Date(published) : new Date();
        const year = String(dateObj.getFullYear());
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const categories = (entry.category || []).map((c: any) => c.term).filter(Boolean);

        let contentHtml = entry.content?.$t || entry.summary?.$t || '';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contentHtml;
        tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6, pre, code, style, script, .table-of-contents, .heading-anchor').forEach((el) => el.remove());
        const rawExcerpt = (tempDiv.textContent || '').replace(/^#+.*?[#\n]/, '').replace(/\s+/g, ' ').trim();
        const excerpt = rawExcerpt.length > 180 ? rawExcerpt.slice(0, 177) + '...' : rawExcerpt;

        let thumbnail = entry.media$thumbnail?.url;
        if (!thumbnail) {
          const img = tempDiv.querySelector('img');
          if (img && img.src) {
            thumbnail = img.src;
          }
        }

        const lowerTitle = title.toLowerCase();
        if (thumbnail) {
          // Upgrade Blogger low-res 72px thumbnail to crisp 600px
          thumbnail = thumbnail.replace(/\/s72-c\//, '/s600/').replace(/=s72-c/, '=s600');

          // Map known Google Drive links (which block unauthenticated Chrome requests) to open jsDelivr CDN
          if (thumbnail.includes('1lpgnegmqweg8a6uclg02ahi_rs22cx2y') || lowerTitle.includes('linux user namespaces')) {
            thumbnail = 'https://cdn.jsdelivr.net/gh/redwan-cse/ledger-blogger-theme@main/assets/posts/linux-user-namespaces-security-paradox/thumbnail.png';
          } else if (thumbnail.includes('1zbmp_o9ba7oba2oqfezbzn_kwtt1sxt1') || lowerTitle.includes('postgresql row-level') || lowerTitle.includes('row-level security')) {
            thumbnail = 'https://cdn.jsdelivr.net/gh/redwan-cse/ledger-blogger-theme@main/assets/posts/postgresql-row-level-security-threat/thumbnail.png';
          } else if (lowerTitle.includes('xdp and ebpf') || lowerTitle.includes('xdp')) {
            thumbnail = 'https://cdn.jsdelivr.net/gh/redwan-cse/ledger-blogger-theme@main/assets/posts/xdp-ebpf-packet-filtering/thumbnail.png';
          }
        } else {
          // Fallback mapping for posts without media$thumbnail
          if (lowerTitle.includes('linux user namespaces')) {
            thumbnail = 'https://cdn.jsdelivr.net/gh/redwan-cse/ledger-blogger-theme@main/assets/posts/linux-user-namespaces-security-paradox/thumbnail.png';
          } else if (lowerTitle.includes('postgresql row-level') || lowerTitle.includes('row-level security')) {
            thumbnail = 'https://cdn.jsdelivr.net/gh/redwan-cse/ledger-blogger-theme@main/assets/posts/postgresql-row-level-security-threat/thumbnail.png';
          } else if (lowerTitle.includes('xdp and ebpf') || lowerTitle.includes('xdp')) {
            thumbnail = 'https://cdn.jsdelivr.net/gh/redwan-cse/ledger-blogger-theme@main/assets/posts/xdp-ebpf-packet-filtering/thumbnail.png';
          }
        }

        return {
          id,
          title,
          url,
          published,
          dateStr,
          year,
          month,
          categories,
          excerpt,
          thumbnail
        };
      });

      if (yearSelect) {
        const years = Array.from(new Set(allPosts.map((p) => p.year))).sort((a, b) => Number(b) - Number(a));
        yearSelect.innerHTML = '<option value="all">All years</option>' + years.map((y) => `<option value="${y}">${y}</option>`).join('');
      }

      if (monthSelect) {
        const MONTHS = [
          { val: '01', name: 'January' },
          { val: '02', name: 'February' },
          { val: '03', name: 'March' },
          { val: '04', name: 'April' },
          { val: '05', name: 'May' },
          { val: '06', name: 'June' },
          { val: '07', name: 'July' },
          { val: '08', name: 'August' },
          { val: '09', name: 'September' },
          { val: '10', name: 'October' },
          { val: '11', name: 'November' },
          { val: '12', name: 'December' }
        ];
        monthSelect.innerHTML = '<option value="all">All months</option>' +
          MONTHS.map((m) => `<option value="${m.val}">${m.name}</option>`).join('');
      }

      if (categorySelect) {
        const allCats = Array.from(new Set(allPosts.flatMap((p) => p.categories))).sort();
        categorySelect.innerHTML = '<option value="all">All categories</option>' + allCats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
      }

      applyFilter();
    })
    .catch(() => {});

  function applyFilter(): void {
    const query = (searchInput?.value || '').toLowerCase().trim();
    const yearVal = yearSelect?.value || 'all';
    const monthVal = monthSelect?.value || 'all';
    const catVal = categorySelect?.value || 'all';

    filteredPosts = allPosts.filter((post) => {
      if (yearVal !== 'all' && post.year !== yearVal) return false;
      if (monthVal !== 'all' && post.month !== monthVal) return false;
      if (catVal !== 'all' && !post.categories.includes(catVal)) return false;
      if (query) {
        const matchTitle = post.title.toLowerCase().includes(query);
        const matchExcerpt = post.excerpt.toLowerCase().includes(query);
        const matchCat = post.categories.some((c) => c.toLowerCase().includes(query));
        if (!matchTitle && !matchExcerpt && !matchCat) return false;
      }
      return true;
    });

    currentPage = 1;
    renderPage();
  }

  function renderPage(): void {
    const pageSize = getPageSize();
    const totalPages = Math.ceil(filteredPosts.length / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * pageSize;
    const pagePosts = filteredPosts.slice(startIdx, startIdx + pageSize);

    const h2Tag = 'h' + '2';
    const h3Tag = 'h' + '3';

    if (pagePosts.length === 0) {
      postsContainer!.innerHTML = `
        <div class="empty-state" style="padding: 40px 20px; text-align: center;">
          <${h3Tag} class="empty-state-title" style="margin-bottom: 8px;">No articles found</${h3Tag}>
          <p class="empty-state-desc" style="color: var(--ink-muted, #57606a);">Try clearing your search query or selecting a different year or category.</p>
        </div>
      `;
    } else {
      postsContainer!.innerHTML = pagePosts
        .map((p, idx) => {
          return `
          <article class="post">
            <div class="post-card-inner ${p.thumbnail ? 'has-thumbnail' : 'no-thumbnail'}">
              ${p.thumbnail ? `
                <a class="post-thumbnail-link" href="${p.url}" tabindex="-1" aria-hidden="true">
                  <img class="post-thumbnail" src="${p.thumbnail}" alt="" loading="${idx < 2 ? 'eager' : 'lazy'}" referrerpolicy="no-referrer" />
                </a>
              ` : ''}
              <div class="post-content-wrap">
                <${h2Tag} class="post-title">
                  <a href="${p.url}">${escapeHtml(p.title)}</a>
                </${h2Tag}>
                <div class="post-meta-row">
                  <div class="post-author-mini">
                    <img class="post-author-mini-avatar" src="https://blogger.googleusercontent.com/img/a/AVvXsEid2pK6sS9Z_2jCm6SFeomZwfHDSq0li0pY6e8i_NNiuJkwHKqMqJ9gLw2qws2Xp42oCc5QGFvDw-PjbWF6CHaF7D-BShybE1d5A4OglhgVfsNPm0dg-1CRHkmrBZnAv8neHaTTb_hEzsaZZMgUP9mnTJqSAvtYtuzbOEKnsE2OJ1viJolqiQU7D532vxQ=s80" alt="Md Redwan Ahmed" width="20" height="20" loading="lazy" />
                    <span class="post-author-mini-name">Md. Redwan Ahmed</span>
                  </div>
                  <span class="post-meta-sep">·</span>
                  <time class="post-date" datetime="${p.published}">${escapeHtml(p.dateStr)}</time>
                </div>
                <div class="post-excerpt">${escapeHtml(p.excerpt)}</div>
                <div class="post-footer">
                  <div class="post-labels">
                    ${p.categories.map((c) => `<span class="post-label">${escapeHtml(c)}</span>`).join('')}
                  </div>
                  <div class="jump-link">
                    <a href="${p.url}">
                      <span class="jump-link-text">Read article</span>
                      <span class="jump-link-arrow" aria-hidden="true">→</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </article>
        `;
        })
        .join('');
    }

    renderPagination(totalPages);
  }

  function renderPagination(totalPages: number): void {
    let paginationEl = document.getElementById('blog-pagination');
    if (!paginationEl) {
      paginationEl = document.createElement('nav');
      paginationEl.id = 'blog-pagination';
      paginationEl.className = 'pagination post-pagination';
      paginationEl.setAttribute('aria-label', 'Articles pagination');
      postsContainer!.parentNode?.insertBefore(paginationEl, postsContainer!.nextSibling);
    }

    paginationEl.style.display = 'flex';

    let html = '';

    const prevDisabled = currentPage === 1;
    html += `<button class="page-nav-btn prev-btn" type="button"${prevDisabled ? ' disabled="disabled"' : ''}>Previous</button>`;

    html += '<div class="numbered-pages">';
    for (let i = 1; i <= totalPages; i++) {
      if (totalPages > 8) {
        if (i > 1 && i < currentPage - 2) {
          if (i === 2) html += '<span class="page-num-btn page-ellipsis">…</span>';
          continue;
        }
        if (i < totalPages && i > currentPage + 2) {
          if (i === totalPages - 1) html += '<span class="page-num-btn page-ellipsis">…</span>';
          continue;
        }
      }
      const isActive = i === currentPage;
      html += `<button class="page-num-btn${isActive ? ' is-active' : ''}" type="button" data-page="${i}" aria-label="Page ${i}">${i}</button>`;
    }
    html += '</div>';

    const nextDisabled = currentPage === totalPages;
    html += `<button class="page-nav-btn next-btn" type="button"${nextDisabled ? ' disabled="disabled"' : ''}>Next</button>`;

    paginationEl.innerHTML = html;

    paginationEl.querySelector('.prev-btn')?.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        scrollToTop();
        renderPage();
      }
    });

    paginationEl.querySelector('.next-btn')?.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        scrollToTop();
        renderPage();
      }
    });

    paginationEl.querySelectorAll<HTMLButtonElement>('.page-num-btn[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const page = Number(btn.getAttribute('data-page'));
        if (page && page !== currentPage) {
          currentPage = page;
          scrollToTop();
          renderPage();
        }
      });
    });
  }

  function scrollToTop(): void {
    filterBar?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  let debounceTimer: any;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyFilter(), 150);
  });

  yearSelect?.addEventListener('change', () => applyFilter());
  monthSelect?.addEventListener('change', () => applyFilter());
  categorySelect?.addEventListener('change', () => applyFilter());

  window.addEventListener('resize', () => {
    renderPage();
  });
}

/**
 * Dynamically loads and renders Mermaid.js sequence and flow diagrams if present in article.
 * Supports theme toggling by caching raw diagram source code.
 */
export function initMermaidDiagrams(targetTheme?: 'dark' | 'default'): void {
  const wraps = document.querySelectorAll<HTMLElement>('.mermaid-diagram-wrap');
  const standaloneMermaids = document.querySelectorAll<HTMLElement>('.post-body pre.mermaid');
  if (wraps.length === 0 && standaloneMermaids.length === 0) return;

  const currentTheme = targetTheme || (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default');
  const isDark = currentTheme === 'dark';

  function renderMermaid(mermaidApi: any): void {
    mermaidApi.initialize({
      startOnLoad: false,
      theme: currentTheme,
      themeVariables: isDark ? {
        darkMode: true,
        background: '#161B22',
        primaryColor: '#2563EB',
        primaryTextColor: '#F8FAFC',
        lineColor: '#58A6FF'
      } : {
        darkMode: false,
        background: '#FFFFFF',
        primaryColor: '#F6F8FA',
        primaryTextColor: '#1F2328',
        primaryBorderColor: '#D0D7DE',
        lineColor: '#57606A'
      },
      securityLevel: 'loose'
    });

    wraps.forEach((wrap, index) => {
      let code = wrap.dataset['mermaidCode'];
      if (!code) {
        const pre = wrap.querySelector('.mermaid');
        if (pre) {
          code = pre.textContent || '';
          wrap.dataset['mermaidCode'] = code;
        }
      }
      if (!code) return;
      wrap.innerHTML = `<pre class="mermaid" id="mermaid-wrap-${index}">${escapeHtml(code)}</pre>`;
    });

    try {
      mermaidApi.run({
        nodes: document.querySelectorAll('.mermaid-diagram-wrap .mermaid, .post-body pre.mermaid')
      });
    } catch (e) {
      console.warn('Mermaid rendering notice:', e);
    }

    wraps.forEach((wrap, index) => {
      if (wrap.querySelector('.mermaid-modern-toolbar')) return;

      let zoomScale = 1.0;

      const toolbar = document.createElement('div');
      toolbar.className = 'mermaid-modern-toolbar';
      toolbar.innerHTML = `
        <button type="button" class="mm-btn mm-btn-out" aria-label="Zoom out" title="Zoom out" disabled>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button type="button" class="mm-level" aria-label="Reset zoom" title="Reset zoom (100%)">100%</button>
        <button type="button" class="mm-btn mm-btn-in" aria-label="Zoom in" title="Zoom in">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <span class="mm-sep" aria-hidden="true"></span>
        <button type="button" class="mm-btn mm-btn-dl" aria-label="Download diagram as SVG" title="Download SVG">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </button>
      `;

      const levelBtn = toolbar.querySelector<HTMLButtonElement>('.mm-level');
      const zoomInBtn = toolbar.querySelector<HTMLButtonElement>('.mm-btn-in');
      const zoomOutBtn = toolbar.querySelector<HTMLButtonElement>('.mm-btn-out');
      const dlBtn = toolbar.querySelector<HTMLButtonElement>('.mm-btn-dl');

      const getDiagramSvg = (): SVGElement | null => {
        const allSvgs = Array.from(wrap.querySelectorAll<SVGElement>('svg'));
        return allSvgs.find((s) => !s.closest('.mermaid-modern-toolbar')) || null;
      };

      const updateZoom = (newScale: number) => {
        zoomScale = Math.min(2.5, Math.max(1.0, Math.round(newScale * 100) / 100));
        const diagramSvg = getDiagramSvg();
        if (diagramSvg) {
          if (zoomScale === 1.0) {
            diagramSvg.style.transform = '';
            diagramSvg.style.transformOrigin = '';
            diagramSvg.style.margin = '';
            wrap.classList.remove('is-zoomed');
          } else {
            diagramSvg.style.transform = `scale(${zoomScale})`;
            diagramSvg.style.transformOrigin = 'top center';
            diagramSvg.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)';
            diagramSvg.style.margin = `${Math.round((zoomScale - 1) * 35)}px 0`;
            wrap.classList.add('is-zoomed');
          }
        }
        if (levelBtn) {
          levelBtn.textContent = `${Math.round(zoomScale * 100)}%`;
        }
        if (zoomOutBtn) {
          zoomOutBtn.disabled = (zoomScale <= 1.0);
        }
        if (zoomInBtn) {
          zoomInBtn.disabled = (zoomScale >= 2.5);
        }
      };

      if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => updateZoom(zoomScale + 0.25));
      }

      if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => updateZoom(zoomScale - 0.25));
      }

      if (levelBtn) {
        levelBtn.addEventListener('click', () => updateZoom(1.0));
      }

      if (dlBtn) {
        dlBtn.addEventListener('click', () => {
          const diagramSvg = getDiagramSvg();
          if (!diagramSvg) return;

          const svgClone = diagramSvg.cloneNode(true) as SVGElement;
          const viewBox = svgClone.getAttribute('viewBox') || '';
          const parts = viewBox.split(/[\s,]+/).map(Number);
          let minX = 0, minY = 0, vbWidth = 1200, vbHeight = 800;
          if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
            minX = parts[0]!;
            minY = parts[1]!;
            vbWidth = parts[2]!;
            vbHeight = parts[3]!;
          }

          svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          svgClone.setAttribute('width', String(vbWidth));
          svgClone.setAttribute('height', String(vbHeight));

          // Clean inline scale transform if currently zoomed
          svgClone.style.transform = '';
          svgClone.style.transformOrigin = '';
          svgClone.style.margin = '';

          // Add clean background rect so SVG renders cleanly in standalone viewer
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark-theme');
          const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bg.setAttribute('x', String(minX));
          bg.setAttribute('y', String(minY));
          bg.setAttribute('width', String(vbWidth));
          bg.setAttribute('height', String(vbHeight));
          bg.setAttribute('fill', isDark ? '#161b22' : '#ffffff');
          svgClone.insertBefore(bg, svgClone.firstChild);

          const svgData = new XMLSerializer().serializeToString(svgClone);
          const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `architecture-diagram-${index + 1}.svg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 200);
        });
      }

      wrap.insertBefore(toolbar, wrap.firstChild);
    });
  }

  const win = window as any;
  if (win.mermaid) {
    renderMermaid(win.mermaid);
  } else {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
    script.async = true;
    script.onload = () => {
      if (win.mermaid) {
        renderMermaid(win.mermaid);
      }
    };
    document.head.appendChild(script);
  }
}

// ---------------------------------------------------------------------------
// Module 14: Article Hero Image CDN Resolver & Broken Image Fallback
// ---------------------------------------------------------------------------

export function initPostHeroImage(): void {
  const heroImg = document.querySelector<HTMLImageElement>(
    '.post-hero-image, .post-hero-wrap img, .post-body img[alt="Article Hero"], article.post img:first-of-type'
  );
  if (!heroImg) return;

  const currentSrc = (heroImg.getAttribute('src') || '').trim();
  const pagePath = window.location.pathname.toLowerCase();
  const pageTitle = (document.title || '').toLowerCase();

  let cdnSrc = '';
  if (
    pagePath.includes('linux-user-namespaces') ||
    pageTitle.includes('linux user namespaces') ||
    currentSrc.includes('1lpgnegmqweg8a6uclg02ahi_rs22cx2y')
  ) {
    cdnSrc = 'https://cdn.jsdelivr.net/gh/redwan-cse/ledger-blogger-theme@main/assets/posts/linux-user-namespaces-security-paradox/thumbnail.png';
  } else if (
    pagePath.includes('postgresql-row-level') ||
    pageTitle.includes('postgresql row-level') ||
    pageTitle.includes('row-level security') ||
    currentSrc.includes('1zbmp_o9ba7oba2oqfezbzn_kwtt1sxt1')
  ) {
    cdnSrc = 'https://cdn.jsdelivr.net/gh/redwan-cse/ledger-blogger-theme@main/assets/posts/postgresql-row-level-security-threat/thumbnail.png';
  } else if (
    pagePath.includes('xdp') ||
    pagePath.includes('ebpf-packet-filtering') ||
    pageTitle.includes('xdp') ||
    pageTitle.includes('ebpf')
  ) {
    cdnSrc = 'https://cdn.jsdelivr.net/gh/redwan-cse/ledger-blogger-theme@main/assets/posts/xdp-ebpf-packet-filtering/thumbnail.png';
  }

  function isGoogleUserContent(urlStr: string): boolean {
    try {
      const parsed = new URL(urlStr, window.location.href);
      return parsed.hostname === 'googleusercontent.com' || parsed.hostname.endsWith('.googleusercontent.com');
    } catch {
      return false;
    }
  }

  // Replace blocked Google Drive links or data URIs with reliable open CDN
  if (cdnSrc && (isGoogleUserContent(currentSrc) || currentSrc.startsWith('data:') || currentSrc.length > 500 || currentSrc !== cdnSrc)) {
    heroImg.src = cdnSrc;
  }

  heroImg.setAttribute('referrerpolicy', 'no-referrer');
  heroImg.setAttribute('loading', 'eager');
  heroImg.setAttribute('fetchpriority', 'high');

  // Defensive fallback: If image fails to load, try cdnSrc or hide broken container
  heroImg.addEventListener('error', () => {
    if (cdnSrc && heroImg.src !== cdnSrc) {
      heroImg.src = cdnSrc;
    } else {
      const wrap = heroImg.closest('.post-hero-wrap') as HTMLElement | null;
      if (wrap) wrap.style.display = 'none';
    }
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

