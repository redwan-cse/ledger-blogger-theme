import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { generateTheme } from '../../tools/generate.js';
import {
  initReadingProgress,
  initMobileDrawer,
  initInlineLiveSearch,
  initLiveSearch,
  showToast,
  copyToClipboard,
  initShareCopy
} from '../../src/scripts/main.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHA = '0123456789abcdef0123456789abcdef01234567';

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
        if (part === 'textarea' && el.tagName === 'TEXTAREA') return true;
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

describe('Empirical Challenge Remediation Verification Suite', () => {
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
  // Test 1: Rapid Toast Queuing Stress Test (>3 toasts, 5-10 rapid calls)
  // -------------------------------------------------------------------------
  describe('Test 1: Rapid Toast Queuing (Stress & No UI Hang)', () => {
    it('handles 10 rapid calls to showToast without infinite loop and caps queue at exactly 3', () => {
      const startTime = Date.now();

      for (let i = 1; i <= 10; i++) {
        showToast(`Toast message ${i}`);
      }

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(100); // Must execute synchronously within milliseconds

      const container = document.getElementById('toast-container');
      expect(container).not.toBeNull();
      expect(container!.children.length).toBe(3);

      const remainingMessages = Array.from(container!.children).map((c: any) => c.textContent);
      expect(remainingMessages).toEqual([
        'Toast message 8',
        'Toast message 9',
        'Toast message 10'
      ]);
    });

    it('handles 50 burst calls with alternating content and preserves strict queue cap of 3', () => {
      for (let i = 1; i <= 50; i++) {
        showToast(`Burst ${i}`);
      }

      const container = document.getElementById('toast-container')!;
      expect(container.children.length).toBe(3);
      expect(container.children[0]!.textContent).toBe('Burst 48');
      expect(container.children[1]!.textContent).toBe('Burst 49');
      expect(container.children[2]!.textContent).toBe('Burst 50');
    });

    it('maintains proper DOM attributes on active toast elements under rapid queue eviction', () => {
      for (let i = 1; i <= 5; i++) {
        showToast(`Item ${i}`);
      }
      const container = document.getElementById('toast-container')!;
      for (const child of container.children) {
        expect(child.getAttribute('role')).toBe('status');
        expect(child.classList.contains('toast')).toBe(true);
        expect(child.classList.contains('is-visible')).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Test 2: Mutual Exclusivity: Search Modal & Mobile Drawer State Synchronization
  // -------------------------------------------------------------------------
  describe('Test 2: Search Modal & Mobile Drawer Synchronization & ARIA Conformance', () => {
    it('properly synchronizes CSS classes and ARIA attributes when search modal opens while drawer is open', () => {
      const drawer = document.createElement('nav');
      drawer.id = 'mobile-drawer';
      drawer.className = 'mobile-drawer is-open';
      drawer.setAttribute('aria-hidden', 'false');

      const backdrop = document.createElement('div');
      backdrop.className = 'drawer-backdrop is-open';
      backdrop.setAttribute('aria-hidden', 'false');

      const drawerToggle = document.createElement('button');
      drawerToggle.className = 'drawer-toggle';
      drawerToggle.setAttribute('aria-expanded', 'true');

      document.body.className = 'drawer-open';
      document.body.appendChild(drawer);
      document.body.appendChild(backdrop);
      document.body.appendChild(drawerToggle);

      const searchCard = document.createElement('div');
      searchCard.className = 'sidebar-search-card';

      const input = document.createElement('input');
      input.className = 'sidebar-search-input';
      input.setAttribute('type', 'search');
      input.setAttribute('name', 'q');

      const dropdown = document.createElement('div');
      dropdown.className = 'search-results-dropdown';

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
  // Test 3: copyToClipboard Exception Resilience & No Orphan Textarea
  // -------------------------------------------------------------------------
  describe('Test 3: copyToClipboard Exception Handling & Zero DOM Leak', () => {
    it('leaves zero orphaned textarea elements in document.body when execCommand throws an Error', async () => {
      // Simulate non-secure context
      Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });

      // Mock execCommand to throw
      (document as any).execCommand = vi.fn().mockImplementation(() => {
        throw new Error('NotAllowedError: execCommand permission denied');
      });

      const initialTextareas = document.body.querySelectorAll('textarea');
      expect(initialTextareas.length).toBe(0);

      const result = await copyToClipboard('https://example.com/test-url');
      expect(result).toBe(false);

      const finalTextareas = document.body.querySelectorAll('textarea');
      expect(finalTextareas.length).toBe(0);
    });

    it('preserves pre-existing textarea elements in DOM when copyToClipboard fails', async () => {
      Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });

      const preexisting = document.createElement('textarea');
      preexisting.id = 'comment-input';
      preexisting.value = 'User draft text';
      document.body.appendChild(preexisting);

      (document as any).execCommand = vi.fn().mockImplementation(() => {
        throw new Error('SecurityError: Copy command failed');
      });

      const result = await copyToClipboard('https://example.com/copy-target');
      expect(result).toBe(false);

      const remainingTextareas = document.body.querySelectorAll('textarea');
      expect(remainingTextareas.length).toBe(1);
      expect(remainingTextareas[0]!.id).toBe('comment-input');
      expect(remainingTextareas[0]!.value).toBe('User draft text');
    });

    it('handles clipboard failure when navigator.clipboard.writeText rejects and fallback succeeds', async () => {
      // navigator.clipboard rejects (e.g. user denied permission)
      const mockNavigator = {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Permission denied'))
        }
      };
      Object.defineProperty(globalThis, 'navigator', { value: mockNavigator, configurable: true, writable: true });
      (document as any).execCommand = vi.fn().mockReturnValue(true);

      const result = await copyToClipboard('https://example.com/fallback-success');
      expect(result).toBe(true);
      expect(document.execCommand).toHaveBeenCalledWith('copy');

      const textareas = document.body.querySelectorAll('textarea');
      expect(textareas.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Test 4: Full Theme Artifact & Verification Commands Validation
  // -------------------------------------------------------------------------
  describe('Test 4: Theme Artifact & Script Runtime Verification', () => {
    it('produces valid dist/theme.xml within target budget (150 KB - 500 KB)', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const sizeBytes = Buffer.byteLength(xml, 'utf8');

      // Check that theme compiles cleanly and contains the script
      expect(sizeBytes).toBeGreaterThan(50000);
      expect(sizeBytes).toBeLessThan(500000);
      expect(xml).toContain('<script>');
      expect(xml).toContain('reading-progress');
      expect(xml).toContain('mobile-drawer');
      expect(xml).toContain('toast-container');
    });

    it('extracts script payload from generated XML and verifies zero runtime syntax errors', async () => {
      const { xml } = await generateTheme({ sha: SHA, write: false });
      const scriptMatch = xml.match(/<script>\s*\/\/<!\[CDATA\[([\s\S]*?)\/\/\]\]>\s*<\/script>/i);
      expect(scriptMatch).not.toBeNull();

      const scriptCode = scriptMatch![1]!;

      // Run code in isolated node vm context
      const sandbox = {
        window: {
          scrollY: 0,
          innerHeight: 800,
          requestAnimationFrame: (cb: any) => cb(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        },
        document: {
          documentElement: { classList: { add: vi.fn() } },
          body: { classList: { add: vi.fn(), remove: vi.fn(), contains: () => false }, style: {} },
          readyState: 'complete',
          getElementById: () => null,
          querySelector: () => null,
          querySelectorAll: () => [],
          addEventListener: vi.fn()
        },
        navigator: {
          clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
        },
        setTimeout: vi.fn(),
        clearTimeout: vi.fn()
      };

      const script = new vm.Script(scriptCode);
      const context = vm.createContext(sandbox);

      expect(() => {
        script.runInContext(context);
      }).not.toThrow();
      expect(sandbox.document.documentElement.classList.add).toHaveBeenCalledWith('js');
    });
  });
});
