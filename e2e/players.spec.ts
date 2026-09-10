import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Player } from '../src/app/features/players/models/player.model';

// Exercise the actual imported listone, including names and secondary values, without duplicating it in fixtures.
const players = JSON.parse(readFileSync(resolve('public/data/players.json'), 'utf8')) as Player[];
const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it')
    .trim();
const compareNames = new Intl.Collator('it', { sensitivity: 'base', numeric: true }).compare;
const roleLabels = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' } as const;
const uniquePlayer =
  players.find((candidate) => {
    const query = normalize(candidate.name);
    return (
      players.filter((player) => normalize(`${player.name} ${player.team}`).includes(query))
        .length === 1
    );
  }) ?? players[0];
const multiRolePlayer = players.find((player) => player.roles.length > 1) ?? uniquePlayer;
const teams = [...new Set(players.map((player) => player.team))].sort(compareNames);

test.afterEach(async ({ page }) => {
  // An open modal must not prevent a test context from closing cleanly.
  if (!page.isClosed()) await page.keyboard.press('Escape');
});

async function openList(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await expect(page.locator('[aria-label="Caricamento calciatori"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Impossibile caricare il listone.' })).toHaveCount(
    0,
  );
  await expect(page.locator('app-player-card, app-players-table').first()).toBeAttached();
}

function cards(page: Page) {
  return page.locator('app-player-card');
}

function filterTrigger(page: Page) {
  return page.locator('button[aria-controls="filter-dialog"]');
}

function resultCount(page: Page) {
  return page.locator('#players-results [aria-live="polite"] strong');
}

async function expectQuery(page: Page, expected: Record<string, string | null>): Promise<void> {
  await expect
    .poll(() => {
      const params = new URL(page.url()).searchParams;
      return Object.fromEntries(Object.keys(expected).map((key) => [key, params.get(key)]));
    })
    .toEqual(expected);
}

