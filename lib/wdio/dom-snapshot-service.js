import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { DOMSnapshot } from './domSnapshot.js'

export class DOMSnapshotService {
  constructor (options) {
    this.options = {
      baselineDir: './snapshots/baseline',
      actualDir: './snapshots/actual',
      diffDir: './snapshots/diff',
      updateBaseline: process.env.UPDATE_BASELINE === 'true',
      mode: 'full', // 'dom' | 'styles' | 'full'
      storage: 'hash', // 'hash' | 'full' | 'hash+diff'
      autoWrite: true,
      failOnMismatch: true,
      browser: {
        ignoreTags: ['script', 'style', 'noscript', 'svg', 'path', 'link', 'meta', 'iframe'],
        ignoreSelectors: [],
        ignoreAttrs: ['data-v-', 'data-reactid', 'data-gtm'],
        ignoreHidden: true,
        includePseudo: true,
        includeBox: true,
        includeText: true,
        depth: Infinity
      },
      ...options
    }

    this.ensureDir(this.options.baselineDir)
    this.ensureDir(this.options.actualDir)
    this.ensureDir(this.options.diffDir)
  }

  async before (capabilities, specs, browser) {
    browser.snapshot = {
      // Unified API
      capture: this.capture.bind(this, browser),
      compare: this.compare.bind(this, browser),

      // Specific methods
      captureDOM: this.captureDOM.bind(this, browser),
      captureStyles: this.captureStyles.bind(this, browser),
      captureFull: this.captureFull.bind(this, browser),

      compareDOM: this.compareDOM.bind(this, browser),
      compareStyles: this.compareStyles.bind(this, browser),
      compareFull: this.compareFull.bind(this, browser),

      // Config helpers
      ignore: this.addIgnoreSelector.bind(this),
      setMode: (mode) => { this.options.mode = mode },
      setStorage: (storage) => { this.options.storage = storage },
      updateBaseline: () => { this.options.updateBaseline = true }
    }
  }

  // ─────────────────────────────────────────────
  // UNIFIED METHODS
  // ─────────────────────────────────────────────

  async capture (browser, name, selector = 'body') {
    switch (this.options.mode) {
      case 'dom': return this.captureDOM(browser, name, selector)
      case 'styles': return this.captureStyles(browser, name, selector)
      case 'full': return this.captureFull(browser, name, selector)
      default: throw new Error(`Unknown mode: ${this.options.mode}`)
    }
  }

  async compare (browser, name, selector = 'body') {
    switch (this.options.mode) {
      case 'dom': return this.compareDOM(browser, name, selector)
      case 'styles': return this.compareStyles(browser, name, selector)
      case 'full': return this.compareFull(browser, name, selector)
      default: throw new Error(`Unknown mode: ${this.options.mode}`)
    }
  }

  // ─────────────────────────────────────────────
  // CAPTURE METHODS
  // ─────────────────────────────────────────────

  async captureDOM (browser, name, selector = 'body') {
    const result = await this._executeInBrowser(browser, selector, 'getDOM')
    return this._saveSnapshot(name, 'dom', result)
  }

  async captureStyles (browser, name, selector = 'body') {
    const result = await this._executeInBrowser(browser, selector, 'getStyles')
    return this._saveSnapshot(name, 'styles', result)
  }

  async captureFull (browser, name, selector = 'body') {
    const result = await this._executeInBrowser(browser, selector, 'capture')
    return this._saveSnapshot(name, 'full', result)
  }

  // ─────────────────────────────────────────────
  // COMPARE METHODS
  // ─────────────────────────────────────────────

  async compareDOM (browser, name, selector = 'body') {
    return this._compareSnapshot(browser, name, 'dom', selector, 'getDOM')
  }

  async compareStyles (browser, name, selector = 'body') {
    return this._compareSnapshot(browser, name, 'styles', selector, 'getStyles')
  }

  async compareFull (browser, name, selector = 'body') {
    return this._compareSnapshot(browser, name, 'full', selector, 'capture')
  }

  // ─────────────────────────────────────────────
  // BROWSER EXECUTION
  // ─────────────────────────────────────────────

  async _executeInBrowser (browser, selector, method) {
    const browserOpts = JSON.stringify(this.options.browser)

    return browser.execute((sel, opts, meth, snapshotClass) => {
      const DOMSnapshot = new Function('return (' + snapshotClass + ')')()
      const snap = new DOMSnapshot(JSON.parse(opts))
      return {
        data: snap[meth](sel),
        meta: snap.getMeta()
      }
    }, selector, browserOpts, method, DOMSnapshot.toString())
  }

  // ─────────────────────────────────────────────
  // FILE OPERATIONS
  // ─────────────────────────────────────────────

