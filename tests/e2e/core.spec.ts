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
  await expect(page.getByRole('status')).toHaveText(/^Saved\./);
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
  for (const tab of ['Today', 'Train', 'Body', 'Settings']) {
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

test('body: all six measurements save, including comma decimals', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Go to Today' }).click();
  await page.getByRole('button', { name: 'Body', exact: true }).click();
  const vals: [string, string][] = [['Waist (cm)', '81,5'], ['Hip (cm)', '94'], ['Chest (cm)', '92.5'], ['Upper arm (cm)', '28'], ['Thigh (cm)', '52'], ['Neck (cm)', '35']];
  for (const [label, v] of vals) {
    await page.getByLabel(label).click();
    await page.keyboard.type(v);
  }
  await page.screenshot({ path: test.info().outputPath('body-filled.png'), fullPage: false });
  await expect(page.getByRole('button', { name: 'Save measurement' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save measurement' }).click();
  await expect(page.getByRole('status')).toHaveText(/^Saved\./);
  await expect(page.getByText('waist 81.5 · hip 94 · chest 92.5 · arm 28 · thigh 52 · neck 35')).toBeVisible();
});

test('body: reuse an earlier entry and see progress', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Go to Today' }).click();
  await expect(page.getByText('65.5 → 59 kg')).toBeVisible();
  await page.getByRole('button', { name: 'Body', exact: true }).click();
  await page.getByLabel('Waist (cm)').fill('81.5');
  await page.getByLabel('Neck (cm)').fill('35');
  await page.getByRole('button', { name: 'Save measurement' }).click();
  await expect(page.getByRole('status')).toHaveText(/^Saved\./);
  await page.getByRole('button', { name: /Use numbers from/ }).first().click();
  await expect(page.getByLabel('Waist (cm)')).toHaveValue('81.5');
  await expect(page.getByLabel('Neck (cm)')).toHaveValue('35');
  await page.getByLabel('Waist (cm)').fill('80');
  await page.getByRole('button', { name: 'Save measurement' }).click();
  await expect(page.getByText('81.5 → 80')).toBeVisible();
  await expect(page.getByText('(−1.5)')).toBeVisible();
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: /Delete measurement from/ }).first().click();
  await expect(page.getByText('81.5 → 80')).toBeVisible();
});

test('workout player: auto timers, one-tap done, rest +30, feel, progression', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-09T18:00:00') }); // a Monday, one of the chosen days
  await onboard(page);
  await page.getByRole('button', { name: 'Go to Today' }).click();
  await expect(page.getByText(/Workout A · about \d+ min/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('today-workout.png') });
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout A' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('overview.png'), fullPage: true });
  await expect(page.getByText('2 × 6')).toBeVisible(); // week 1: 2 sets, push-ups from the 9-rep test
  await page.getByRole('button', { name: 'Start workout' }).click();

  // Timed warm-up: 3-2-1 get-ready, then the move's own countdown starts by itself.
  await expect(page.getByRole('heading', { name: 'March on the spot' })).toBeVisible();
  await expect(page.getByText('Get ready…')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('warm-ready.png') });
  await page.clock.fastForward(5100);
  await expect(page.getByTestId('timer')).toHaveText(/^(60|59)$/);
  await page.clock.fastForward(60_500);
  await expect(page.getByRole('heading', { name: 'Arm circles' })).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Skip', exact: true }).click();

  // Reps: one tap, then rest starts at 30 s by itself.
  await expect(page.getByRole('heading', { name: 'Push-up' })).toBeVisible();
  await expect(page.getByText('Exercise 1 of 5 · Set 1 of 2')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Demo: Push-up' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('reps.png') });
  await page.getByRole('button', { name: 'Done: 6 reps' }).click();
  await expect(page.getByTestId('timer')).toHaveText(/^(30|29)$/);
  await page.getByRole('button', { name: '+30 s' }).click();
  await expect(page.getByTestId('timer')).toHaveText(/^(60|59)$/);
  await page.getByRole('button', { name: 'Skip rest' }).click();

  // Different number, then feel during the rest, and the rest ends by itself.
  await page.getByRole('button', { name: 'Did a different number?' }).click();
  await page.getByRole('button', { name: 'One more' }).click();
  await page.getByRole('button', { name: 'One more' }).click();
  await page.getByRole('button', { name: 'Save 8 reps' }).click();
  await page.getByRole('group', { name: 'How did Push-up feel?' }).getByRole('button', { name: 'Easy' }).click();
  await page.screenshot({ path: test.info().outputPath('rest-feel.png') });
  await page.clock.fastForward(31_000);
  await expect(page.getByRole('heading', { name: 'Bodyweight squat' })).toBeVisible();

  await page.getByRole('button', { name: 'End', exact: true }).click();
  await page.getByRole('button', { name: 'End workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout saved' })).toBeVisible();
  await expect(page.getByText(/Push-up: every set done .* goes up to 8 reps/)).toBeVisible();
  await page.getByRole('button', { name: 'Back to Today' }).click();
  await expect(page.getByText('Workout A done. Nice work.')).toBeVisible();
  await page.getByRole('button', { name: 'Train', exact: true }).click();
  await expect(page.getByText('2026-11-09 · Workout A')).toBeVisible();
  await expect(page.getByText('Workout B · next')).toBeVisible();
});

test('pain button stops the exercise and makes it easier next time', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-09T18:00:00') });
  await onboard(page);
  await page.getByRole('button', { name: 'Go to Today' }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: 'This hurts: stop this exercise' }).click();
  await expect(page.getByText('Stopped that exercise')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bodyweight squat' })).toBeVisible();
  await page.getByRole('button', { name: 'End', exact: true }).click();
  await page.getByRole('button', { name: 'End workout' }).click();
  await expect(page.getByText(/Push-up hurt, so next time it's Knee push-up instead/)).toBeVisible();
});
