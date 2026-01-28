describe('DOM Snapshot Service', () => {
  beforeEach(async () => {
    await browser.url(`file://${process.cwd()}/fixtures/test.html`)
    await browser.pause(500) // Wait for animations to settle
  })

  describe('Full Snapshot (DOM + Styles)', () => {
    it('should capture full snapshot of body', async () => {
      const snapshot = await browser.snapshot.captureFull('homepage-full', 'body')

      expect(snapshot).toHaveProperty('hash')
      expect(snapshot).toHaveProperty('data')
      expect(snapshot.type).toBe('full')
    })

    it('should compare full snapshot against baseline', async () => {
      const result = await browser.snapshot.compareFull('homepage-full', 'body')

      console.log('result: ', result)

      expect(result.match).toBe(true)
    })
  })

  // describe('DOM Only Snapshot', () => {
  //   it('should capture DOM structure without styles', async () => {
  //     const snapshot = await browser.snapshot.captureDOM('homepage-dom', 'body')

  //     expect(snapshot.type).toBe('dom')
  //     expect(snapshot.data).toHaveProperty('tag', 'body')
  //     expect(snapshot.data).toHaveProperty('children')
  //   })

  //   it('should compare DOM structure against baseline', async () => {
  //     const result = await browser.snapshot.compareDOM('homepage-dom', 'body')

  //     expect(result.match).toBe(true)
  //   })
  // })

  // describe('Styles Only Snapshot', () => {
  //   it('should capture styles without DOM structure', async () => {
  //     const snapshot = await browser.snapshot.captureStyles('homepage-styles', 'body')

  //     expect(snapshot.type).toBe('styles')
  //     expect(Array.isArray(snapshot.data)).toBe(true)
  //   })

  //   it('should compare styles against baseline', async () => {
  //     const result = await browser.snapshot.compareStyles('homepage-styles', 'body')

  //     expect(result.match).toBe(true)
  //   })
  // })

  // describe('Component Targeting', () => {
  //   it('should capture header component', async () => {
  //     const snapshot = await browser.snapshot.captureFull('header-component', '.header')

  //     expect(snapshot.data.tag).toBe('header')
  //     expect(snapshot.data.attrs.class).toContain('header')
  //   })

  //   it('should capture sidebar component', async () => {
  //     const snapshot = await browser.snapshot.captureFull('sidebar-component', '.sidebar')

  //     expect(snapshot.data.tag).toBe('aside')
  //   })

  //   it('should capture scrollable list', async () => {
  //     const snapshot = await browser.snapshot.captureFull('scrollable-list', '.scrollable-list')

  //     expect(snapshot.data.children.length).toBeGreaterThan(0)
  //   })

  //   it('should capture data table', async () => {
  //     const snapshot = await browser.snapshot.captureFull('data-table', '.table-container')

  //     expect(snapshot.data).toBeDefined()
  //   })

  //   it('should capture 3D card', async () => {
  //     const snapshot = await browser.snapshot.captureFull('card-3d', '.card-3d')

  //     expect(snapshot.data.styles).toHaveProperty('transform')
  //   })
  // })

  // describe('Ignore Selectors', () => {
  //   it('should ignore dynamic content', async () => {
  //     browser.snapshot.ignore('.rotating-element')
  //     browser.snapshot.ignore('.floating-card')

  //     const result = await browser.snapshot.compareFull('static-content', 'body')

  //     expect(result.match).toBe(true)
  //   })

  //   it('should ignore canvas element', async () => {
  //     browser.snapshot.ignore('canvas')

  //     const snapshot = await browser.snapshot.captureFull('no-canvas', '.main-content')
  //     const hasCanvas = JSON.stringify(snapshot.data).includes('"tag":"canvas"')

  //     expect(hasCanvas).toBe(false)
  //   })
  // })

  // describe('Mode Switching', () => {
  //   it('should switch to DOM mode and capture', async () => {
  //     browser.snapshot.setMode('dom')

  //     const result = await browser.snapshot.compare('mode-test-dom', 'body')

  //     expect(result.mode).toBe('dom')
  //   })

  //   it('should switch to styles mode and capture', async () => {
  //     browser.snapshot.setMode('styles')

  //     const result = await browser.snapshot.compare('mode-test-styles', 'body')

  //     expect(result.mode).toBe('styles')
  //   })

  //   it('should switch back to full mode', async () => {
  //     browser.snapshot.setMode('full')

  //     const result = await browser.snapshot.compare('mode-test-full', 'body')

  //     expect(result.mode).toBe('full')
  //   })
  // })

  // describe('Diff Detection', () => {
  //   it('should detect text changes', async () => {
  //     // Capture baseline
  //     await browser.snapshot.captureFull('text-change-test', '.header')

  //     // Modify text
  //     await browser.execute(() => {
  //       document.querySelector('.header h1').textContent = 'Modified Title'
  //     })

  //     const result = await browser.snapshot.compareFull('text-change-test', '.header')

  //     expect(result.match).toBe(false)
  //     expect(result.diff.length).toBeGreaterThan(0)
  //   })

  //   it('should detect style changes', async () => {
  //     // Capture baseline
  //     await browser.snapshot.captureFull('style-change-test', '.sidebar')

  //     // Modify styles
  //     await browser.execute(() => {
  //       document.querySelector('.sidebar').style.backgroundColor = 'red'
  //     })

  //     const result = await browser.snapshot.compareFull('style-change-test', '.sidebar')

  //     expect(result.match).toBe(false)
  //   })

  //   it('should detect structural changes', async () => {
  //     // Capture baseline
  //     await browser.snapshot.captureDOM('structure-change-test', '.sidebar ul')

  //     // Add element
  //     await browser.execute(() => {
  //       const li = document.createElement('li')
  //       li.textContent = 'New Item'
  //       document.querySelector('.sidebar ul').appendChild(li)
  //     })

  //     const result = await browser.snapshot.compareDOM('structure-change-test', '.sidebar ul')

  //     expect(result.match).toBe(false)
  //     expect(result.diff.some(d => d.type === 'added')).toBe(true)
  //   })
  // })

  // describe('Baseline Management', () => {
  //   it('should create baseline when none exists', async () => {
  //     const result = await browser.snapshot.compareFull('new-baseline-test', 'body')

  //     expect(result.status).toBe('created')
  //     expect(result.message).toBe('Baseline created')
  //   })

  //   it('should update baseline when flag is set', async () => {
  //     browser.snapshot.updateBaseline()

  //     const snapshot = await browser.snapshot.captureFull('update-baseline-test', 'body')

  //     expect(snapshot.path).toContain('baseline')
  //   })
  // })

  // describe('Complex Scenarios', () => {
  //   it('should handle large DOM trees', async () => {
  //     const snapshot = await browser.snapshot.captureFull('large-dom', '#list-container')

  //     // Should have 100 list items
  //     expect(snapshot.data.children.length).toBe(100)
  //   })

  //   it('should handle table with many rows', async () => {
  //     const snapshot = await browser.snapshot.captureFull('large-table', '#table-body')

  //     // Should have 50 table rows
  //     expect(snapshot.data.children.length).toBe(50)
  //   })

  //   it('should capture pseudo states from CSS', async () => {
  //     const snapshot = await browser.snapshot.captureFull('pseudo-states', '.list-item')

  //     expect(snapshot.data).toHaveProperty('pseudo')
  //     expect(snapshot.data.pseudo).toHaveProperty('hover')
  //   })

  //   it('should capture bounding boxes accurately', async () => {
  //     const snapshot = await browser.snapshot.captureFull('bounding-boxes', '.header')

  //     expect(snapshot.data.box).toHaveProperty('x')
  //     expect(snapshot.data.box).toHaveProperty('y')
  //     expect(snapshot.data.box).toHaveProperty('w')
  //     expect(snapshot.data.box).toHaveProperty('h')
  //     expect(snapshot.data.box.h).toBe(60) // Header height from CSS
  //   })
  // })
})
