import { CompositorService } from './lib/wdio/compositor-service.js'
import { DOMSnapshotService } from './lib/wdio/dom-snapshot-service.js'

export const config = {
  runner: 'local',
  specs: ['./test/specs/**/*.js'],
  exclude: [],
  maxInstances: 1,
  capabilities: [{
    browserName: 'chrome',
    'goog:chromeOptions': {
      args: [
        '--disable-background-timer-throttling',
        '--no-sandbox',
        '--ignore-certificate-errors',
        '--safebrowsing-disable-auto-update',
        '--use-mock-keychain',
        '--headless',
        "--proxy-server='direct://'",
        '--proxy-bypass-list=*',
        '--disable-setuid-sandbox',
        '--single-process',
        '--no-zygote',
        '--font-render-hinting=none',
        '--hide-scrollbars',
        '--enable-font-antialiasing'
      ]
    }
  }],

  logLevel: 'info',
  bail: 0,
  baseUrl: `file://${process.cwd()}/fixtures`,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  services: [
    'chromedriver',
    'devtools',
    [DOMSnapshotService, {
      baselineDir: './snapshots/baseline',
      actualDir: './snapshots/actual',
      diffDir: './snapshots/diff',
      mode: 'full',
      updateBaseline: process.env.UPDATE_BASELINE === 'true',
      browser: {
        ignoreTags: ['script', 'style', 'svg'],
        ignoreSelectors: ['.loading', '.timestamp'],
        ignoreHidden: true
      }
    }],
    [CompositorService, {
      baselineDir: './baseline-data',
      actualDir: './actual-data',
      diffDir: './diff-images',
      mode: process.env.CI ? 'pixel' : 'compositor',
      pixelThreshold: 0,
      updateBaseline: process.env.UPDATE_BASELINE === 'true'
    }]
  ],

  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000
  },

  before: async function (capabilities, specs) {
    // Make compositor methods available globally
    browser.addCommand('captureCompositor', async function (name) {
      return browser.compositor.capture(name)
    })

    browser.addCommand('compareCompositor', async function (name) {
      return browser.compositor.compare(name)
    })
  }
}
