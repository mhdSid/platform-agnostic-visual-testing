// ═══════════════════════════════════════════════════════════════
// BROWSER SIDE - Runs inside browser.execute / page.evaluate
// ═══════════════════════════════════════════════════════════════
export class DOMSnapshot {
  constructor (options = {}) {
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
    }

    this._ruleCache = null
    this._ignoreSet = new Set(this.options.ignoreTags.map(t => t.toUpperCase()))
  }

  getDOM (selector = this.options.root) {
    const root = document.querySelector(selector)
    if (!root) return null
    return this._captureNode(root, 0, false)
  }

  getStyles (selector = this.options.root) {
    const elements = this._queryElements(selector)
    this._buildRuleCache()
    return elements.map(el => ({
      selector: this._getSelector(el),
      styles: this._getAppliedStyles(el),
      pseudo: this.options.includePseudo ? this._getPseudoStyles(el) : {}
    }))
  }

  capture (selector = this.options.root) {
    const root = document.querySelector(selector)
    if (!root) return null
    this._buildRuleCache()
    return this._captureNode(root, 0, true)
  }

  _shouldIgnore (el) {
    if (this._ignoreSet.has(el.tagName)) return true
    if (this.options.ignoreHidden) {
      if (el.offsetParent === null && el.tagName !== 'BODY') {
        const style = window.getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') return true
      }
    }
    for (const selector of this.options.ignoreSelectors) {
      try { if (el.matches(selector)) return true } catch (e) {}
    }
    return false
  }

  _queryElements (selector) {
    const query = selector === 'body' ? 'body *' : selector + ', ' + selector + ' *'
    return Array.from(document.querySelectorAll(query)).filter(el => !this._shouldIgnore(el))
  }

  _captureNode (el, depth, includeStyles) {
    if (depth > this.options.depth) return null
    if (this._shouldIgnore(el)) return null

    const node = { tag: el.tagName.toLowerCase(), attrs: this._getAttributes(el) }

    if (this.options.includeBox) {
      const rect = el.getBoundingClientRect()
      node.box = { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
    }

    if (this.options.includeText) {
      const text = this._getDirectText(el)
      if (text) node.text = text
    }

    if (includeStyles) {
      node.styles = this._getAppliedStyles(el)
      if (this.options.includePseudo) {
        const pseudo = this._getPseudoStyles(el)
        if (Object.keys(pseudo).length) node.pseudo = pseudo
      }
    }

    const children = []
    for (const child of el.children) {
      const captured = this._captureNode(child, depth + 1, includeStyles)
      if (captured) children.push(captured)
    }
    if (children.length) node.children = children

    return node
  }

  _getAttributes (el) {
    const attrs = {}
    for (const attr of el.attributes) {
      if (!this.options.ignoreAttrs.some(p => attr.name.startsWith(p))) {
        attrs[attr.name] = attr.value
      }
    }
    return attrs
  }

  _getDirectText (el) {
    return Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent.trim())
      .filter(Boolean)
      .join(' ') || null
  }

  _getSelector (el) {
    if (el.id) return '#' + el.id
    const path = []
    while (el && el !== document.body) {
      let s = el.tagName.toLowerCase()
      if (el.id) { path.unshift('#' + el.id); break }
      const sibs = Array.from(el.parentElement?.children || []).filter(c => c.tagName === el.tagName)
      if (sibs.length > 1) s += ':nth-of-type(' + (sibs.indexOf(el) + 1) + ')'
      path.unshift(s)
      el = el.parentElement
    }
    return path.join(' > ')
  }

  _buildRuleCache () {
    if (this._ruleCache) return
    this._ruleCache = { base: [], pseudo: {} }
    this.options.pseudoStates.forEach(s => this._ruleCache.pseudo[s] = [])

    for (const sheet of document.styleSheets) {
      try {
        for (const rule of (sheet.cssRules || [])) {
          if (!(rule instanceof CSSStyleRule)) continue
          const selector = rule.selectorText
          const pm = this.options.pseudoStates.find(s => selector.includes(':' + s))
          if (pm) {
            this._ruleCache.pseudo[pm].push({ selector: selector.replace(new RegExp(':' + pm, 'g'), ''), style: rule.style })
          } else {
            this._ruleCache.base.push({ selector, style: rule.style })
          }
        }
      } catch (e) {}
    }
  }

  _getAppliedStyles (el) {
    const styles = {}
    for (const { selector, style } of this._ruleCache.base) {
      try {
        if (el.matches(selector)) {
          for (let i = 0; i < style.length; i++) styles[style[i]] = style.getPropertyValue(style[i])
        }
      } catch (e) {}
    }
    for (let i = 0; i < el.style.length; i++) styles[el.style[i]] = el.style.getPropertyValue(el.style[i])
    return styles
  }

  _getPseudoStyles (el) {
    const pseudo = {}
    for (const state of this.options.pseudoStates) {
      const styles = {}
      for (const { selector, style } of this._ruleCache.pseudo[state]) {
        try {
          if (el.matches(selector)) {
            for (let i = 0; i < style.length; i++) styles[style[i]] = style.getPropertyValue(style[i])
          }
        } catch (e) {}
      }
      if (Object.keys(styles).length) pseudo[state] = styles
    }
    return pseudo
  }

  getMeta () {
    return {
      url: window.location.href,
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight }
    }
  }
}
