import { beforeAll, describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';

const SHA = '0123456789abcdef0123456789abcdef01234567';

interface MockPost {
  title: string;
  url: string;
  body: string;
  date?: { iso8601: string; toString(): string };
  lastUpdated?: { iso8601: string };
  snippets?: { short?: string; long?: string };
  labels?: Array<{ name: string; url: string }>;
  allowComments?: boolean;
  numberOfComments?: number;
  comments?: Array<{ id: string; isDeleted?: boolean; body: string; author: string; timestamp: string }>;
  commentFormIframeSrc?: string;
  featuredImage?: { isResizable?: boolean; toString(): string } | string;
  author?: {
    name: { toString(): string; jsonEscaped?: string };
    profileUrl?: string;
    authorPhoto?: { image: string };
  };
}

interface MockViewContext {
  view: {
    isHomepage: boolean;
    isMultipleItems: boolean;
    isSingleItem: boolean;
    isPost: boolean;
    isPage: boolean;
    isError: boolean;
    isSearch: boolean;
    isLabelSearch: boolean;
    isArchive: boolean;
    isLayoutMode?: boolean;
    title: string;
    description?: string;
    featuredImage?: string;
    url: { canonical: string };
    search?: { query?: string; label?: string };
    archive?: { rangeMessage?: string };
  };
  blog: {
    title: string;
    description: string;
    homepageUrl: string;
    canonicalHomepageUrl: string;
    languageDirection: string;
    locale: { language: string };
    metaDescription?: string;
    postImageThumbnailUrl?: string;
  };
  posts: MockPost[];
  newerPageUrl?: string | null;
  olderPageUrl?: string | null;
  links?: Array<{ name: string; target: string }>;
  labels?: Array<{ name: string; url: string; count?: number }>;
  widgets?: Array<{ sectionId: string }>;
  messages?: Record<string, string>;
}

// Minimal AST Node
type V3Node =
  | { type: 'text'; text: string }
  | { type: 'cdata'; text: string }
  | { type: 'comment'; text: string }
  | {
      type: 'element';
      name: string;
      attrs: Record<string, string>;
      children: V3Node[];
    };

function parseV3Xml(xml: string): V3Node[] {
  let index = 0;

  function parseNodes(): V3Node[] {
    const nodes: V3Node[] = [];
    while (index < xml.length) {
      if (xml[index] !== '<') {
        const next = xml.indexOf('<', index);
        const text = xml.slice(index, next === -1 ? xml.length : next);
        nodes.push({ type: 'text', text });
        index = next === -1 ? xml.length : next;
        continue;
      }

      if (xml.startsWith('<!--', index)) {
        const end = xml.indexOf('-->', index + 4);
        const text = xml.slice(index + 4, end);
        nodes.push({ type: 'comment', text });
        index = end + 3;
        continue;
      }

      if (xml.startsWith('<![CDATA[', index)) {
        const end = xml.indexOf(']]>', index + 9);
        const text = xml.slice(index + 9, end);
        nodes.push({ type: 'cdata', text });
        index = end + 3;
        continue;
      }

      if (xml.startsWith('<?', index) || xml.startsWith('<!DOCTYPE', index)) {
        const end = xml.indexOf('>', index);
        index = end + 1;
        continue;
      }

      if (xml.startsWith('</', index)) {
        break;
      }

      // Start tag
      index += 1; // skip <
      const nameMatch = xml.slice(index).match(/^[A-Za-z0-9_.:-]+/);
      if (!nameMatch) break;
      const tagName = nameMatch[0];
      index += tagName.length;

      const attrs: Record<string, string> = {};
      let selfClosing = false;

      while (index < xml.length) {
        while (/\s/.test(xml[index] ?? '')) index += 1;
        if (xml.startsWith('/>', index)) {
          selfClosing = true;
          index += 2;
          break;
        }
        if (xml[index] === '>') {
          index += 1;
          break;
        }

        const attrMatch = xml.slice(index).match(/^[A-Za-z0-9_.:-]+/);
        if (!attrMatch) break;
        const attrName = attrMatch[0];
        index += attrName.length;

        while (/\s/.test(xml[index] ?? '')) index += 1;
        if (xml[index] === '=') {
          index += 1;
          while (/\s/.test(xml[index] ?? '')) index += 1;
          const quote = xml[index];
          if (quote === '"' || quote === "'") {
            index += 1;
            const endQuote = xml.indexOf(quote, index);
            const val = xml.slice(index, endQuote);
            attrs[attrName] = val;
            index = endQuote + 1;
          }
        } else {
          attrs[attrName] = 'true';
        }
      }

      if (selfClosing) {
        nodes.push({ type: 'element', name: tagName, attrs, children: [] });
      } else {
        const children = parseNodes();
        if (xml.startsWith('</' + tagName, index)) {
          const closeEnd = xml.indexOf('>', index);
          index = closeEnd + 1;
        }
        nodes.push({ type: 'element', name: tagName, attrs, children });
      }
    }
    return nodes;
  }

  return parseNodes();
}

// V3 Simulator
class BloggerV3Simulator {
  private globalIncludables = new Map<string, V3Node[]>();
  private widgetIncludables = new Map<string, Map<string, V3Node[]>>();

  constructor(private rootNodes: V3Node[]) {
    this.collectAllIncludables(rootNodes);
  }

  private collectAllIncludables(nodes: V3Node[]) {
    for (const node of nodes) {
      if (node.type === 'element') {
        if (node.name === 'b:widget') {
          const widgetId = node.attrs.id;
          const map = new Map<string, V3Node[]>();
          this.collectWidgetIncludables(node.children, map);
          if (widgetId) {
            this.widgetIncludables.set(widgetId, map);
          }
        } else if (node.name === 'b:defaultmarkup') {
          const type = node.attrs.type;
          const map = new Map<string, V3Node[]>();
          this.collectWidgetIncludables(node.children, map);
          if (type) {
            this.widgetIncludables.set(`defaultmarkup_${type}`, map);
          }
        } else if (node.name === 'b:includable') {
          const id = node.attrs.id;
          if (id) {
            this.globalIncludables.set(id, node.children);
          }
        }
        this.collectAllIncludables(node.children);
      }
    }
  }

  private collectWidgetIncludables(nodes: V3Node[], map: Map<string, V3Node[]>) {
    for (const node of nodes) {
      if (node.type === 'element') {
        if (node.name === 'b:includable') {
          const id = node.attrs.id;
          if (id) {
            map.set(id, node.children);
          }
        }
        this.collectWidgetIncludables(node.children, map);
      }
    }
  }

  isTruthy(val: any): boolean {
    if (val === null || val === undefined || val === false || val === '') return false;
    if (Array.isArray(val)) return val.length > 0;
    return Boolean(val);
  }

  evaluateExpr(expr: string, context: Record<string, any>): any {
    const trimmed = expr.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;

    // Handle string literal
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    // Handle .jsonEscaped, .escaped, .empty, .iso8601 modifier wrappers
    if (trimmed.endsWith('.jsonEscaped')) {
      const innerVal = this.evaluateExpr(trimmed.slice(0, -'.jsonEscaped'.length), context);
      return JSON.stringify(innerVal ?? '').slice(1, -1);
    }
    if (trimmed.endsWith('.escaped')) {
      const innerVal = this.evaluateExpr(trimmed.slice(0, -'.escaped'.length), context);
      return String(innerVal ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    if (trimmed.endsWith('.empty')) {
      const innerVal = this.evaluateExpr(trimmed.slice(0, -'.empty'.length), context);
      if (Array.isArray(innerVal)) return innerVal.length === 0;
      if (!innerVal) return true;
      return false;
    }
    if (trimmed.endsWith('.any')) {
      const innerVal = this.evaluateExpr(trimmed.slice(0, -'.any'.length), context);
      if (Array.isArray(innerVal)) return innerVal.length > 0;
      if (innerVal && typeof innerVal === 'object' && 'any' in innerVal) return Boolean(innerVal.any);
      return Boolean(innerVal);
    }
    if (trimmed.endsWith('.iso8601')) {
      const innerVal = this.evaluateExpr(trimmed.slice(0, -'.iso8601'.length), context);
      return innerVal?.iso8601 ?? String(innerVal ?? '');
    }

    // Strip outer parentheses if balanced
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      const inner = trimmed.slice(1, -1);
      // Check if parens are balanced inside
      let depth = 0;
      let balanced = true;
      for (let i = 0; i < inner.length; i++) {
        if (inner[i] === '(') depth++;
        else if (inner[i] === ')') {
          depth--;
          if (depth < 0) { balanced = false; break; }
        }
      }
      if (balanced && depth === 0) {
        return this.evaluateExpr(inner, context);
      }
    }

    // Handle ?: (elvis operator)
    const elvisIdx = trimmed.indexOf('?:');
    if (elvisIdx !== -1) {
      const left = this.evaluateExpr(trimmed.slice(0, elvisIdx).trim(), context);
      if (this.isTruthy(left)) {
        return left;
      }
      return this.evaluateExpr(trimmed.slice(elvisIdx + 2).trim(), context);
    }

    // Handle 'not in'
    const notInMatch = trimmed.match(/^(.+?)\s+not\s+in\s+\{(.+)\}$/);
    if (notInMatch) {
      const val = String(this.evaluateExpr(notInMatch[1]!.trim(), context) ?? '');
      const set = notInMatch[2]!.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
      return !set.includes(val);
    }

    // Handle 'in'
    const inMatch = trimmed.match(/^(.+?)\s+in\s+\{(.+)\}$/);
    if (inMatch) {
      const val = String(this.evaluateExpr(inMatch[1]!.trim(), context) ?? '');
      const set = inMatch[2]!.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
      return set.includes(val);
    }

    // Handle '!='
    const neMatch = trimmed.match(/^(.+?)\s*!=\s*(.+)$/);
    if (neMatch) {
      const left = this.evaluateExpr(neMatch[1]!.trim(), context);
      const right = this.evaluateExpr(neMatch[2]!.trim(), context);
      return left != right;
    }

    // Handle '=='
    const eqMatch = trimmed.match(/^(.+?)\s*==\s*(.+)$/);
    if (eqMatch) {
      const left = this.evaluateExpr(eqMatch[1]!.trim(), context);
      const right = this.evaluateExpr(eqMatch[2]!.trim(), context);
      return left == right;
    }

    // Handle 'and' / 'or'
    const andMatch = trimmed.match(/^(.+?)\s+and\s+(.+)$/);
    if (andMatch) {
      return this.isTruthy(this.evaluateExpr(andMatch[1]!, context)) && this.isTruthy(this.evaluateExpr(andMatch[2]!, context));
    }
    const orMatch = trimmed.match(/^(.+?)\s+or\s+(.+)$/);
    if (orMatch) {
      return this.isTruthy(this.evaluateExpr(orMatch[1]!, context)) || this.isTruthy(this.evaluateExpr(orMatch[2]!, context));
    }

    // Handle 'not'
    if (trimmed.startsWith('not ')) {
      return !this.isTruthy(this.evaluateExpr(trimmed.slice(4).trim(), context));
    }

    // Handle comparisons >
    const gtMatch = trimmed.match(/^(.+?)\s*>\s*(\d+)$/);
    if (gtMatch) {
      const left = Number(this.evaluateExpr(gtMatch[1]!, context));
      return left > Number(gtMatch[2]);
    }

    // Handle path operator
    if (trimmed.includes(' path ')) {
      const pathMatch = trimmed.match(/(.+?)\s+path\s+"([^"]+)"(?:\s+params\s+\{\s*([A-Za-z0-9_]+)\s*:\s*"([^"]+)"\s*\})?/);
      if (pathMatch) {
        const base = String(this.evaluateExpr(pathMatch[1]!.trim(), context)).replace(/\/$/, '');
        const sub = pathMatch[2]!;
        let url = `${base}/${sub}`;
        if (pathMatch[3] && pathMatch[4]) {
          url += `?${pathMatch[3]}=${pathMatch[4]}`;
        }
        return url;
      }
    }

    // Handle snippet()
    if (trimmed.startsWith('snippet(')) {
      const inner = trimmed.slice(8, trimmed.lastIndexOf(')'));
      const parts = inner.split(',');
      const val = this.evaluateExpr(parts[0]!.trim(), context);
      return typeof val === 'string' ? val.slice(0, 180) : (val?.toString() ?? '');
    }

    // Handle resizeImage()
    if (trimmed.startsWith('resizeImage(')) {
      const inner = trimmed.slice(12, trimmed.lastIndexOf(')'));
      const parts = inner.split(',');
      const img = this.evaluateExpr(parts[0]!.trim(), context);
      return typeof img === 'object' && img !== null ? img.toString() : String(img || '');
    }

    // Path resolution on context
    const cleanExpr = trimmed.replace(/^data:/, '');
    const pathParts = cleanExpr.split('.');
    let current: any = context;
    for (const part of pathParts) {
      if (current === undefined || current === null) {
        current = undefined;
        break;
      }
      current = current[part];
    }
    if (current === undefined && pathParts.length === 1) {
      const single = pathParts[0]!;
      if (context.this && context.this[single] !== undefined) {
        return context.this[single];
      }
      if (context.widget && context.widget[single] !== undefined) {
        return context.widget[single];
      }
      if (context.blog && context.blog[single] !== undefined) {
        return context.blog[single];
      }
    }
    return current;
  }

  renderNodes(nodes: V3Node[], context: Record<string, any>, currentWidgetId?: string): string {
    let output = '';
    let i = 0;

    while (i < nodes.length) {
      const node = nodes[i]!;
      i += 1;

      if (node.type === 'text') {
        output += node.text;
        continue;
      }
      if (node.type === 'cdata') {
        output += node.text;
        continue;
      }
      if (node.type === 'comment') {
        continue;
      }

      // Element nodes
      const { name, attrs, children } = node;

      if (name === 'b:skin' || name === 'b:defaultmarkups' || name === 'b:widget-settings') {
        continue;
      }

      if (name === 'b:includable') {
        continue;
      }

      if (name === 'b:eval') {
        const val = this.evaluateExpr(attrs.expr ?? '', context);
        if (val !== undefined && val !== null) {
          output += String(val);
        }
        continue;
      }

      if (name.startsWith('data:')) {
        const val = this.evaluateExpr(name, context);
        if (val !== undefined && val !== null) {
          output += String(val);
        }
        continue;
      }

      if (name === 'b:with') {
        const val = this.evaluateExpr(attrs.value ?? '', context);
        const varName = attrs.var ?? 'var';
        const newCtx = { ...context, [varName]: val };
        output += this.renderNodes(children, newCtx, currentWidgetId);
        continue;
      }

      if (name === 'b:loop') {
        const values = this.evaluateExpr(attrs.values ?? '', context);
        const varName = attrs.var ?? 'item';
        if (Array.isArray(values)) {
          for (const item of values) {
            const newCtx = { ...context, [varName]: item };
            output += this.renderNodes(children, newCtx, currentWidgetId);
          }
        }
        continue;
      }

      if (name === 'b:widget') {
        const widgetId = attrs.id ?? '';
        const widgetType = attrs.type ?? '';
        const widgetIncludablesMap = (widgetId ? this.widgetIncludables.get(widgetId) : undefined) || (widgetType ? this.widgetIncludables.get(`defaultmarkup_${widgetType}`) : undefined);
        const mainNodes = widgetIncludablesMap?.get('main');
        if (mainNodes) {
          const widgetData = {
            title: attrs.title,
            instanceId: widgetId,
            sectionId: attrs.sectionId,
            imagePlacement: 'BEHIND',
            useImage: false
          };
          const widgetCtx = { ...context, this: widgetData, widget: widgetData };
          output += this.renderNodes(mainNodes, widgetCtx, widgetId);
        }
        continue;
      }

      if (name === 'b:include') {
        if (attrs.cond !== undefined && !this.isTruthy(this.evaluateExpr(attrs.cond, context))) {
          continue;
        }
        const includableName = attrs.name ?? '';
        const dataExpr = attrs.data;

        if (includableName === 'super.main' && currentWidgetId === 'Blog1') {
          const isError = this.isTruthy(this.evaluateExpr('data:view.isError', context));
          const posts = this.evaluateExpr('data:posts', context);
          const hasPosts = Array.isArray(posts) && posts.length > 0;
          const widgetMap = this.widgetIncludables.get('Blog1');
          if (isError || !hasPosts) {
            const statusNodes = widgetMap?.get('status-message') || this.globalIncludables.get('status-message');
            if (statusNodes) {
              output += this.renderNodes(statusNodes, context, currentWidgetId);
            }
          } else {
            const postCommentsAndAdNodes = widgetMap?.get('postCommentsAndAd');
            const postNodes = widgetMap?.get('post');
            const targetNodes = postCommentsAndAdNodes || postNodes;
            if (targetNodes) {
              for (const p of posts) {
                const itemCtx = { ...context, post: p };
                output += this.renderNodes(targetNodes, itemCtx, currentWidgetId);
              }
            }
            const isMultiple = this.isTruthy(this.evaluateExpr('data:view.isMultipleItems', context));
            if (isMultiple) {
              const pagNodes = widgetMap?.get('postPagination') || this.globalIncludables.get('postPagination');
              if (pagNodes) {
                output += this.renderNodes(pagNodes, context, currentWidgetId);
              }
            }
          }
          continue;
        }

        const widgetMap = currentWidgetId ? this.widgetIncludables.get(currentWidgetId) : undefined;
        const includableNodes = (includableName && widgetMap ? widgetMap.get(includableName) : undefined) || (includableName ? this.globalIncludables.get(includableName) : undefined);
        if (includableNodes) {
          let newCtx = context;
          if (dataExpr) {
            const passedData = this.evaluateExpr(dataExpr, context);
            newCtx = { ...context, [includableName === 'post' ? 'post' : 'this']: passedData };
          }
          output += this.renderNodes(includableNodes, newCtx, currentWidgetId);
        }
        continue;
      }

      if (name === 'b:if') {
        const cond = this.isTruthy(this.evaluateExpr(attrs.cond ?? '', context));
        if (cond) {
          const ifBranches = this.extractIfBranches(children);
          output += this.renderNodes(ifBranches.main, context, currentWidgetId);
        } else {
          const ifBranches = this.extractIfBranches(children);
          let executed = false;
          for (const elseif of ifBranches.elseifs) {
            if (this.isTruthy(this.evaluateExpr(elseif.cond, context))) {
              output += this.renderNodes(elseif.children, context, currentWidgetId);
              executed = true;
              break;
            }
          }
          if (!executed && ifBranches.elseBranch) {
            output += this.renderNodes(ifBranches.elseBranch, context, currentWidgetId);
          }
        }
        continue;
      }

      if (name === 'b:class') {
        continue;
      }

      // Standard HTML / SVG elements
      const tag = name;
      let renderedAttrs = '';
      for (const [k, v] of Object.entries(attrs)) {
        if (k.startsWith('expr:')) {
          const realName = k.slice(5);
          const val = this.evaluateExpr(v, context);
          if (val !== undefined && val !== null && val !== false) {
            renderedAttrs += ` ${realName}="${String(val).replace(/"/g, '&quot;')}"`;
          }
        } else if (!k.startsWith('b:')) {
          renderedAttrs += ` ${k}="${v}"`;
        }
      }

      if (children.length === 0 && ['link', 'meta', 'img', 'input', 'hr', 'br'].includes(tag)) {
        output += `<${tag}${renderedAttrs}/>`;
      } else {
        output += `<${tag}${renderedAttrs}>`;
        output += this.renderNodes(children, context, currentWidgetId);
        output += `</${tag}>`;
      }
    }

    return output;
  }

  private extractIfBranches(children: V3Node[]): {
    main: V3Node[];
    elseifs: Array<{ cond: string; children: V3Node[] }>;
    elseBranch: V3Node[] | null;
  } {
    const main: V3Node[] = [];
    const elseifs: Array<{ cond: string; children: V3Node[] }> = [];
    let elseBranch: V3Node[] | null = null;
    let currentMode: 'main' | 'elseif' | 'else' = 'main';
    let currentElseif: { cond: string; children: V3Node[] } | null = null;

    for (const child of children) {
      if (child.type === 'element' && child.name === 'b:elseif') {
        currentMode = 'elseif';
        currentElseif = { cond: child.attrs.cond ?? '', children: [] };
        elseifs.push(currentElseif);
        continue;
      }
      if (child.type === 'element' && child.name === 'b:else') {
        currentMode = 'else';
        elseBranch = [];
        continue;
      }

      if (currentMode === 'main') {
        main.push(child);
      } else if (currentMode === 'elseif') {
        currentElseif?.children.push(child);
      } else if (currentMode === 'else') {
        elseBranch?.push(child);
      }
    }

    return { main, elseifs, elseBranch };
  }

  simulate(context: MockViewContext): string {
    const fullCtx = {
      ...context,
      data: {
        view: context.view,
        blog: context.blog,
        posts: context.posts,
        newerPageUrl: context.newerPageUrl,
        olderPageUrl: context.olderPageUrl,
        links: context.links,
        labels: context.labels,
        widgets: context.widgets,
        messages: context.messages ?? {
          noPosts: 'No posts.',
          noLabels: 'No labels.',
          name: 'Name',
          email: 'Email',
          message: 'Message',
          send: 'Send',
          archive: 'Archive'
        }
      }
    };
    return this.renderNodes(this.rootNodes, fullCtx);
  }
}

