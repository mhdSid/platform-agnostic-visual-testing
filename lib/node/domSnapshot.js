import fs from 'fs'
import path from 'path'

// ═══════════════════════════════════════════════════════════════
// BROWSER SIDE - Runs inside browser.execute / page.evaluate
// ═══════════════════════════════════════════════════════════════

export const DOMSnapshotBrowser = `
class DOMSnapshot {
  constructor(options = {}) {
    this.options = {
      root: 'body',
      depth: Infinity,
      includePseudo: true,
      includeBox: true,
      includeText: true,
      pseudoStates: ['hover', 'active', 'focus', 'focus-within', 'disabled', 'checked'],
      ignoreAttrs: ['data-v-', 'data-reactid', 'data-gtm'],
      ignoreTags: ['script', 'style', 'noscript', 'svg', 'path', 'link', 'meta'],
      ignoreSelectors: [],
      ignoreHidden: true,
      ...options
    };
    
    this._ruleCache = null;
    this._ignoreSet = new Set(this.options.ignoreTags.map(t => t.toUpperCase()));
  }

  getDOM(selector = this.options.root) {
    const root = document.querySelector(selector);
    if (!root) return null;
    return this._captureNode(root, 0, false);
  }

  getStyles(selector = this.options.root) {
    const elements = this._queryElements(selector);
    this._buildRuleCache();
    return elements.map(el => ({
      selector: this._getSelector(el),
      styles: this._getAppliedStyles(el),
      pseudo: this.options.includePseudo ? this._getPseudoStyles(el) : {}
    }));
  }

  capture(selector = this.options.root) {
    const root = document.querySelector(selector);
    if (!root) return null;
    this._buildRuleCache();
    return this._captureNode(root, 0, true);
  }

  _shouldIgnore(el) {
    if (this._ignoreSet.has(el.tagName)) return true;
    if (this.options.ignoreHidden) {
      if (el.offsetParent === null && el.tagName !== 'BODY') {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return true;
      }
    }
    for (const selector of this.options.ignoreSelectors) {
      try { if (el.matches(selector)) return true; } catch (e) {}
    }
    return false;
  }

  _queryElements(selector) {
    const query = selector === 'body' ? 'body *' : selector + ', ' + selector + ' *';
    return Array.from(document.querySelectorAll(query)).filter(el => !this._shouldIgnore(el));
  }

  _captureNode(el, depth, includeStyles) {
    if (depth > this.options.depth) return null;
    if (this._shouldIgnore(el)) return null;

    const node = { tag: el.tagName.toLowerCase(), attrs: this._getAttributes(el) };

    if (this.options.includeBox) {
      const rect = el.getBoundingClientRect();
      node.box = { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) };
    }

    if (this.options.includeText) {
      const text = this._getDirectText(el);
      if (text) node.text = text;
    }

    if (includeStyles) {
      node.styles = this._getAppliedStyles(el);
      if (this.options.includePseudo) {
        const pseudo = this._getPseudoStyles(el);
        if (Object.keys(pseudo).length) node.pseudo = pseudo;
      }
    }

    const children = [];
    for (const child of el.children) {
      const captured = this._captureNode(child, depth + 1, includeStyles);
      if (captured) children.push(captured);
    }
    if (children.length) node.children = children;

    return node;
  }

  _getAttributes(el) {
    const attrs = {};
    for (const attr of el.attributes) {
      if (!this.options.ignoreAttrs.some(p => attr.name.startsWith(p))) {
        attrs[attr.name] = attr.value;
      }
    }
    return attrs;
  }

  _getDirectText(el) {
    return Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent.trim())
      .filter(Boolean)
      .join(' ') || null;
  }

  _getSelector(el) {
    if (el.id) return '#' + el.id;
    const path = [];
    while (el && el !== document.body) {
      let s = el.tagName.toLowerCase();
      if (el.id) { path.unshift('#' + el.id); break; }
      const sibs = Array.from(el.parentElement?.children || []).filter(c => c.tagName === el.tagName);
      if (sibs.length > 1) s += ':nth-of-type(' + (sibs.indexOf(el) + 1) + ')';
      path.unshift(s);
      el = el.parentElement;
    }
    return path.join(' > ');
  }

  _buildRuleCache() {
    if (this._ruleCache) return;
    this._ruleCache = { base: [], pseudo: {} };
    this.options.pseudoStates.forEach(s => this._ruleCache.pseudo[s] = []);

    for (const sheet of document.styleSheets) {
      try {
        for (const rule of (sheet.cssRules || [])) {
          if (!(rule instanceof CSSStyleRule)) continue;
          const selector = rule.selectorText;
          const pm = this.options.pseudoStates.find(s => selector.includes(':' + s));
          if (pm) {
            this._ruleCache.pseudo[pm].push({ selector: selector.replace(new RegExp(':' + pm, 'g'), ''), style: rule.style });
          } else {
            this._ruleCache.base.push({ selector, style: rule.style });
          }
        }
      } catch (e) {}
    }
  }

  _getAppliedStyles(el) {
    const styles = {};
    for (const { selector, style } of this._ruleCache.base) {
      try {
        if (el.matches(selector)) {
          for (let i = 0; i < style.length; i++) styles[style[i]] = style.getPropertyValue(style[i]);
        }
      } catch (e) {}
    }
    for (let i = 0; i < el.style.length; i++) styles[el.style[i]] = el.style.getPropertyValue(el.style[i]);
    return styles;
  }

  _getPseudoStyles(el) {
    const pseudo = {};
    for (const state of this.options.pseudoStates) {
      const styles = {};
      for (const { selector, style } of this._ruleCache.pseudo[state]) {
        try {
          if (el.matches(selector)) {
            for (let i = 0; i < style.length; i++) styles[style[i]] = style.getPropertyValue(style[i]);
          }
        } catch (e) {}
      }
      if (Object.keys(styles).length) pseudo[state] = styles;
    }
    return pseudo;
  }

  getMeta() {
    return {
      url: window.location.href,
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight }
    };
  }
}
`

