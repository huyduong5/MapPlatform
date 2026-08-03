import { defineConfig, devices } from '@playwright/test'

const WEB = process.env.WEB_BASE_URL || 'http://localhost:3002'
const API = process.env.API_BASE_URL || 'http://localhost:3001'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: WEB,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Assume api+web already running locally/CI (started by scripts/ci-local.sh)
  metadata: { api: API },
})