  _saveSnapshot (name, type, result, forceFullData = false) {
    const hash = this.hash(result.data)
    const storeFull = forceFullData || this.options.storage === 'full'

    const snapshot = {
      name,
      type,
      timestamp: new Date().toISOString(),
      hash,
      meta: result.meta,
      options: this.options.browser,
      ...(storeFull && { data: result.data })
    }

    if (this.options.autoWrite) {
      const dir = this.options.updateBaseline ? this.options.baselineDir : this.options.actualDir
      const filePath = path.join(dir, `${name}.${type}.json`)
      fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2))
      snapshot.path = filePath
    }

    // Return full data in memory even if not stored
    snapshot.data = result.data

    return snapshot
  }

  async _compareSnapshot (browser, name, type, selector, method) {
    const baselinePath = path.join(this.options.baselineDir, `${name}.${type}.json`)
    const actualPath = path.join(this.options.actualDir, `${name}.${type}.json`)

    // Create baseline if missing
    if (!fs.existsSync(baselinePath)) {
      const result = await this._executeInBrowser(browser, selector, method)
      const snapshot = this._saveSnapshot(name, type, result)

      // Copy to baseline
      const baselineSnapshot = {
        name,
        type,
        timestamp: snapshot.timestamp,
        hash: snapshot.hash,
        meta: snapshot.meta,
        options: snapshot.options,
        ...(this.options.storage === 'full' && { data: result.data })
      }
      fs.writeFileSync(baselinePath, JSON.stringify(baselineSnapshot, null, 2))

      return {
        status: 'created',
        message: 'Baseline created',
        mode: type,
        storage: this.options.storage,
        match: true,
        hash: snapshot.hash
      }
    }

    // Load baseline
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))

    // Capture actual
    const result = await this._executeInBrowser(browser, selector, method)
    const actualHash = this.hash(result.data)

    // Compare hashes
    const match = baseline.hash === actualHash

    // Determine what to store based on storage mode
    const storeActualFull = this.options.storage === 'full' ||
                           (this.options.storage === 'hash+diff' && !match)

    // Save actual
    const actual = this._saveSnapshot(name, type, result, storeActualFull)

    // Generate diff if mismatch
    let diff = null
    if (!match) {
      if (baseline.data) {
        // Full baseline available — generate detailed diff
        diff = this.generateDiff(baseline.data, result.data)
        const diffPath = path.join(this.options.diffDir, `${name}.${type}.diff.json`)
        fs.writeFileSync(diffPath, JSON.stringify({
          baseline: { hash: baseline.hash, timestamp: baseline.timestamp },
          actual: { hash: actualHash, timestamp: actual.timestamp },
          changes: diff
        }, null, 2))
      } else {
        // Hash-only baseline — save full actual for inspection
        const fullActualPath = path.join(this.options.diffDir, `${name}.${type}.actual.json`)
        fs.writeFileSync(fullActualPath, JSON.stringify({
          ...actual,
          data: result.data
        }, null, 2))

        diff = [{
          type: 'hash_mismatch',
          message: 'Baseline contains hash only. Full actual saved for inspection.',
          baseline: baseline.hash,
          actual: actualHash
        }]
      }
    }

    return {
      status: match ? 'match' : 'mismatch',
      mode: type,
      storage: this.options.storage,
      match,
      baseline: { hash: baseline.hash, timestamp: baseline.timestamp },
      actual: { hash: actualHash, timestamp: actual.timestamp },
      diffCount: diff ? diff.length : 0,
      diff
    }
  }

  // ─────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────

  hash (obj) {
    const str = JSON.stringify(obj)
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16)
  }

  generateDiff (baseline, actual, path = '') {
    const diffs = []

    if (typeof baseline !== typeof actual) {
      return [{ path, type: 'type_change', from: typeof baseline, to: typeof actual }]
    }

    if (baseline === null || actual === null || typeof baseline !== 'object') {
      if (baseline !== actual) {
        diffs.push({ path, type: 'value_change', from: baseline, to: actual })
      }
      return diffs
    }

    const keys = new Set([...Object.keys(baseline), ...Object.keys(actual)])
    for (const key of keys) {
      const newPath = path ? `${path}.${key}` : key
      if (!(key in baseline)) {
        diffs.push({ path: newPath, type: 'added', value: actual[key] })
      } else if (!(key in actual)) {
        diffs.push({ path: newPath, type: 'removed', value: baseline[key] })
      } else {
        diffs.push(...this.generateDiff(baseline[key], actual[key], newPath))
      }
    }

    return diffs
  }

  addIgnoreSelector (selector) {
    this.options.browser.ignoreSelectors.push(selector)
    return this
  }

  ensureDir (dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
}
