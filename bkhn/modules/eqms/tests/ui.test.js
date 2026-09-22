import { test, expect } from '@playwright/test';

test('loads the light workspace without page or console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('./');
  await expect(page.locator('#appStatus')).toContainText('ข้อมูลพร้อมใช้งาน');
  await expect(page.locator('#headerYear')).toContainText('2569');
  await expect(page.locator('#activeExamTitleBadge')).toContainText('40 ข้อ');
  expect(errors).toEqual([]);
});

test('shows and sorts all editable answer keys before student analysis', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#appStatus')).toContainText('ข้อมูลพร้อมใช้งาน');
  await page.locator('#tab-keys-btn').click();
  await expect(page.locator('#keyEditorTableBody tr')).toHaveCount(40);
  await page.locator('#keyEditorTable thead th').first().click();
  await page.locator('#keyEditorTable thead th').first().click();
  await expect(page.locator('#keyEditorTableBody tr').first().locator('td').first()).toHaveText('40');
  await expect(page.locator('#editBloom_1')).toHaveValue('การจำ');
});

test('saves 40 answers through ajax and updates the view without navigation', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#appStatus')).toContainText('ข้อมูลพร้อมใช้งาน');
  await page.locator('#tab-fastentry-btn').click();
  await page.locator('#stringStudentSelect').selectOption('001');
  await page.locator('#stringInput').fill('1'.repeat(40));
  const navigations = [];
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  page.once('dialog', dialog => dialog.accept());
  await page.locator('button[onclick="saveStringMode()"]', { hasText: 'บันทึก' }).click();
  await expect(page.locator('#appStatus')).toContainText('ข้อมูลพร้อมใช้งาน');
  expect(navigations).toEqual([]);
});
