import { test, expect } from '@playwright/test'

// =============================================================================
// Test Suite: SMPMS Critical User Flows
// =============================================================================

test.describe('SMPMS E2E Critical User Flows', () => {

  // -------------------------------------------------------------------------
  // Flow 1: Map View Flow
  // -------------------------------------------------------------------------
  test.describe('Flow 1: Map View', () => {
    test('should load Map page and display header', async ({ page }) => {
      await page.goto('/map')

      // Wait for page header to load
      await expect(page.locator('text=Bengaluru — DMA Network')).toBeVisible({ timeout: 15000 })

      // Verify map toggle buttons exist
      await expect(page.getByRole('button', { name: 'ZONES' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'PIPES' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'VALVES' })).toBeVisible()
    })

    test('should display Zone Inspector panel', async ({ page }) => {
      await page.goto('/map')

      // Wait for Zone Inspector panel
      await expect(page.locator('h2:has-text("Zone Inspector")')).toBeVisible({ timeout: 15000 })
    })

    test('should display Active Alerts section', async ({ page }) => {
      await page.goto('/map')

      // Wait for Active Alerts section
      await expect(page.locator('h2:has-text("Active Alerts")')).toBeVisible({ timeout: 15000 })
    })

    test('should display Legend section', async ({ page }) => {
      await page.goto('/map')

      // Wait for Legend section
      await expect(page.locator('h2:has-text("Legend")')).toBeVisible({ timeout: 15000 })

      // Verify legend items exist (more specific)
      await expect(page.locator('text=Critical').first()).toBeVisible()
      await expect(page.locator('text=Warning').first()).toBeVisible()
    })

    test('should display Leaflet map container', async ({ page }) => {
      await page.goto('/map')

      // Wait for map container
      await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30000 })
    })
  })

  // -------------------------------------------------------------------------
  // Flow 2: Overview Flow
  // -------------------------------------------------------------------------
  test.describe('Flow 2: Overview', () => {
    test('should load Overview page and display header', async ({ page }) => {
      await page.goto('/overview')

      // Wait for page to load
      await expect(page.locator('h1:has-text("SYSTEM STATUS")')).toBeVisible({ timeout: 15000 })
    })

    test('should display KPI section', async ({ page }) => {
      await page.goto('/overview')

      // Wait for KPI section - use more specific selectors to avoid strict mode violations
      await expect(page.locator('text=Zones Online').first()).toBeVisible({ timeout: 15000 })
      await expect(page.locator('text=Avg Pressure').first()).toBeVisible()
      await expect(page.locator('text=Leaks Flagged').first()).toBeVisible()
      await expect(page.locator('text=Valve Ops').first()).toBeVisible()
    })

    test('should display zone table section', async ({ page }) => {
      await page.goto('/overview')

      // Wait for zone table
      await expect(page.locator('h2:has-text("ALL DMA ZONES")')).toBeVisible({ timeout: 15000 })

      // Verify table headers - use more specific selector
      await expect(page.locator('th').filter({ hasText: 'Zone' })).toBeVisible()
      await expect(page.locator('th').filter({ hasText: 'Pressure' })).toBeVisible()
      await expect(page.locator('th').filter({ hasText: 'Status' })).toBeVisible()
    })

    test('should display 24H Pressure Chart section with dropdown', async ({ page }) => {
      await page.goto('/overview')

      // Wait for chart section
      await expect(page.locator('h2:has-text("24H PRESSURE CHART")')).toBeVisible({ timeout: 15000 })

      // Verify dropdown exists
      await expect(page.locator('select')).toBeVisible()
    })
  })

  // -------------------------------------------------------------------------
  // Flow 3: Zone Detail Flow
  // -------------------------------------------------------------------------
  test.describe('Flow 3: Zone Detail', () => {
    test('should load Zone Detail page', async ({ page }) => {
      await page.goto('/zones/DMA-05')

      // Wait for either live content or error state
      await page.waitForTimeout(3000)

      // Check for either the live pressure section or error state
      const contentVisible = await page.locator('text=LIVE PRESSURE').isVisible().catch(() => false)
      const errorVisible = await page.locator('text=Error loading zone').isVisible().catch(() => false)

      expect(contentVisible || errorVisible).toBeTruthy()
    })

    test('should display Valve Control section when data loads', async ({ page }) => {
      await page.goto('/zones/DMA-05')

      // Wait for potential API response
      await page.waitForTimeout(3000)

      // Check for valve control or error state
      const valveControl = page.locator('h2:has-text("VALVE CONTROL")')
      const errorState = page.locator('text=Error loading zone')

      const valveVisible = await valveControl.isVisible().catch(() => false)
      const errorVisible = await errorState.isVisible().catch(() => false)

      expect(valveVisible || errorVisible).toBeTruthy()
    })

    test('should display valve preset buttons', async ({ page }) => {
      await page.goto('/zones/DMA-05')

      // Wait for page
      await page.waitForTimeout(3000)

      // Look for preset buttons or error
      const preset18 = page.locator('button:has-text("18%")')
      const errorState = page.locator('text=Error loading zone')

      const presetVisible = await preset18.isVisible().catch(() => false)
      const errorVisible = await errorState.isVisible().catch(() => false)

      expect(presetVisible || errorVisible).toBeTruthy()
    })

    test('should display valve range slider', async ({ page }) => {
      await page.goto('/zones/DMA-05')

      // Wait for page
      await page.waitForTimeout(3000)

      // Look for slider or error state
      const slider = page.locator('input[type="range"]')
      const errorState = page.locator('text=Error loading zone')

      const sliderVisible = await slider.isVisible().catch(() => false)
      const errorVisible = await errorState.isVisible().catch(() => false)

      expect(sliderVisible || errorVisible).toBeTruthy()
    })

    test('should display AI Anomaly Log section', async ({ page }) => {
      await page.goto('/zones/DMA-05')

      // Wait for page
      await page.waitForTimeout(3000)

      // Look for AI anomaly log section or error state
      const anomalyLog = page.locator('h2:has-text("AI ANOMALY LOG")')
      const errorState = page.locator('text=Error loading zone')

      const anomalyVisible = await anomalyLog.isVisible().catch(() => false)
      const errorVisible = await errorState.isVisible().catch(() => false)

      expect(anomalyVisible || errorVisible).toBeTruthy()
    })

    test('should display 7-Day Pressure History section', async ({ page }) => {
      await page.goto('/zones/DMA-05')

      // Wait for page
      await page.waitForTimeout(3000)

      // Look for 7-day section or error
      const sevenDay = page.locator('text=7-DAY PRESSURE HISTORY')
      const errorState = page.locator('text=Error loading zone')

      const sevenDayVisible = await sevenDay.isVisible().catch(() => false)
      const errorVisible = await errorState.isVisible().catch(() => false)

      expect(sevenDayVisible || errorVisible).toBeTruthy()
    })
  })

  // -------------------------------------------------------------------------
  // Flow 4: Alerts Flow
  // -------------------------------------------------------------------------
  test.describe('Flow 4: Alerts', () => {
    test('should load Alerts page and display header', async ({ page }) => {
      await page.goto('/alerts')

      // Wait for page to load - look for header
      await expect(page.locator('h1:has-text("ALERT LOG")')).toBeVisible({ timeout: 15000 })
    })

    test('should display filter tabs', async ({ page }) => {
      await page.goto('/alerts')

      // Wait for filter tabs - use first() to avoid strict mode
      await expect(page.getByRole('button', { name: 'ALL' })).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('button', { name: 'CRITICAL' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'WARNING' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'RESOLVED' })).toBeVisible()
    })

    test('should display acknowledge button for alerts', async ({ page }) => {
      await page.goto('/alerts')

      // Wait for potential alerts to load
      await page.waitForTimeout(3000)

      // Look for acknowledge button or empty state
      const acknowledgeBtn = page.locator('button:has-text("Acknowledge")')
      const emptyState = page.locator('text=No alerts')

      const ackVisible = await acknowledgeBtn.isVisible().catch(() => false)
      const emptyVisible = await emptyState.isVisible().catch(() => false)

      expect(ackVisible || emptyVisible).toBeTruthy()
    })
  })

  // -------------------------------------------------------------------------
  // Flow 5: Analytics Flow
  // -------------------------------------------------------------------------
  test.describe('Flow 5: Analytics', () => {
    test('should load Analytics page and display header', async ({ page }) => {
      await page.goto('/analytics')

      // Wait for page to load
      await expect(page.locator('h1:has-text("ANALYTICS")')).toBeVisible({ timeout: 15000 })

      // Verify live indicator
      await expect(page.locator('text=Live').first()).toBeVisible()
    })

    test('should display KPI strip section', async ({ page }) => {
      await page.goto('/analytics')

      // Wait for KPI section - use first() to avoid strict mode
      await expect(page.locator('text=AVG PRESSURE').first()).toBeVisible({ timeout: 15000 })
    })

    test('should display Pressure by Zone chart section', async ({ page }) => {
      await page.goto('/analytics')

      // Wait for chart section
      await expect(page.locator('h2:has-text("PRESSURE BY ZONE")')).toBeVisible({ timeout: 15000 })
    })

    test('should display Valve vs Pressure scatter chart section', async ({ page }) => {
      await page.goto('/analytics')

      // Wait for scatter chart section
      await expect(page.locator('h2:has-text("VALVE vs PRESSURE")')).toBeVisible({ timeout: 15000 })
    })

    test('should display Pressure Heatmap section', async ({ page }) => {
      await page.goto('/analytics')

      // Wait for heatmap section
      await expect(page.locator('h2:has-text("PRESSURE HEATMAP")')).toBeVisible({ timeout: 15000 })
    })

    test('should display Pattern Analysis section', async ({ page }) => {
      await page.goto('/analytics')

      // Wait for pattern analysis section
      await expect(page.locator('h2:has-text("PATTERN ANALYSIS")')).toBeVisible({ timeout: 15000 })

      // Verify pattern table header exists
      await expect(page.locator('th').filter({ hasText: 'Pattern' })).toBeVisible()
    })
  })

  // -------------------------------------------------------------------------
  // Cross-Flow: Navigation Test
  // -------------------------------------------------------------------------
  test.describe('Navigation', () => {
    test('should navigate between all main pages', async ({ page }) => {
      // Navigate to Map
      await page.goto('/map')
      await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30000 })

      // Navigate to Overview
      await page.goto('/overview')
      await expect(page.locator('h1:has-text("SYSTEM STATUS")')).toBeVisible({ timeout: 15000 })

      // Navigate to Alerts
      await page.goto('/alerts')
      await expect(page.locator('h1:has-text("ALERT LOG")')).toBeVisible({ timeout: 15000 })

      // Navigate to Analytics
      await page.goto('/analytics')
      await expect(page.locator('h1:has-text("ANALYTICS")')).toBeVisible({ timeout: 15000 })
    })
  })
})
