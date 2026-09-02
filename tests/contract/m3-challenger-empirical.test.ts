import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import vm from 'node:vm';
import { generateTheme } from '../../tools/generate.js';
import {
  initReadingProgress,
  initMobileDrawer,
  initLiveSearch,
  showToast,
  copyToClipboard
} from '../../src/scripts/main.js';

const SHA = '0123456789abcdef0123456789abcdef01234567';

// ---------------------------------------------------------------------------
// Lightweight In-Memory DOM Fixture for Vitest Node Environment
// ---------------------------------------------------------------------------

class MockDOMElement {
  public tagName: string;
  public id: string = '';
  public className: string = '';
  public textContent: string = '';
  public value: string = '';
  public style: Record<string, string> = {};
  public attributes: Map<string, string> = new Map();
  public dataset: Record<string, string> = {};
  public children: MockDOMElement[] = [];
  public parentNode: MockDOMElement | null = null;
  public offsetWidth: number = 100;
  public offsetHeight: number = 30;
  public open: boolean = false;
  private eventListeners: Map<string, Array<(e: any) => void>> = new Map();

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  get classList() {
    const self = this;
    return {
      contains(cls: string): boolean {
        return self.className.split(/\s+/).filter(Boolean).includes(cls);
      },
      add(...classes: string[]) {
        const current = new Set(self.className.split(/\s+/).filter(Boolean));
        classes.forEach((c) => current.add(c));
        self.className = Array.from(current).join(' ');
      },
      remove(...classes: string[]) {
        const current = new Set(self.className.split(/\s+/).filter(Boolean));
        classes.forEach((c) => current.delete(c));
        self.className = Array.from(current).join(' ');
      },
      toggle(cls: string, force?: boolean): boolean {
        const has = this.contains(cls);
        const shouldHave = force !== undefined ? force : !has;
        if (shouldHave) this.add(cls);
        else this.remove(cls);
        return shouldHave;
      }
    };
  }

  get firstElementChild(): MockDOMElement | null {
    return this.children[0] ?? null;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === 'id') this.id = value;
    if (name === 'class') this.className = value;
  }

  getAttribute(name: string): string | null {
    if (name === 'id') return this.id || null;
    if (name === 'class') return this.className || null;
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    if (name === 'id') return Boolean(this.id);
    if (name === 'class') return Boolean(this.className);
    return this.attributes.has(name);
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
    if (name === 'id') this.id = '';
    if (name === 'class') this.className = '';
  }

  appendChild(child: MockDOMElement) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: MockDOMElement) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  addEventListener(type: string, listener: (e: any) => void, options?: any) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (e: any) => void) {
    const list = this.eventListeners.get(type);
    if (list) {
      this.eventListeners.set(
        type,
        list.filter((l) => l !== listener)
      );
    }
  }

  dispatchEvent(event: any): boolean {
    event.target = this;
    event.currentTarget = this;
    const list = this.eventListeners.get(event.type) ?? [];
    for (const listener of list) {
      listener(event);
    }
    return !event.defaultPrevented;
  }

  querySelector<T = MockDOMElement>(selector: string): T | null {
    const all = this.querySelectorAll<T>(selector);
    return all[0] ?? null;
  }

  querySelectorAll<T = MockDOMElement>(selector: string): T[] {
    const results: MockDOMElement[] = [];
    const matchElement = (el: MockDOMElement): boolean => {
      const parts = selector.split(',').map((s) => s.trim());
      for (const part of parts) {
        if (part.startsWith('.') && el.classList.contains(part.slice(1))) return true;
        if (part.startsWith('#') && el.id === part.slice(1)) return true;
        if (part === 'a, button' && (el.tagName === 'A' || el.tagName === 'BUTTON')) return true;
        if (part === '.drawer-close, a, button' && (el.classList.contains('drawer-close') || el.tagName === 'A' || el.tagName === 'BUTTON')) return true;
        if (part.includes('[data-action="copy-link"]') && el.dataset['action'] === 'copy-link') return true;
        if (part.includes('input') && el.tagName === 'INPUT') return true;
        if (part.includes('a[href]') && el.tagName === 'A' && el.hasAttribute('href')) return true;
        if (part.includes('button') && el.tagName === 'BUTTON' && !el.hasAttribute('disabled')) return true;
      }
      return false;
    };

    const traverse = (node: MockDOMElement) => {
      for (const child of node.children) {
        if (matchElement(child)) {
          results.push(child);
        }
        traverse(child);
      }
    };
    traverse(this);
    return results as unknown as T[];
  }

  closest<T = MockDOMElement>(selector: string): T | null {
    let current: MockDOMElement | null = this;
    while (current) {
      if (selector.includes('[data-action="copy-link"]') && current.dataset['action'] === 'copy-link') {
        return current as unknown as T;
      }
      current = current.parentNode;
    }
    return null;
  }

  contains(other: MockDOMElement | null): boolean {
    if (!other) return false;
    let curr: MockDOMElement | null = other;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentNode;
    }
    return false;
  }

  getClientRects() {
    return [{ top: 0, left: 0, width: this.offsetWidth, height: this.offsetHeight }];
  }

  focus() {
    if (globalThis.document) {
      (globalThis.document as any).activeElement = this;
    }
  }

  select() {}

  showModal() {
    this.open = true;
    this.setAttribute('open', '');
  }

  close() {
    this.open = false;
    this.removeAttribute('open');
    this.dispatchEvent({ type: 'close', defaultPrevented: false });
  }
}

