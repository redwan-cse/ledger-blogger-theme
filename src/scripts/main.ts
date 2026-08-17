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
      const isModalOpen = document.querySelector('#search-modal[open], #search-modal.is-open') !== null;
      if (!isModalOpen) {
        document.body.style.overflow = '';
      }
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
        closeSearchModalDirect();
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
// Module 3: Expandable Search Modal (<dialog>)
// ---------------------------------------------------------------------------

function closeDrawerDirect(): void {
  const drawer = document.querySelector<HTMLElement>('#mobile-drawer');
  const backdrop = document.querySelector<HTMLElement>('.drawer-backdrop');
  const toggles = document.querySelectorAll<HTMLElement>('.drawer-toggle');

  if (drawer) {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
  }
  if (backdrop) {
    backdrop.classList.remove('is-open');
    backdrop.setAttribute('aria-hidden', 'true');
  }
  toggles.forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
  document.body.classList.remove('drawer-open');
}

function closeSearchModalDirect(): void {
  const modal = document.querySelector<HTMLDialogElement>('#search-modal');
  if (!modal) return;
  if (typeof modal.showModal === 'function' && modal.open) {
    modal.close();
  } else {
    modal.removeAttribute('open');
    modal.classList.remove('is-open');
  }
  modal.setAttribute('aria-hidden', 'true');
  const toggles = document.querySelectorAll<HTMLElement>('.search-toggle');
  toggles.forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
}

export interface SearchModalController {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
}

/**
 * Initializes the expandable search modal overlay.
 */
export function initSearchModal(): SearchModalController | null {
  const modal = document.querySelector<HTMLDialogElement>('#search-modal');
  const toggleButtons = document.querySelectorAll<HTMLElement>('.search-toggle');
  const closeButtons = modal ? modal.querySelectorAll<HTMLElement>('.search-modal-close') : [];

  if (!modal) return null;

  let lastActiveElement: HTMLElement | null = null;
  const isDialogSupported = typeof modal.showModal === 'function';

  function isModalOpen(): boolean {
    return modal!.hasAttribute('open') || modal!.classList.contains('is-open');
  }

  function openModal(): void {
    lastActiveElement = document.activeElement as HTMLElement | null;

    if (isDialogSupported) {
      if (!modal!.open) {
        modal!.showModal();
      }
    } else {
      modal!.setAttribute('open', '');
      modal!.classList.add('is-open');
    }

    modal!.setAttribute('aria-hidden', 'false');
    toggleButtons.forEach((btn) => btn.setAttribute('aria-expanded', 'true'));
    document.body.style.overflow = 'hidden';

    const input = modal!.querySelector<HTMLInputElement>('input[type="search"], input[name="q"], input[type="text"]');
    if (input) {
      input.focus();
      input.select();
    }
  }

  function closeModal(): void {
    if (isDialogSupported) {
      if (modal!.open) {
        modal!.close();
      }
    } else {
      modal!.removeAttribute('open');
      modal!.classList.remove('is-open');
    }

    modal!.setAttribute('aria-hidden', 'true');
    toggleButtons.forEach((btn) => btn.setAttribute('aria-expanded', 'false'));

    const isDrawerActive = document.body.classList.contains('drawer-open');
    if (!isDrawerActive) {
      document.body.style.overflow = '';
    }

    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    }
  }

  toggleButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (isModalOpen()) {
        closeModal();
      } else {
        closeDrawerDirect();
        openModal();
      }
    });
  });

  closeButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal();
    });
  });

  modal.addEventListener('close', () => {
    modal.setAttribute('aria-hidden', 'true');
    toggleButtons.forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
    const isDrawerActive = document.body.classList.contains('drawer-open');
    if (!isDrawerActive) {
      document.body.style.overflow = '';
    }
  });

  modal.addEventListener('cancel', () => {
    closeModal();
  });

  modal.addEventListener('click', (e: MouseEvent) => {
    const container = modal.querySelector('.search-modal-container');
    if (container && !container.contains(e.target as Node)) {
      closeModal();
    } else if (e.target === modal) {
      closeModal();
    }
  });

  modal.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      trapFocus(modal, e);
    } else if (e.key === 'Escape' && !isDialogSupported) {
      e.preventDefault();
      closeModal();
    }
  });

  return { open: openModal, close: closeModal, isOpen: isModalOpen };
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
// Global Initialization
// ---------------------------------------------------------------------------

function init(): void {
  initReadingProgress();
  initMobileDrawer();
  initSearchModal();
  initShareCopy();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
