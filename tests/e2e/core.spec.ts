import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const PASS = 'forge-test-77';

async function no(page: Page, question: RegExp) {
  await page.getByRole('group', { name: question }).getByRole('button', { name: 'No' }).click();
}
async function yes(page: Page, question: RegExp) {
  await page.getByRole('group', { name: question }).getByRole('button', { name: 'Yes' }).click();
}
const next = (page: Page, name = 'Continue') => page.getByRole('button', { name, exact: true }).click();

async function startToAbout(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByLabel('Age (years)').fill('18');
  await next(page);
  await page.getByLabel('Passcode', { exact: true }).fill(PASS);
  await page.getByLabel('Repeat passcode').fill(PASS);
  await page.getByRole('button', { name: 'Create passcode' }).click();
  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();
}

async function fillAbout(page: Page) {
  await page.getByLabel('First name (optional)').fill('Ahmed');
  await page.getByRole('button', { name: 'Male', exact: true }).click();
  await page.getByLabel('Height (cm)').fill('162');
  await page.getByLabel('Current weight (kg)').fill('65.5');
  await page.getByLabel('City').fill('Hyderabad');
  await page.getByLabel('Occupation or main daily activity').fill('Student');
  await page.getByLabel('Hours of work or study per day').fill('8');
  await expect(page.getByText('BMI 25')).toBeVisible();
  await next(page);
}

async function answerSafety(page: Page, redFlag = false) {
  await expect(page.getByRole('heading', { name: 'Safety check' })).toBeVisible();
  if (redFlag) await yes(page, /chest pain/);
  else await no(page, /chest pain/);
  await no(page, /fainted/);
  await no(page, /heart condition/);
  await no(page, /current pain/);
  await no(page, /regular medicines/);
  await next(page);
}

async function finishRest(page: Page) {
  // Lifestyle
  await page.getByLabel('Hours sitting per day').fill('8');
  await page.getByLabel('Minutes walking per day (roughly)').fill('30');
  await page.getByLabel('Minutes you can realistically train per session').fill('45');
  for (const d of ['Mon', 'Wed', 'Fri']) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: 'Evening', exact: true }).click();
  await no(page, /weekends/);
  await next(page);
  // Fitness
  await page.getByRole('button', { name: 'Beginner', exact: true }).click();
  await page.getByLabel(/Full push-ups/).fill('9');
  await yes(page, /walk briskly/);
  await next(page);
  // Equipment
  await yes(page, /floor space/);
  await next(page);
  // Food
  await page.getByRole('button', { name: 'Non-vegetarian', exact: true }).click();
  await page.getByLabel(/don't eat/).fill('bitter gourd');
  await page.getByLabel('Meals per day').fill('3');
  await page.getByRole('button', { name: 'Simple recipes', exact: true }).click();
  await page.getByRole('button', { name: 'Tight', exact: true }).click();
  await page.getByRole('button', { name: 'Rarely', exact: true }).click();
  await next(page);
  // Goals
  await page.getByRole('button', { name: 'Fat loss' }).click();
  await page.getByRole('button', { name: 'Strength', exact: true }).click();
  await page.getByLabel(/Target weight/).fill('59');
  await expect(page.getByText('Target BMI 22.5')).toBeVisible();
  await next(page);
  // Pacing
  await page.getByRole('button', { name: /Balanced/ }).click();
  await page.getByRole('button', { name: 'Build my plan' }).click();
  await expect(page.getByRole('heading', { name: 'Your plan settings' })).toBeVisible();
}

async function onboard(page: Page, redFlag = false) {
  await startToAbout(page);
  await fillAbout(page);
  await answerSafety(page, redFlag);
  if (redFlag) {
    await expect(page.getByRole('heading', { name: 'Please see a doctor first' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue without workouts for now' }).click();
  }
  await finishRest(page);
}

test('full onboarding, today screen, weight and measurements', async ({ page }) => {
  await onboard(page);
  await expect(page.getByText('about 105 g a day (1.6 g/kg)')).toBeVisible();
  await expect(page.getByText(/about 20–27 weeks/)).toBeVisible();
  await page.getByRole('button', { name: 'Go to Today' }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Ahmed' })).toBeVisible();
  await expect(page.getByText('105 g')).toBeVisible();
  await expect(page.getByText('Indian cut-offs: Overweight', { exact: false })).toBeVisible();
  await expect(page.getByText("Today's weight is logged")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('today.png'), fullPage: true });

  await page.getByRole('button', { name: 'Body', exact: true }).click();
  await page.getByLabel('Waist (cm)').fill('81');
  await page.getByRole('button', { name: 'Save measurement' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');
  await expect(page.getByText('0.50')).toBeVisible();
  await page.getByLabel('Waist (cm)').fill('999');
  await expect(page.getByText('Between 15 and 250 cm.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save measurement' })).toBeDisabled();
});

test('under-18 cannot continue', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByLabel('Age (years)').fill('15');
  await expect(page.getByText('Forge is for adults only')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
});

test('impossible height is rejected', async ({ page }) => {
  await startToAbout(page);
  await page.getByLabel('Height (cm)').fill('300');
  await expect(page.getByText('Between 120 and 230 cm.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
});

test('incomplete safety screen blocks progress; pain asks where', async ({ page }) => {
  await startToAbout(page);
  await fillAbout(page);
  await no(page, /chest pain/);
  await expect(page.getByRole('button', { name: /Answer all 5/ })).toBeDisabled();
  await no(page, /fainted/);
  await no(page, /heart condition/);
  await no(page, /regular medicines/);
  await yes(page, /current pain/);
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Knee', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
});

test('red-flag answer locks workouts until clearance', async ({ page }) => {
  await onboard(page, true);
  await expect(page.getByText('Locked until medical clearance')).toBeVisible();
  await page.getByRole('button', { name: 'Go to Today' }).click();
  await expect(page.getByText('Workouts locked')).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'A doctor has cleared me to exercise' }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByText('Workouts locked')).toHaveCount(0);
});

test('lock, wrong passcode, unlock, data survives reload', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Go to Today' }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Ahmed' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByLabel('Passcode').fill('wrong-pass');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByText('Wrong passcode. Try again.')).toBeVisible();
  await page.getByLabel('Passcode').fill(PASS);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Ahmed' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Lock now' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('backup, erase, restore (wrong passcode and bad file rejected)', async ({ page }, info) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Go to Today' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download backup file' }).click()]);
  const path = info.outputPath('backup.json');
  await dl.saveAs(path);
  expect(readFileSync(path, 'utf8')).not.toContain('Hyderabad');

  await page.getByRole('button', { name: 'Delete all data on this device' }).click();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByRole('button', { name: 'Erase' }).click();
  await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible();

  await page.getByRole('button', { name: /Restore from a backup/ }).click();
  const bad = info.outputPath('bad.json');
  writeFileSync(bad, '{"not":"forge"}');
  await page.getByTestId('restore-file').setInputFiles(bad);
  await expect(page.getByRole('alert')).toHaveText('This is not a Forge backup file.');
  await page.getByTestId('restore-file').setInputFiles(path);
  await page.getByLabel('Passcode used for that backup').fill('nope-nope');
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Wrong passcode for this backup.');
  await page.getByLabel('Passcode used for that backup').fill(PASS);
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Ahmed' })).toBeVisible();
});

test('no sideways scrolling on any screen size', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Go to Today' }).click();
  for (const tab of ['Today', 'Body', 'Settings']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${tab} overflows`).toBeLessThanOrEqual(0);
  }
});

test('opens offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible();
  await context.setOffline(false);
});
