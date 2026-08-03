import { test, expect } from '@playwright/test'

const API = process.env.API_BASE_URL || 'http://localhost:3001'

test.describe('E2E map + decide', () => {
  test('E2E-01 home map shell loads with layers', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Geo Decision Platform')).toBeVisible()
    await expect(page.getByLabel('layers').or(page.locator('.layers')).first()).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /Trạm sạc/i })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /Cửa hàng/i })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /Showroom/i })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /Xưởng DV/i })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /Đại lý/i })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /Đỗ xe/i })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /Cứu hộ/i })).toBeVisible()
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 })
  })

  test('E2E-02 search box accepts Times City', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Tìm kiếm').fill('Times City')
    await page.waitForTimeout(800)
    await expect(page.getByLabel('Tìm kiếm')).toHaveValue('Times City')
  })

  test('E2E-03 decide API + AI panel recommendation', async ({ page, request }) => {
    const res = await request.post(`${API}/api/decide`, {
      data: {
        query: 'Xe tôi gần Times City, pin còn 10%, tìm trạm sạc phù hợp nhất.',
        limit: 3,
      },
    })
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.recommendations.length).toBeGreaterThan(0)

    await page.goto('/')
    await expect(page.getByText('AI Decision')).toBeVisible()
    const box = page.getByLabel('Câu hỏi quyết định')
    await box.fill('Xe tôi gần Times City, pin còn 10%, tìm trạm sạc phù hợp nhất.')
    await page.getByRole('button', { name: 'Gợi ý địa điểm' }).click()
    await expect(page.getByText(/Intent:/i).first()).toBeVisible({
      timeout: 30_000,
    })
  })
})