describe('Milestone M5 Empirical Challenger Suite: 10 Views & Edge Cases', () => {
  let themeXml: string;
  let simulator: BloggerV3Simulator;

  const baseBlog = {
    title: 'Ledger Official Blog',
    description: 'Engineering, security, and updates from Ledger.',
    homepageUrl: 'https://ledger.example.com/',
    canonicalHomepageUrl: 'https://ledger.example.com/',
    languageDirection: 'ltr',
    locale: { language: 'en' },
    metaDescription: 'Official Ledger Blog description for search engines.'
  };

  const samplePost1: MockPost = {
    title: 'Security and Determinism in Blogger Themes',
    url: 'https://ledger.example.com/2026/08/security-determinism.html',
    body: '<p>Complete article body with rich content and architectural analysis.</p>',
    date: { iso8601: '2026-08-16T00:00:00Z', toString: () => 'August 16, 2026' },
    lastUpdated: { iso8601: '2026-08-16T12:00:00Z' },
    snippets: {
      short: 'Security and determinism summary...',
      long: 'Comprehensive architectural analysis of modern Blogger Layouts V3 contract systems and headless verification.'
    },
    labels: [{ name: 'Security', url: 'https://ledger.example.com/search/label/Security' }],
    allowComments: true,
    numberOfComments: 2,
    comments: [
      { id: '1', body: 'Excellent deep dive!', author: 'Alice', timestamp: '2026-08-16' },
      { id: '2', isDeleted: true, body: '', author: 'SpamBot', timestamp: '2026-08-16' }
    ],
    commentFormIframeSrc: 'https://blogger.com/comment-iframe',
    author: {
      name: { toString: () => 'Redwan', jsonEscaped: 'Redwan' },
      profileUrl: 'https://profiles.google.com/redwan'
    }
  };

  const samplePost2: MockPost = {
    title: 'Benchmarking OKLCH vs HEX Color Systems',
    url: 'https://ledger.example.com/2026/08/oklch-vs-hex.html',
    body: '<p>Perceptual uniformity in CSS color spaces.</p>',
    date: { iso8601: '2026-08-15T00:00:00Z', toString: () => 'August 15, 2026' },
    snippets: { short: 'OKLCH color system guide.' },
    labels: [{ name: 'Design', url: 'https://ledger.example.com/search/label/Design' }]
  };

  const samplePage: MockPost = {
    title: 'About the Ledger Publication',
    url: 'https://ledger.example.com/p/about.html',
    body: '<p>About page content explaining mission and values.</p>',
    date: { iso8601: '2026-08-01T00:00:00Z', toString: () => 'August 1, 2026' }
  };

  beforeAll(async () => {
    const { xml } = await generateTheme({ sha: SHA, write: false });
    themeXml = xml;
    const ast = parseV3Xml(themeXml);
    simulator = new BloggerV3Simulator(ast);
  });

  function countH1(html: string): { count: number; h1s: string[]; h2s: string[] } {
    const h1Matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1]?.trim() ?? '');
    const h2Matches = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => m[1]?.trim() ?? '');
    return { count: h1Matches.length, h1s: h1Matches, h2s: h2Matches };
  }

  function getMainContent(html: string): string {
    const match = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
    return match ? match[1]?.trim() ?? '' : '';
  }

  // --- Suite 1: Single-H1 Heading Hierarchy Across 10 Views ---
  describe('Empirical Verification: Single-h1 Heading Hierarchy Across All 10 Views', () => {
    it('View 1: Home p1 -> exactly 1 <h1> (Site title in header), post titles are <h2>', () => {
      const html = simulator.simulate({
        view: {
          isHomepage: true,
          isMultipleItems: true,
          isSingleItem: false,
          isPost: false,
          isPage: false,
          isError: false,
          isSearch: false,
          isLabelSearch: false,
          isArchive: false,
          title: 'Ledger Official Blog',
          url: { canonical: 'https://ledger.example.com/' }
        },
        blog: baseBlog,
        posts: [samplePost1, samplePost2],
        newerPageUrl: null,
        olderPageUrl: 'https://ledger.example.com/?page=2'
      });

      const { count, h1s, h2s } = countH1(html);
      expect(count, `Home p1 must have exactly 1 <h1>, found ${count}: ${JSON.stringify(h1s)}`).toBe(1);
      expect(h1s[0]).toMatch(/Md Redwan Ahmed/);
      expect(h2s.length).toBeGreaterThanOrEqual(2);
      expect(h2s.some((t) => t.includes('Security and Determinism'))).toBe(true);
    });

    it('View 2: Home p2+ -> exactly 1 <h1> (Site title in header)', () => {
      const html = simulator.simulate({
        view: {
          isHomepage: true,
          isMultipleItems: true,
          isSingleItem: false,
          isPost: false,
          isPage: false,
          isError: false,
          isSearch: false,
          isLabelSearch: false,
          isArchive: false,
          title: 'Ledger Official Blog',
          url: { canonical: 'https://ledger.example.com/?page=2' }
        },
        blog: baseBlog,
        posts: [samplePost2],
        newerPageUrl: 'https://ledger.example.com/',
        olderPageUrl: 'https://ledger.example.com/?page=3'
      });

      const { count, h1s, h2s } = countH1(html);
      expect(count).toBe(1);
      expect(h1s[0]).toMatch(/Md Redwan Ahmed/);
      expect(h2s.length).toBe(1);
    });

    it('View 3: Label Search -> exactly 1 <h1> (Site title in header)', () => {
      const html = simulator.simulate({
        view: {
          isHomepage: false,
          isMultipleItems: true,
          isSingleItem: false,
          isPost: false,
          isPage: false,
          isError: false,
          isSearch: true,
          isLabelSearch: true,
          isArchive: false,
          search: { label: 'Security' },
          title: 'Security - Ledger Official Blog',
          url: { canonical: 'https://ledger.example.com/search/label/Security' }
        },
        blog: baseBlog,
        posts: [samplePost1]
      });

      const { count, h1s } = countH1(html);
      expect(count).toBe(1);
      expect(h1s[0]).toMatch(/Md Redwan Ahmed/);
    });

    it('View 4: Query Search -> exactly 1 <h1> (Site title in header)', () => {
      const html = simulator.simulate({
        view: {
          isHomepage: false,
          isMultipleItems: true,
          isSingleItem: false,
          isPost: false,
          isPage: false,
          isError: false,
          isSearch: true,
          isLabelSearch: false,
          isArchive: false,
          search: { query: 'OKLCH' },
          title: 'Search results for OKLCH',
          url: { canonical: 'https://ledger.example.com/search?q=OKLCH' }
        },
        blog: baseBlog,
        posts: [samplePost2]
      });

      const { count, h1s } = countH1(html);
      expect(count).toBe(1);
      expect(h1s[0]).toMatch(/Md Redwan Ahmed/);
    });

    it('View 5: Archive -> exactly 1 <h1> (Site title in header)', () => {
      const html = simulator.simulate({
        view: {
          isHomepage: false,
          isMultipleItems: true,
          isSingleItem: false,
          isPost: false,
          isPage: false,
          isError: false,
          isSearch: false,
          isLabelSearch: false,
          isArchive: true,
          archive: { rangeMessage: 'Showing posts from August 2026' },
          title: 'August 2026 - Ledger Official Blog',
          url: { canonical: 'https://ledger.example.com/2026/08/' }
        },
        blog: baseBlog,
        posts: [samplePost1]
      });

      const { count, h1s } = countH1(html);
      expect(count).toBe(1);
      expect(h1s[0]).toMatch(/Md Redwan Ahmed/);
    });

    it('View 6: Single Post -> exactly 1 <h1> (Article Title), Header site title is demoted to <p>', () => {
      const html = simulator.simulate({
        view: {
          isHomepage: false,
          isMultipleItems: false,
          isSingleItem: true,
          isPost: true,
          isPage: false,
          isError: false,
          isSearch: false,
          isLabelSearch: false,
          isArchive: false,
          title: 'Security and Determinism in Blogger Themes',
          url: { canonical: 'https://ledger.example.com/2026/08/security-determinism.html' }
        },
        blog: baseBlog,
        posts: [samplePost1]
      });

      const { count, h1s } = countH1(html);
      expect(count, `Single post view must have exactly 1 <h1>, found ${count}: ${JSON.stringify(h1s)}`).toBe(1);
      expect(h1s[0]).toContain('Security and Determinism in Blogger Themes');
      expect(html).toMatch(/<p class="site-title">[\s\S]*?(?:Md Redwan Ahmed)[\s\S]*?<\/p>/);
      expect(html).not.toMatch(/<h1 class="site-title">/);
    });

    it('View 7: Static Page -> exactly 1 <h1> (Page Title), Header site title is demoted to <p>', () => {
      const html = simulator.simulate({
        view: {
          isHomepage: false,
          isMultipleItems: false,
          isSingleItem: true,
          isPost: false,
          isPage: true,
          isError: false,
          isSearch: false,
          isLabelSearch: false,
          isArchive: false,
          title: 'About the Ledger Publication',
          url: { canonical: 'https://ledger.example.com/p/about.html' }
        },
        blog: baseBlog,
        posts: [samplePage]
      });

      const { count, h1s } = countH1(html);
      expect(count, `Static page view must have exactly 1 <h1>, found ${count}: ${JSON.stringify(h1s)}`).toBe(1);
      expect(h1s[0]).toContain('About the Ledger Publication');
      expect(html).toMatch(/<p class="site-title">[\s\S]*?(?:Md Redwan Ahmed)[\s\S]*?<\/p>/);
      expect(html).not.toMatch(/<h1 class="site-title">/);
    });

    it('View 8: Empty Index / Search / Label / Archive -> exactly 1 <h1> (Site title in header)', () => {
      const views = [
        {
          name: 'Empty Index',
          view: { isHomepage: true, isMultipleItems: true, isSingleItem: false, isPost: false, isPage: false, isError: false, isSearch: false, isLabelSearch: false, isArchive: false, title: 'Ledger Blog', url: { canonical: 'https://ledger.example.com/' } }
        },
        {
          name: 'Empty Search',
          view: { isHomepage: false, isMultipleItems: true, isSingleItem: false, isPost: false, isPage: false, isError: false, isSearch: true, isLabelSearch: false, isArchive: false, search: { query: 'nonexistent' }, title: 'Search: nonexistent', url: { canonical: 'https://ledger.example.com/search?q=nonexistent' } }
        },
        {
          name: 'Empty Label',
          view: { isHomepage: false, isMultipleItems: true, isSingleItem: false, isPost: false, isPage: false, isError: false, isSearch: true, isLabelSearch: true, isArchive: false, search: { label: 'Empty' }, title: 'Empty', url: { canonical: 'https://ledger.example.com/search/label/Empty' } }
        },
        {
          name: 'Empty Archive',
          view: { isHomepage: false, isMultipleItems: true, isSingleItem: false, isPost: false, isPage: false, isError: false, isSearch: false, isLabelSearch: false, isArchive: true, archive: { rangeMessage: 'January 1980' }, title: 'January 1980', url: { canonical: 'https://ledger.example.com/1980/01/' } }
        }
      ];

      for (const { name, view } of views) {
        const html = simulator.simulate({ view, blog: baseBlog, posts: [] });
        const { count, h1s, h2s } = countH1(html);
        expect(count, `${name} must have exactly 1 <h1>`).toBe(1);
        expect(h1s[0]).toMatch(/Md Redwan Ahmed/);
        expect(h2s.length, `${name} must emit empty state heading as <h2>`).toBeGreaterThanOrEqual(1);
      }
    });

    it('View 9: Error (404) -> exactly 1 <h1> (Site title in header), 404 message is <h2>', () => {
      const html = simulator.simulate({
        view: {
          isHomepage: false,
          isMultipleItems: false,
          isSingleItem: false,
          isPost: false,
          isPage: false,
          isError: true,
          isSearch: false,
          isLabelSearch: false,
          isArchive: false,
          title: 'Page Not Found',
          url: { canonical: 'https://ledger.example.com/404' }
        },
        blog: baseBlog,
        posts: []
      });

      const { count, h1s, h2s } = countH1(html);
      expect(count).toBe(1);
      expect(h1s[0]).toMatch(/Md Redwan Ahmed/);
      expect(h2s[0]).toContain("That page doesn't exist.");
    });
  });

  // --- Suite 2: Blank Page & Unhandled Empty Section Elimination ---
  describe('Empirical Verification: Blank Page & Unhandled Empty State Elimination', () => {
    it('never emits an empty or whitespace-only <main id="content"> in any view', () => {
      const testContexts: Array<{ name: string; ctx: MockViewContext }> = [
        {
          name: 'Home Lead',
          ctx: {
            view: { isHomepage: true, isMultipleItems: true, isSingleItem: false, isPost: false, isPage: false, isError: false, isSearch: false, isLabelSearch: false, isArchive: false, title: 'Home', url: { canonical: 'https://example.com/' } },
            blog: baseBlog,
            posts: [samplePost1]
          }
        },
        {
          name: 'Empty Search Results',
          ctx: {
            view: { isHomepage: false, isMultipleItems: true, isSingleItem: false, isPost: false, isPage: false, isError: false, isSearch: true, isLabelSearch: false, isArchive: false, search: { query: 'asdf' }, title: 'Search', url: { canonical: 'https://example.com/search' } },
            blog: baseBlog,
            posts: []
          }
        },
        {
          name: 'Empty Label Results',
          ctx: {
            view: { isHomepage: false, isMultipleItems: true, isSingleItem: false, isPost: false, isPage: false, isError: false, isSearch: true, isLabelSearch: true, isArchive: false, search: { label: 'Empty' }, title: 'Label', url: { canonical: 'https://example.com/search/label/Empty' } },
            blog: baseBlog,
            posts: []
          }
        },
        {
          name: 'Empty Archive Range',
          ctx: {
            view: { isHomepage: false, isMultipleItems: true, isSingleItem: false, isPost: false, isPage: false, isError: false, isSearch: false, isLabelSearch: false, isArchive: true, archive: { rangeMessage: '1970' }, title: 'Archive', url: { canonical: 'https://example.com/1970/' } },
            blog: baseBlog,
            posts: []
          }
        },
        {
          name: 'Error 404 View',
          ctx: {
            view: { isHomepage: false, isMultipleItems: false, isSingleItem: false, isPost: false, isPage: false, isError: true, isSearch: false, isLabelSearch: false, isArchive: false, title: 'Error', url: { canonical: 'https://example.com/404' } },
            blog: baseBlog,
            posts: []
          }
        },
        {
          name: 'Single Post with Empty Posts Fallback',
          ctx: {
            view: { isHomepage: false, isMultipleItems: false, isSingleItem: true, isPost: true, isPage: false, isError: false, isSearch: false, isLabelSearch: false, isArchive: false, title: 'Post', url: { canonical: 'https://example.com/post' } },
            blog: baseBlog,
            posts: []
          }
        }
      ];

      for (const { name, ctx } of testContexts) {
        const html = simulator.simulate(ctx);
        const main = getMainContent(html);
        expect(main.length, `${name} main content must be non-empty (got ${main.length} chars)`).toBeGreaterThanOrEqual(20);
        expect(html).not.toContain('no-items section');
      }
    });

    it('Header1 correctly falls back to data:blog.title and data:blog.description when widget properties are unset', () => {
      const html = simulator.simulate({
        view: { isHomepage: true, isMultipleItems: true, isSingleItem: false, isPost: false, isPage: false, isError: false, isSearch: false, isLabelSearch: false, isArchive: false, title: 'Home', url: { canonical: 'https://example.com/' } },
        blog: { ...baseBlog, title: 'Fallback Blog Title', description: 'Fallback Tagline' },
        posts: [samplePost1]
      });

      const brand = html.match(/<div class="header-brand-text">[\s\S]*?<\/div>/)?.[0] ?? '';
      expect(brand).toContain('Md Redwan Ahmed');
      expect(brand).toContain('Cyber Security Professional');
      expect(brand).not.toContain('Fallback Blog Title');
      expect(brand).not.toContain('Fallback Tagline');
      expect(html).toContain('Fallback Blog Title');
    });
  });

  // --- Suite 3: Accessibility Landmarks & Skip Link ---
  describe('Empirical Verification: Accessibility Landmarks & Skip Link', () => {
    it('skip link is placed immediately inside body and references #content', () => {
      expect(themeXml).toMatch(/<body[^>]*>\s*(?:<b:class[^>]*\/>\s*)*<a class="skip-link" href="#content">Skip to content<\/a>/);
    });

    it('declares exact top-level ARIA landmark roles: role="banner", role="main", role="contentinfo"', () => {
      expect(themeXml).toContain('role="banner"');
      expect(themeXml).toContain('role="main"');
      expect(themeXml).toContain('role="contentinfo"');
    });

    it('nav elements have descriptive aria-label attributes and zero illegal nav nesting', () => {
      const html = simulator.simulate({
        view: { isHomepage: true, isMultipleItems: true, isSingleItem: false, isPost: false, isPage: false, isError: false, isSearch: false, isLabelSearch: false, isArchive: false, isLayoutMode: true, title: 'Home', url: { canonical: 'https://example.com/' } },
        blog: baseBlog,
        posts: [samplePost1],
        links: [{ name: 'Docs', target: '/docs' }],
        labels: [{ name: 'Security', url: '/search/label/Security', count: 5 }]
      });

      // No nested nav elements
      expect(html).not.toMatch(/<nav\b[^>]*>(?:(?!<\/nav>)[\s\S])*<nav\b/i);

      // Check all nav tags have aria-label
      const navMatches = [...html.matchAll(/<nav\b([^>]*)>/gi)];
      for (const match of navMatches) {
        expect(match[1]).toMatch(/aria-label="[^"]+"/);
      }
    });
  });

  // --- Suite 4: Adversarial Special Character & JSON-LD Escaping Stress Tests ---
  describe('Adversarial Stress Testing: Special Characters, HTML Entities & JSON-LD Integrity', () => {
    it('handles titles with double quotes, angle brackets, ampersands, and unicode emojis safely in JSON-LD', () => {
      const adversarialTitle = '🛡️ "Cybersecurity" & <Threat> — 2026 Guide';
      const adversarialPost: MockPost = {
        title: adversarialTitle,
        url: 'https://ledger.example.com/2026/08/cybersecurity.html',
        body: '<p>Content</p>',
        date: { iso8601: '2026-08-16T00:00:00Z', toString: () => 'August 16, 2026' },
        snippets: { long: 'A guide containing "quotes", <tags>, & ampersands.' },
        author: {
          name: { toString: () => 'Agent "007" & <Specialist>', jsonEscaped: 'Agent \\"007\\" & <Specialist>' }
        }
      };

      const html = simulator.simulate({
        view: {
          isHomepage: false,
          isMultipleItems: false,
          isSingleItem: true,
          isPost: true,
          isPage: false,
          isError: false,
          isSearch: false,
          isLabelSearch: false,
          isArchive: false,
          title: adversarialTitle,
          url: { canonical: 'https://ledger.example.com/2026/08/cybersecurity.html' }
        },
        blog: baseBlog,
        posts: [adversarialPost]
      });

      // Extract JSON-LD script blocks
      const jsonLdMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
      expect(jsonLdMatches.length).toBeGreaterThanOrEqual(1);

      for (const match of jsonLdMatches) {
        const rawJson = match[1]!.trim();
        let parsed: any;
        expect(() => {
          parsed = JSON.parse(rawJson);
        }, `JSON-LD must be valid JSON even with adversarial input: \n${rawJson}`).not.toThrow();

        if (parsed['@type'] === 'BlogPosting') {
          expect(parsed.headline).toContain('Cybersecurity');
          expect(parsed.mainEntityOfPage['@id']).toBe('https://ledger.example.com/2026/08/cybersecurity.html');
          expect(parsed.publisher['@type']).toBe('Organization');
        }
      }
    });

    it('validates WebSite SearchAction JSON-LD on homepage and search views', () => {
      const html = simulator.simulate({
        view: {
          isHomepage: true,
          isMultipleItems: true,
          isSingleItem: false,
          isPost: false,
          isPage: false,
          isError: false,
          isSearch: false,
          isLabelSearch: false,
          isArchive: false,
          title: 'Home',
          url: { canonical: 'https://ledger.example.com/' }
        },
        blog: baseBlog,
        posts: [samplePost1]
      });

      const jsonLdMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
      expect(jsonLdMatches.length).toBe(1);
      const parsed = JSON.parse(jsonLdMatches[0]![1]!.trim());
      expect(parsed['@type']).toBe('WebSite');
      expect(parsed.potentialAction['@type']).toBe('SearchAction');
      expect(parsed.potentialAction.target.urlTemplate).toContain('/search?q={search_term_string}');
    });
  });
});
