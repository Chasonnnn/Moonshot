const { test } = require('playwright/test');

test('smoke', async ({ page }) => {
  await page.goto('http://localhost:3000/dashboard');
  console.log('title=' + await page.title());
});
