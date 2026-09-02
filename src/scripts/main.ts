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
  const preElements = document.querySelectorAll<HTMLPreElement>('.post-body pre');
  preElements.forEach((pre) => {
    if (pre.parentElement?.classList.contains('code-block-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';

    const header = document.createElement('div');
    header.className = 'code-block-header';

    const code = pre.querySelector('code');
    const classList = code ? Array.from(code.classList) : [];
    const langClass = classList.find((c) => c.startsWith('language-') || c.startsWith('lang-'));
    const lang = langClass ? langClass.replace(/^(language-|lang-)/, '') : 'code';

    const langBadge = document.createElement('span');
    langBadge.className = 'code-lang-badge';
    langBadge.textContent = lang.toUpperCase();
    header.appendChild(langBadge);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'code-copy-btn';
    copyBtn.setAttribute('aria-label', 'Copy code to clipboard');
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg><span>Copy</span>`;

    copyBtn.addEventListener('click', async () => {
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

    header.appendChild(copyBtn);

    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });
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

  const tocTitle = document.createElement('div');
  tocTitle.className = 'toc-title';
  tocTitle.textContent = 'Table of Contents';
  tocNav.appendChild(tocTitle);

  const tocList = document.createElement('ul');
  tocList.className = 'toc-list';

  headings.forEach((heading, idx) => {
    if (!heading.id) {
      const slug = heading.textContent
        ? heading.textContent.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
        : `heading-${idx + 1}`;
      heading.id = slug || `section-${idx + 1}`;
    }

    const li = document.createElement('li');
    li.className = `toc-item toc-${heading.tagName.toLowerCase()}`;

    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    link.className = 'toc-link';
    link.textContent = heading.textContent || `Section ${idx + 1}`;

    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(heading.id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
// Global Initialization
// ---------------------------------------------------------------------------

function init(): void {
  // Theme toggle runs synchronously to prevent dark/light flash
  initThemeToggle();

  // Defer all interactive modules and post enhancements to idle / next frame
  const defer = typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 50);

  defer(() => {
    initMobileDrawer();
    initInlineLiveSearch();
    initSidebarRecentPosts();
    initShareCopy();
    initIframeAccessibility();

    const isPost = document.body?.classList.contains('is-post') || Boolean(document.querySelector('.is-post'));
    if (isPost) {
      initReadingProgress();
      initCodeBlockEnhancements();
      initTableOfContents();
      initArticleAudioReader();
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