// ═══════════════════════════════════════════════════════════════
// NODE SIDE - Handles disk I/O, works with WDIO or Puppeteer
// ═══════════════════════════════════════════════════════════════

export class DOMSnapshotRunner {
  constructor (options = {}) {
    this.options = {
      outputDir: './snapshots',
      autoWrite: true,
      prettyPrint: true,
      ...options
    }

    this.browserOptions = {
      ignoreTags: ['script', 'style', 'noscript', 'svg', 'path', 'link', 'meta'],
      ignoreSelectors: [],
      ignoreAttrs: ['data-v-', 'data-reactid', 'data-gtm'],
      ignoreHidden: true,
      includePseudo: true,
      includeBox: true,
      includeText: true,
      ...options.browser
    }

    this._driver = null
    this._driverType = null
  }

  // ─────────────────────────────────────────────
  // DRIVER SETUP
  // ─────────────────────────────────────────────

  useWDIO (browser) {
    this._driver = browser
    this._driverType = 'wdio'
    return this
  }

  usePuppeteer (page) {
    this._driver = page
    this._driverType = 'puppeteer'
    return this
  }

  usePlaywright (page) {
    this._driver = page
    this._driverType = 'playwright'
    return this
  }

  // ─────────────────────────────────────────────
  // CAPTURE METHODS
  // ─────────────────────────────────────────────

  async captureDOM (selector = 'body', filename = null) {
    const result = await this._execute(selector, 'getDOM')
    return this._handleResult(result, filename, 'dom')
  }

  async captureStyles (selector = 'body', filename = null) {
    const result = await this._execute(selector, 'getStyles')
    return this._handleResult(result, filename, 'styles')
  }

  async capture (selector = 'body', filename = null) {
    const result = await this._execute(selector, 'capture')
    return this._handleResult(result, filename, 'full')
  }

