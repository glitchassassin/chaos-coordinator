import { test, expect } from '@playwright/test'
import { launchApp } from './helpers'

test('app launches and shows window', async () => {
  const app = await launchApp()
  const window = await app.firstWindow()

  const title = await window.title()
  expect(title).toBe('Chaos Coordinator')

  await app.close()
})