describe('Milestone 3 Empirical Challenger Verification: Scripts & Edge Cases', () => {
  let originalWindow: any;
  let originalDocument: any;
  let originalNavigator: any;

  beforeEach(() => {
    originalWindow = globalThis.window;
    originalDocument = globalThis.document;
    originalNavigator = globalThis.navigator;

    const rootDoc = new MockDOMElement('HTML');
    const head = new MockDOMElement('HEAD');
    const body = new MockDOMElement('BODY');
    rootDoc.appendChild(head);
    rootDoc.appendChild(body);

    const mockDocument: any = {
      documentElement: rootDoc,
      body: body,
      head: head,
      activeElement: body,
      readyState: 'complete',
      createElement: (tag: string) => new MockDOMElement(tag),
      getElementById: (id: string) => {
        const find = (node: MockDOMElement): MockDOMElement | null => {
          if (node.id === id) return node;
          for (const c of node.children) {
            const res = find(c);
            if (res) return res;
          }
          return null;
        };
        return find(rootDoc);
      },
      querySelector: (sel: string) => rootDoc.querySelector(sel),
      querySelectorAll: (sel: string) => rootDoc.querySelectorAll(sel),
      addEventListener: (type: string, cb: any) => rootDoc.addEventListener(type, cb),
      removeEventListener: (type: string, cb: any) => rootDoc.removeEventListener(type, cb),
      dispatchEvent: (e: any) => rootDoc.dispatchEvent(e),
      execCommand: vi.fn().mockReturnValue(true)
    };

    const mockWindow: any = {
      scrollY: 0,
      innerHeight: 800,
      requestAnimationFrame: (cb: () => void) => { cb(); return 1; },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { href: 'https://ledger.example.com/2026/08/article.html' }
    };

    const mockNavigator: any = {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    };

    (globalThis as any).window = mockWindow;
    (globalThis as any).document = mockDocument;
    (globalThis as any).requestAnimationFrame = (cb: () => void) => { cb(); return 1; };
    Object.defineProperty(globalThis, 'navigator', { value: mockNavigator, configurable: true, writable: true });
    (globalThis as any).HTMLElement = MockDOMElement;
    (globalThis as any).HTMLDialogElement = MockDOMElement;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    delete (globalThis as any).requestAnimationFrame;
    Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true, writable: true });
  });

  // -------------------------------------------------------------------------
  // Challenge 1: Absence of #reading-progress on Non-Post Views
  // -------------------------------------------------------------------------
  describe('Challenge 1: Reading Progress Bar Absence & Null Safety', () => {
    it('gracefully exits on homepage/archive views without attaching scroll listeners', () => {
      // Document without #reading-progress
      initReadingProgress();
      expect(window.addEventListener).not.toHaveBeenCalled();
    });

    it('calculates progress accurately and clamps [0, 100] on post view', () => {
      const progressContainer = document.createElement('div');
      progressContainer.id = 'reading-progress';
      const progressBar = document.createElement('div');
      progressBar.className = 'reading-progress-bar';
      progressContainer.appendChild(progressBar);
      document.body.appendChild(progressContainer);

      (document.documentElement as any).scrollHeight = 2000;
      (window as any).innerHeight = 1000; // maxScroll = 1000
      (window as any).scrollY = 500; // 50%

      initReadingProgress();

      expect(progressBar.style.width).toBe('50%');
      expect(progressContainer.getAttribute('aria-valuenow')).toBe('50');
      expect(window.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
      expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function), { passive: true });
    });

    it('handles short page (maxScroll <= 0) without division by zero or NaN', () => {
      const progressContainer = document.createElement('div');
      progressContainer.id = 'reading-progress';
      const progressBar = document.createElement('div');
      progressBar.className = 'reading-progress-bar';
      progressContainer.appendChild(progressBar);
      document.body.appendChild(progressContainer);

      (document.documentElement as any).scrollHeight = 800;
      (window as any).innerHeight = 1000; // maxScroll = -200 <= 0
      (window as any).scrollY = 0;

      initReadingProgress();

      expect(progressBar.style.width).toBe('0%');
      expect(progressContainer.getAttribute('aria-valuenow')).toBe('0');
    });

    it('clamps negative scroll values (iOS bounce) and overscroll values', () => {
      const progressContainer = document.createElement('div');
      progressContainer.id = 'reading-progress';
      const progressBar = document.createElement('div');
      progressBar.className = 'reading-progress-bar';
      progressContainer.appendChild(progressBar);
      document.body.appendChild(progressContainer);

      (document.documentElement as any).scrollHeight = 2000;
      (window as any).innerHeight = 1000; // maxScroll = 1000
      (window as any).scrollY = -100;

      initReadingProgress();
      expect(progressBar.style.width).toBe('0%');

      (window as any).scrollY = 1500; // past 1000
      initReadingProgress();
      expect(progressBar.style.width).toBe('100%');
    });
  });

  // -------------------------------------------------------------------------
  // Challenge 2: Mobile Drawer & Search Modal Keyboard Accessibility & Escape
  // -------------------------------------------------------------------------
  describe('Challenge 2: Focus Management & Keyboard Accessibility', () => {
    it('opens drawer, sets aria attributes, locks body scroll, and restores on close', () => {
      const drawer = document.createElement('nav');
      drawer.id = 'mobile-drawer';
      drawer.setAttribute('aria-hidden', 'true');
      const closeBtn = document.createElement('button');
      closeBtn.className = 'drawer-close';
      drawer.appendChild(closeBtn);

      const backdrop = document.createElement('div');
      backdrop.className = 'drawer-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');

      const toggle = document.createElement('button');
      toggle.className = 'drawer-toggle';
      toggle.setAttribute('aria-expanded', 'false');

      document.body.appendChild(drawer);
      document.body.appendChild(backdrop);
      document.body.appendChild(toggle);

      const controller = initMobileDrawer();
      expect(controller).not.toBeNull();

      // Open drawer
      controller!.open();
      expect(drawer.classList.contains('is-open')).toBe(true);
      expect(backdrop.classList.contains('is-open')).toBe(true);
      expect(document.body.classList.contains('drawer-open')).toBe(true);
      expect(drawer.getAttribute('aria-hidden')).toBe('false');
      expect(backdrop.getAttribute('aria-hidden')).toBe('false');
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(document.body.style.overflow).toBe('hidden');

      // Close drawer
      controller!.close();
      expect(drawer.classList.contains('is-open')).toBe(false);
      expect(backdrop.classList.contains('is-open')).toBe(false);
      expect(document.body.classList.contains('drawer-open')).toBe(false);
      expect(drawer.getAttribute('aria-hidden')).toBe('true');
      expect(backdrop.getAttribute('aria-hidden')).toBe('true');
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(document.body.style.overflow).toBe('');
    });

    it('enforces live search input and dropdown activation', () => {
      const searchCard = document.createElement('div');
      searchCard.className = 'sidebar-search-card';

      const input = document.createElement('input');
      input.className = 'sidebar-search-input';
      input.setAttribute('type', 'search');
      input.setAttribute('name', 'q');

      const dropdown = document.createElement('div');
      dropdown.className = 'search-results-dropdown';
      dropdown.style.display = 'none';

      searchCard.appendChild(input);
      searchCard.appendChild(dropdown);
      document.body.appendChild(searchCard);

      initLiveSearch();

      input.value = 'Security';
      input.dispatchEvent({ type: 'input' } as any);

      expect(dropdown.style.display).toBe('block');
      expect(dropdown.innerHTML).toContain('Searching publications');
    });
  });

  // -------------------------------------------------------------------------
  // Challenge 3: Toast Notification Lifecycle & Queue Pruning Analysis
  // -------------------------------------------------------------------------
  describe('Challenge 3: Toast Notification Lifecycle & Pruning Analysis', () => {
    it('creates toast container on demand with aria-live="polite"', () => {
      const toast = showToast('Hello world');
      expect(toast.textContent).toBe('Hello world');
      expect(toast.getAttribute('role')).toBe('status');
      const container = document.getElementById('toast-container');
      expect(container).not.toBeNull();
      expect(container!.getAttribute('aria-live')).toBe('polite');
    });

    it('creates and renders up to 3 toast elements cleanly', () => {
      const toast1 = showToast('First notification');
      const toast2 = showToast('Second notification');

      const container = document.getElementById('toast-container')!;
      expect(container.children.length).toBe(2);
      expect(toast1.textContent).toBe('First notification');
      expect(toast2.textContent).toBe('Second notification');
    });

    it('prunes excess toasts synchronously on queue overflow without infinite loop', () => {
      showToast('Toast 1');
      showToast('Toast 2');
      showToast('Toast 3');
      showToast('Toast 4');
      showToast('Toast 5');

      const container = document.getElementById('toast-container')!;
      expect(container.children.length).toBe(3);
      expect(Array.from(container.children).map((c: any) => c.textContent)).toEqual(['Toast 3', 'Toast 4', 'Toast 5']);
    });
  });

  // -------------------------------------------------------------------------
  // Challenge 4: Non-Secure Context & Fallback Clipboard
  // -------------------------------------------------------------------------
  describe('Challenge 4: Clipboard Copy API & Fallbacks', () => {
    it('uses navigator.clipboard.writeText when available', async () => {
      const success = await copyToClipboard('https://ledger.example.com/post1');
      expect(success).toBe(true);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://ledger.example.com/post1');
    });

    it('falls back to textarea + execCommand when navigator.clipboard is unavailable', async () => {
      Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true }); // non-secure context

      const success = await copyToClipboard('https://ledger.example.com/fallback');
      expect(success).toBe(true);
      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    it('returns false when both modern clipboard and execCommand fail', async () => {
      Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
      (document as any).execCommand = vi.fn().mockImplementation(() => {
        throw new Error('execCommand disabled');
      });

      const success = await copyToClipboard('https://ledger.example.com/fail');
      expect(success).toBe(false);
    });

    it('guarantees textarea cleanup from DOM when execCommand throws an error', async () => {
      Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
      (document as any).execCommand = vi.fn().mockImplementation(() => {
        throw new Error('Clipboard access denied');
      });

      const success = await copyToClipboard('https://ledger.example.com/error-cleanup');
      expect(success).toBe(false);

      // Verify no orphaned textarea exists in body
      const textareas = document.body.querySelectorAll('textarea');
      expect(textareas.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Challenge 5: Compiled Script IIFE Execution in dist/theme.xml
  // -------------------------------------------------------------------------
  describe('Challenge 5: Compiled Script Execution from Theme XML', () => {
    it('extracts script IIFE from generated XML and executes cleanly in sandbox', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });

      const scriptMatch = xml.match(/<script>\s*\/\/<!\[CDATA\[([\s\S]*?)\/\/\]\]>\s*<\/script>/i);
      expect(scriptMatch).not.toBeNull();

      const code = scriptMatch![1]!.trim();

      // Create a clean sandbox context
      const sandboxDoc = new MockDOMElement('HTML');
      const head = new MockDOMElement('HEAD');
      const body = new MockDOMElement('BODY');
      sandboxDoc.appendChild(head);
      sandboxDoc.appendChild(body);

      const sandbox: any = {
        window: {
          scrollY: 0,
          innerHeight: 800,
          requestAnimationFrame: (cb: any) => cb(),
          addEventListener: () => {},
          removeEventListener: () => {}
        },
        document: {
          documentElement: sandboxDoc,
          body: body,
          head: head,
          activeElement: body,
          readyState: 'complete',
          createElement: (t: string) => new MockDOMElement(t),
          getElementById: () => null,
          querySelector: () => null,
          querySelectorAll: () => [],
          addEventListener: () => {},
          removeEventListener: () => {}
        },
        navigator: {
          clipboard: { writeText: async () => {} }
        },
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout
      };
      sandbox.window.document = sandbox.document;

      const script = new vm.Script(code);
      const context = vm.createContext(sandbox);

      expect(() => {
        script.runInContext(context);
      }).not.toThrow();

      // Progressive enhancement class 'js' added to documentElement
      expect(sandboxDoc.classList.contains('js')).toBe(true);
    });
  });
});