test('mobile a 320 px: nessun overflow, ricerca immediata e valori originali espandibili', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openList(page);
  await expect(cards(page)).toHaveCount(players.length);
  await expect(resultCount(page)).toHaveText(String(players.length));
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png' });

  const macroButtons = page
    .getByRole('navigation', { name: 'Filtra per macro ruolo' })
    .getByRole('button');
  for (const button of await macroButtons.all()) {
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }

  const query = `  ${normalize(uniquePlayer.name).toUpperCase()}  `;
  await page.getByRole('searchbox', { name: 'Cerca per nome o squadra' }).fill(query);
  await expect(cards(page)).toHaveCount(1);
  const card = cards(page).first();
  await expect(card).toContainText(uniquePlayer.name);
  await expect(card).toContainText(uniquePlayer.team);
  const toggle = card.getByRole('button');
  await expect(toggle).toHaveAccessibleName(
    new RegExp(`FVM ${uniquePlayer.fvm.value}, quotazione ${uniquePlayer.quotation.value}`),
  );
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const details = card.locator('dl');
  await expect(details).toContainText(`${uniquePlayer.macroRole}(${uniquePlayer.roles.join(',')})`);
  await expect(
    details
      .locator('div')
      .filter({ has: page.locator('dt', { hasText: /^FVM secondario$/ }) })
      .locator('dd'),
  ).toHaveText(String(uniquePlayer.fvm.secondaryValue ?? '—'));
  await expect(
    details
      .locator('div')
      .filter({ has: page.locator('dt', { hasText: /^Quotazione secondaria$/ }) })
      .locator('dd'),
  ).toHaveText(String(uniquePlayer.quotation.secondaryValue ?? '—'));
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test('macro ruolo, sottoruoli multipli, squadre e intervalli si combinano e aggiornano la URL', async ({
  page,
}) => {
  const target = multiRolePlayer;
  const otherTeam = teams.find((team) => team !== target.team)!;
  const selectedTeams = [target.team, otherTeam];
  const minFvm = Math.max(0, target.fvm.value - 1);
  const maxFvm = target.fvm.value + 1;
  const minQuotation = Math.max(0, target.quotation.value - 1);
  const maxQuotation = target.quotation.value + 1;
  const expected = players
    .filter(
      (player) =>
        player.macroRole === target.macroRole &&
        player.roles.some((role) => target.roles.includes(role)) &&
        selectedTeams.includes(player.team) &&
        player.fvm.value >= minFvm &&
        player.fvm.value <= maxFvm &&
        player.quotation.value >= minQuotation &&
        player.quotation.value <= maxQuotation,
    )
    .sort((a, b) => b.fvm.value - a.fvm.value || compareNames(a.name, b.name));

  await openList(page);
  await page.getByRole('button', { name: roleLabels[target.macroRole], exact: true }).click();
  await filterTrigger(page).click();
  const dialog = page.getByRole('dialog', { name: 'Filtri' });
  const actualRoles = [
    ...new Set(
      players
        .filter((player) => player.macroRole === target.macroRole)
        .flatMap((player) => player.roles),
    ),
  ].sort(compareNames);
  await expect(dialog.locator('button[aria-pressed]')).toHaveText(actualRoles);
  for (const role of target.roles) {
    await dialog.getByRole('button', { name: role, exact: true }).click();
  }
  for (const team of selectedTeams) {
    await dialog.getByRole('searchbox', { name: 'Cerca squadra' }).fill(normalize(team));
    await dialog.getByRole('checkbox', { name: team, exact: true }).check();
  }
  await dialog.getByRole('spinbutton', { name: 'FVM minimo', exact: true }).fill(String(minFvm));
  await dialog.getByRole('spinbutton', { name: 'FVM massimo', exact: true }).fill(String(maxFvm));
  await dialog
    .getByRole('spinbutton', { name: 'Quot. minima', exact: true })
    .fill(String(minQuotation));
  await dialog
    .getByRole('spinbutton', { name: 'Quot. massima', exact: true })
    .fill(String(maxQuotation));
  await dialog.getByRole('button', { name: 'Applica', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('combobox', { name: 'Ordinamento' }).selectOption('fvm-desc');

  await expect(cards(page)).toHaveCount(expected.length);
  await expect(resultCount(page)).toHaveText(String(expected.length));
  await expect(cards(page).first()).toContainText(expected[0].name);
  await expectQuery(page, {
    role: target.macroRole,
    roles: target.roles.join(','),
    team: selectedTeams.join(','),
    minFvm: String(minFvm),
    maxFvm: String(maxFvm),
    minQuotation: String(minQuotation),
    maxQuotation: String(maxQuotation),
    sort: 'fvm-desc',
  });
  await expect(
    page.getByRole('button', { name: `Rimuovi filtro ${target.team}`, exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: `Rimuovi filtro ${otherTeam}`, exact: true }).click();
  await expectQuery(page, { team: target.team });
});

test('una URL completa ripristina tutti i filtri anche al refresh e consente il reset', async ({
  page,
}) => {
  const target = uniquePlayer;
  const params = new URLSearchParams({
    role: target.macroRole,
    roles: target.roles.join(','),
    team: target.team,
    q: target.name,
    minFvm: String(target.fvm.value),
    maxFvm: String(target.fvm.value),
    minQuotation: String(target.quotation.value),
    maxQuotation: String(target.quotation.value),
    sort: 'quotation-desc',
  });
  await openList(page, `?${params}`);
  await expect(cards(page)).toHaveCount(1);
  await page.reload();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText(target.name);
  await expect(page.getByRole('searchbox', { name: 'Cerca per nome o squadra' })).toHaveValue(
    target.name,
  );
  await expect(page.getByRole('combobox', { name: 'Ordinamento' })).toHaveValue('quotation-desc');
  await expect(
    page.getByRole('button', { name: roleLabels[target.macroRole], exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await filterTrigger(page).click();
  const dialog = page.getByRole('dialog', { name: 'Filtri' });
  for (const role of target.roles) {
    await expect(dialog.getByRole('button', { name: role, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
  await expect(dialog.getByRole('checkbox', { name: target.team, exact: true })).toBeChecked();
  await expect(dialog.getByRole('spinbutton', { name: 'FVM minimo', exact: true })).toHaveValue(
    String(target.fvm.value),
  );
  await expect(dialog.getByRole('spinbutton', { name: 'FVM massimo', exact: true })).toHaveValue(
    String(target.fvm.value),
  );
  await expect(dialog.getByRole('spinbutton', { name: 'Quot. minima', exact: true })).toHaveValue(
    String(target.quotation.value),
  );
  await expect(dialog.getByRole('spinbutton', { name: 'Quot. massima', exact: true })).toHaveValue(
    String(target.quotation.value),
  );
  await page.keyboard.press('Escape');
  await page
    .locator('#players-results')
    .getByRole('button', { name: 'Reset', exact: true })
    .click();
  await expect(cards(page)).toHaveCount(players.length);
  await expect(page.getByRole('searchbox', { name: 'Cerca per nome o squadra' })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Ordinamento' })).toHaveValue('original');
  await expect.poll(() => new URL(page.url()).search).toBe('');
});

test('il drawer trattiene il focus, blocca lo scroll e annulla la bozza con Escape', async ({
  page,
}) => {
  await openList(page);
  const trigger = filterTrigger(page);
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Filtri' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('position', 'fixed');
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  const close = dialog.getByRole('button', { name: 'Chiudi filtri' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Applica', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await dialog.getByRole('checkbox', { name: teams[0], exact: true }).check();
  await expect(cards(page)).toHaveCount(players.length);
  await expect.poll(() => new URL(page.url()).search).toBe('');
  await page.keyboard.press('Escape');

  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await trigger.click();
  await expect(dialog.getByRole('checkbox', { name: teams[0], exact: true })).not.toBeChecked();
});

test('il backdrop e il pulsante chiudi annullano senza applicare la bozza', async ({ page }) => {
  await openList(page);
  await filterTrigger(page).click();
  const dialog = page.getByRole('dialog', { name: 'Filtri' });
  await dialog.getByRole('spinbutton', { name: 'FVM minimo', exact: true }).fill('100');
  await page.mouse.click(10, 10);
  await expect(dialog).not.toBeVisible();
  await expect.poll(() => new URL(page.url()).search).toBe('');
  await filterTrigger(page).click();
  await expect(dialog.getByRole('spinbutton', { name: 'FVM minimo', exact: true })).toHaveValue('');
  await dialog.getByRole('spinbutton', { name: 'FVM minimo', exact: true }).fill('100');
  await dialog.getByRole('button', { name: 'Chiudi filtri' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(cards(page)).toHaveCount(players.length);
});

test('intervalli non validi impediscono Applica; Reset resta in bozza fino alla conferma', async ({
  page,
}) => {
  const team = teams[0];
  await openList(page, `?team=${encodeURIComponent(team)}`);
  const expectedTeamCount = players.filter((player) => player.team === team).length;
  await expect(cards(page)).toHaveCount(expectedTeamCount);
  await filterTrigger(page).click();
  const dialog = page.getByRole('dialog', { name: 'Filtri' });
  const apply = dialog.getByRole('button', { name: 'Applica', exact: true });
  await dialog.getByRole('spinbutton', { name: 'FVM minimo', exact: true }).fill('50');
  await dialog.getByRole('spinbutton', { name: 'FVM massimo', exact: true }).fill('10');
  await expect(apply).toBeDisabled();
  await expect(dialog.getByRole('spinbutton', { name: 'FVM minimo', exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(
    dialog.getByText('Il FVM minimo deve essere minore o uguale al massimo.'),
  ).toBeVisible();
  await dialog.getByRole('spinbutton', { name: 'FVM massimo', exact: true }).fill('');
  await expect(apply).toBeEnabled();
  await dialog.getByRole('spinbutton', { name: 'Quot. minima', exact: true }).fill('30');
  await dialog.getByRole('spinbutton', { name: 'Quot. massima', exact: true }).fill('5');
  await expect(apply).toBeDisabled();
  await dialog.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(apply).toBeEnabled();
  await expect(dialog.getByRole('checkbox', { name: team, exact: true })).not.toBeChecked();
  await expect(dialog.getByRole('spinbutton', { name: 'FVM minimo', exact: true })).toHaveValue('');
  await expect(cards(page)).toHaveCount(expectedTeamCount);
  await expectQuery(page, { team });
  await apply.click();
  await expect(cards(page)).toHaveCount(players.length);
  await expectQuery(page, {
    team: null,
    minFvm: null,
    maxFvm: null,
    minQuotation: null,
    maxQuotation: null,
  });
});

test('tema chiaro e scuro persistono; Automatico segue il sistema', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openList(page);
  const theme = page.getByRole('combobox', { name: 'Tema', exact: true });
  await expect(theme).toHaveValue('system');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await theme.selectOption('light');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('fantalist-theme')))
    .toBe('light');
  await page.reload();
  await expect(theme).toHaveValue('light');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await theme.selectOption('dark');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(theme).toHaveValue('dark');
  await expect(cards(page).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/dark.png' });
  await theme.selectOption('system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('desktop 1280 px: tabella densa, sidebar, ordinamento e intestazione sticky', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openList(page);
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Filtri' })).toBeVisible();
  await expect(cards(page).first()).not.toBeVisible();
  await expect(table.locator('tbody > tr')).toHaveCount(players.length);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: 'test-results/desktop.png' });

  const fvmHeader = table.locator('thead th').nth(4);
  const fvmSort = fvmHeader.getByRole('button');
  await fvmSort.click();
  await expect(fvmHeader).toHaveAttribute('aria-sort', 'descending');
  await expect(table.locator('tbody > tr').first().locator('td').nth(3)).toHaveText(
    String(Math.max(...players.map((player) => player.fvm.value))),
  );
  await expectQuery(page, { sort: 'fvm-desc' });
  await fvmSort.click();
  await expect(fvmHeader).toHaveAttribute('aria-sort', 'ascending');
  await expect(table.locator('tbody > tr').first().locator('td').nth(3)).toHaveText(
    String(Math.min(...players.map((player) => player.fvm.value))),
  );
  await fvmSort.click();
  await expect(fvmHeader).toHaveAttribute('aria-sort', 'none');
  await expectQuery(page, { sort: null });

  const quotationHeader = table.locator('thead th').nth(5);
  await quotationHeader.getByRole('button').click();
  await expect(quotationHeader).toHaveAttribute('aria-sort', 'descending');
  await expect(table.locator('tbody > tr').first().locator('td').nth(4)).toHaveText(
    String(Math.max(...players.map((player) => player.quotation.value))),
  );
  const nameHeader = table.locator('thead th').first();
  await nameHeader.getByRole('button').click();
  await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
  const alphabetical = [...players].sort((a, b) => compareNames(a.name, b.name));
  await expect(table.locator('tbody th').first()).toContainText(alphabetical[0].name);
  await nameHeader.getByRole('button').click();
  await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
  await expect(table.locator('tbody th').first()).toContainText(
    alphabetical[alphabetical.length - 1].name,
  );

  await page.evaluate(() => window.scrollTo(0, 700));
  await expect
    .poll(() =>
      table.locator('thead').evaluate((element) => Math.round(element.getBoundingClientRect().top)),
    )
    .toBe(74);
  await expect
    .poll(() =>
      page
        .getByRole('complementary', { name: 'Filtri' })
        .evaluate((element) => Math.round(element.getBoundingClientRect().top)),
    )
    .toBe(90);
});

test('skeleton mobile e righe skeleton desktop durante il caricamento del JSON', async ({
  page,
}) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    let release!: () => void;
    const pending = new Promise<void>((resolvePending) => {
      release = resolvePending;
    });
    await page.route('**/data/players.json', async (route) => {
      await pending;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(players),
      });
    });
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const skeleton = page.locator('[aria-label="Caricamento calciatori"]');
      await expect(skeleton).toBeVisible();
      await expect(skeleton).toHaveAttribute('aria-busy', 'true');
      await page.screenshot({ path: `test-results/loading-${width}.png` });
      await expect(skeleton.locator('[aria-hidden="true"]')).toHaveCount(9);
      if (width === 1280) await expect(skeleton.getByText('Nome', { exact: true })).toBeVisible();
      release();
      await expect(skeleton).toHaveCount(0);
      if (width < 1024) await expect(cards(page)).toHaveCount(players.length);
      else await expect(page.locator('app-players-table tbody > tr')).toHaveCount(players.length);
    } finally {
      release();
      await page.unroute('**/data/players.json');
    }
  }
});

test('errore JSON recuperabile con Riprova senza ricaricare la pagina', async ({ page }) => {
  let requests = 0;
  await page.route('**/data/players.json', async (route) => {
    requests += 1;
    await route.fulfill(
      requests === 1
        ? { status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }
        : { status: 200, contentType: 'application/json', body: JSON.stringify(players) },
    );
  });
  await page.goto('/');
  const error = page.getByRole('alert');
  await expect(error).toBeVisible();
  await page.screenshot({ path: 'test-results/error.png' });
  await expect(
    error.getByRole('heading', { name: 'Impossibile caricare il listone.' }),
  ).toBeVisible();
  await error.getByRole('button', { name: 'Riprova', exact: true }).click();
  await expect(error).toHaveCount(0);
  await expect(cards(page)).toHaveCount(players.length);
  expect(requests).toBe(2);
});

test('nessun risultato mostra il conteggio zero e Reset filtri ripristina il listone', async ({
  page,
}) => {
  await openList(page);
  await page
    .getByRole('searchbox', { name: 'Cerca per nome o squadra' })
    .fill('nessun-calciatore-corrisponde-xyz-000');
  await expect(page.getByRole('heading', { name: 'Nessun calciatore trovato' })).toBeVisible();
  await page.screenshot({ path: 'test-results/empty.png' });
  await expect(resultCount(page)).toHaveText('0');
  await expect(cards(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset filtri', exact: true }).click();
  await expect(cards(page)).toHaveCount(players.length);
  await expect(resultCount(page)).toHaveText(String(players.length));
  await expect(page.getByRole('searchbox', { name: 'Cerca per nome o squadra' })).toHaveValue('');
});

test('stato asta reversibile: persistenza, filtri, refresh e passaggio card-tabella', async ({
  page,
}) => {
  await openList(page);
  const status = page.getByRole('combobox', {
    name: `Stato asta di ${uniquePlayer.name}`,
    exact: true,
  });
  await expect(status).toHaveValue('available');
  await status.selectOption('called');
  await page.reload();
  await expect(status).toHaveValue('called');
  await status.selectOption('purchased');
  await page.getByRole('searchbox', { name: 'Cerca per nome o squadra' }).fill(uniquePlayer.name);
  await expect(cards(page)).toHaveCount(1);
  await expect(status).toHaveValue('purchased');
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole('table')).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
  await expect(status).toHaveValue('purchased');
  await page.reload();
  await expect(status).toHaveValue('purchased');
  await page
    .locator('#players-results')
    .getByRole('button', { name: 'Reset', exact: true })
    .click();
  await expect(status).toHaveValue('purchased');
  await status.selectOption('available');
  await page.reload();
  await expect(status).toHaveValue('available');
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('fantalist-auction-2026-27') ?? '{}'),
  );
  expect(saved.statuses[uniquePlayer.id]).toBeUndefined();
});

test('lo stato asta si aggiorna tra due schede dello stesso browser', async ({ page, context }) => {
  await openList(page);
  const second = await context.newPage();
  await openList(second);
  const name = `Stato asta di ${uniquePlayer.name}`;
  await page.getByRole('combobox', { name, exact: true }).selectOption('called');
  await expect(second.getByRole('combobox', { name, exact: true })).toHaveValue('called');
  await second.getByRole('combobox', { name, exact: true }).selectOption('purchased');
  await expect(page.getByRole('combobox', { name, exact: true })).toHaveValue('purchased');
  await second.close();
});

test('storage non disponibile: cambio stato utilizzabile e avviso esplicito', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Blocked', 'QuotaExceededError');
    };
  });
  await openList(page);
  const status = page.getByRole('combobox', {
    name: `Stato asta di ${uniquePlayer.name}`,
    exact: true,
  });
  await status.selectOption('purchased');
  await expect(status).toHaveValue('purchased');
  await expect(
    page.getByRole('status').filter({ hasText: 'Il browser non consente il salvataggio' }),
  ).toBeVisible();
});

test('tablet e desktop stretto: nessun overflow, toolbar sticky e una sola vista renderizzata', async ({
  page,
}) => {
  await openList(page);
  for (const width of [360, 640, 768, 1023, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (width < 1024) {
      await expect(cards(page)).toHaveCount(players.length);
      await expect(page.locator('app-players-table')).toHaveCount(0);
    } else {
      await expect(cards(page)).toHaveCount(0);
      await expect(page.locator('app-players-table tbody > tr')).toHaveCount(players.length);
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.evaluate(() => window.scrollTo(0, 750));
    const search = page.getByRole('searchbox', { name: 'Cerca per nome o squadra' });
    await expect
      .poll(() => search.evaluate((element) => Math.round(element.getBoundingClientRect().top)))
      .toBe(width < 1024 ? 13 : 15);
    if (width === 768) {
      await page.screenshot({ path: 'test-results/tablet.png' });
      await filterTrigger(page).click();
      await page.setViewportSize({ width: 1024, height: 900 });
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  }
});

test('accessibilità WCAG AA in light, dark, card, tabella e bottom sheet', async ({ page }) => {
  test.setTimeout(120_000);
  await openList(page, `?q=${encodeURIComponent(uniquePlayer.name)}`);
  for (const width of [320, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ['light', 'dark']) {
      await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption(theme);
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(audit.violations, `${width}px ${theme}: ${JSON.stringify(audit.violations)}`).toEqual(
        [],
      );
      if (width === 320) {
        await filterTrigger(page).click();
        const modal = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(modal.violations, `dialog ${theme}: ${JSON.stringify(modal.violations)}`).toEqual(
          [],
        );
        await page.screenshot({ path: `test-results/drawer-${theme}.png` });
        await page.keyboard.press('Escape');
      } else {
        await page.screenshot({ path: `test-results/desktop-${theme}.png` });
      }
    }
  }
});