  async _execute (selector, method) {
    if (!this._driver) {
      throw new Error('No driver set. Call useWDIO(), usePuppeteer(), or usePlaywright() first.')
    }

    const script = `
      ${DOMSnapshotBrowser}
      
      const snap = new DOMSnapshot(${JSON.stringify(this.browserOptions)});
      const data = snap.${method}('${selector}');
      const meta = snap.getMeta();
      
      return { data, meta };
    `

    let result

    switch (this._driverType) {
      case 'wdio':
        result = await this._driver.execute(new Function(script))
        break
      case 'puppeteer':
      case 'playwright':
        result = await this._driver.evaluate(new Function(script))
        break
      default:
        throw new Error(`Unknown driver type: ${this._driverType}`)
    }

    return result
  }

  // ─────────────────────────────────────────────
  // FILE HANDLING
  // ─────────────────────────────────────────────

  async _handleResult (result, filename, type) {
    const snapshot = {
      timestamp: new Date().toISOString(),
      type,
      meta: result.meta,
      options: this.browserOptions,
      data: result.data
    }

    if (this.options.autoWrite && filename) {
      await this.write(snapshot, filename)
    }

    return snapshot
  }

  async write (snapshot, filename) {
    const dir = this.options.outputDir

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const filepath = filename.endsWith('.json')
      ? path.join(dir, filename)
      : path.join(dir, `${filename}.json`)

    const content = this.options.prettyPrint
      ? JSON.stringify(snapshot, null, 2)
      : JSON.stringify(snapshot)

    fs.writeFileSync(filepath, content, 'utf8')

    return filepath
  }

  read (filename) {
    const filepath = filename.includes(path.sep)
      ? filename
      : path.join(this.options.outputDir, filename.endsWith('.json') ? filename : `${filename}.json`)

    if (!fs.existsSync(filepath)) {
      throw new Error(`Snapshot not found: ${filepath}`)
    }

    return JSON.parse(fs.readFileSync(filepath, 'utf8'))
  }

  // ─────────────────────────────────────────────
  // COMPARISON
  // ─────────────────────────────────────────────

  compare (snapshot1, snapshot2) {
    const s1 = typeof snapshot1 === 'string' ? this.read(snapshot1) : snapshot1
    const s2 = typeof snapshot2 === 'string' ? this.read(snapshot2) : snapshot2

    const hash1 = this.hash(s1.data)
    const hash2 = this.hash(s2.data)

    return {
      match: hash1 === hash2,
      hash1,
      hash2,
      baseline: { timestamp: s1.timestamp, url: s1.meta?.url },
      current: { timestamp: s2.timestamp, url: s2.meta?.url },
      diffs: hash1 !== hash2 ? this.diff(s1.data, s2.data) : []
    }
  }

  async compareWithBaseline (selector, baselineFile) {
    const current = await this.capture(selector)
    const baseline = this.read(baselineFile)
    return this.compare(baseline, current)
  }

  hash (obj) {
    const str = JSON.stringify(obj)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash = hash & hash
    }
    return Math.abs(hash).toString(16).padStart(8, '0')
  }

  diff (a, b, path = '') {
    const diffs = []

    if (typeof a !== typeof b) {
      return [{ path, type: 'type_change', from: typeof a, to: typeof b }]
    }

    if (a === null || b === null || typeof a !== 'object') {
      if (a !== b) diffs.push({ path, type: 'value_change', from: a, to: b })
      return diffs
    }

    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const key of keys) {
      const newPath = path ? `${path}.${key}` : key
      if (!(key in a)) {
        diffs.push({ path: newPath, type: 'added', value: b[key] })
      } else if (!(key in b)) {
        diffs.push({ path: newPath, type: 'removed', value: a[key] })
      } else {
        diffs.push(...this.diff(a[key], b[key], newPath))
      }
    }

    return diffs
  }

  // ─────────────────────────────────────────────
  // CONFIG HELPERS
  // ─────────────────────────────────────────────

  ignoreSelector (selector) {
    this.browserOptions.ignoreSelectors.push(selector)
    return this
  }

  ignoreTag (tag) {
    this.browserOptions.ignoreTags.push(tag)
    return this
  }

  setOutputDir (dir) {
    this.options.outputDir = dir
    return this
  }
}
