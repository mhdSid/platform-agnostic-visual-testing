# DOM Snapshot Visual Regression Testing

Platform-independent visual regression testing by capturing DOM structure and applied CSS rules instead of pixels.

## The Problem

Traditional visual regression testing compares screenshots pixel-by-pixel, generating false positives due to platform-specific rendering:

- **Windows**: DirectWrite + ClearType subpixel rendering
- **macOS**: Core Text + Quartz smoothing  
- **Linux**: FreeType + grayscale antialiasing

Even a 1px font shift creates thousands of pixel differences, causing tests to fail despite identical visual intent.

## Why Not Compositor-Level Capture?

We initially explored intercepting Chrome's compositor paint commands. **It doesn't work for cross-platform testing** because:

- Paint command counts differ across platforms (Mac: 312 commands, Linux: 247 for same element)
- Text rendering bypasses paint commands entirely (goes to OS-level APIs)
- GPU capabilities, antialiasing, and driver quirks affect command generation
- Skia generates different internal commands based on backend

Paint commands are implementation details, not semantic representation.

## The Solution: DOM + Styles Snapshot

Capture the browser's rendering intent **after** style resolution but **before** rasterization:
```
HTML/CSS → Parse → Layout → Style Resolution  ← CAPTURE HERE (deterministic)
                                    ↓
                             Paint → Rasterize → Composite  (platform-specific)
```

### What We Capture

- **DOM structure**: Tags, hierarchy, attributes
- **Bounding boxes**: Position and size from `getBoundingClientRect()`
- **Applied CSS**: Rules from stylesheets (not computed styles)
- **Pseudo-states**: `:hover`, `:focus`, `:active` styles without triggering them
- **Text content**: Direct text nodes

This produces **identical JSON** on Mac, Windows, and Linux.

## Installation
```bash
npm install
```

## Quick Start

### With WebdriverIO
```javascript
// wdio.conf.js
import { DOMSnapshotService } from './lib/wdio/dom-snapshot-service.js'

export const config = {
  services: [
    [DOMSnapshotService, {
      mode: 'full',
      updateBaseline: process.env.UPDATE_BASELINE === 'true',
      browser: {
        ignoreSelectors: ['.loading', '.timestamp'],
        ignoreTags: ['script', 'style', 'svg']
      }
    }]
  ]
}
```
```javascript
// test.spec.js
describe('Visual Regression', () => {
  it('should match baseline', async () => {
    await browser.url('/dashboard')
    const result = await browser.snapshot.compare('dashboard', '#app')
    expect(result.match).toBe(true)
  })
})
```

### Running Tests
```bash
# Compare against baselines
npx wdio run wdio.conf.js

# Update baselines
UPDATE_BASELINE=true npx wdio run wdio.conf.js
```

## API

### Capture Methods
```javascript
// Capture DOM structure only
await browser.snapshot.captureDOM('name', 'selector')

// Capture styles only  
await browser.snapshot.captureStyles('name', 'selector')

// Capture both (recommended)
await browser.snapshot.captureFull('name', 'selector')
```

### Compare Methods
```javascript
const result = await browser.snapshot.compare('name', 'selector')
// result.match: boolean
// result.diff: array of changes (if mismatch)
```

### Configuration
```javascript
browser.snapshot.ignore('.dynamic-content')  // Ignore selector
browser.snapshot.setMode('dom')              // 'dom' | 'styles' | 'full'
browser.snapshot.updateBaseline()            // Set update mode
```

## Output Structure
```javascript
{
  tag: "div",
  attrs: { class: "card", id: "main" },
  box: { x: 100, y: 50, w: 300, h: 200 },
  text: "Hello World",
  styles: { display: "flex", padding: "16px" },
  pseudo: { 
    hover: { background: "#eee" }
  },
  children: [...]
}
```

## File Structure
```
snapshots/
├── baseline/
│   └── dashboard.full.json
├── actual/
│   └── dashboard.full.json
└── diff/
    └── dashboard.full.diff.json
```

## Limitations

- **Dynamic content**: Use `ignoreSelectors` for timestamps, random IDs
- **Canvas/WebGL**: Internal drawing not captured (only the element exists)
- **Animations**: Capture at rest state or ignore animated elements
- **Third-party styles**: Cross-origin stylesheets may not be readable

## Comparison

| Approach | Platform Independent | What It Tests |
|----------|---------------------|---------------|
| Pixel comparison | ❌ No | Exact visual output |
| Compositor commands | ❌ No | Low-level paint ops |
| **DOM Snapshot** | ✅ Yes | Rendering intent |

## License

MIT