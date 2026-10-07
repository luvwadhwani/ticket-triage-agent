// top bar test helpers v1. The canonical copy lives in luvwadhwani/portfolio-hub (tests/e2e/bar.ts). Copy it unchanged into each project.
import type { Page } from '@playwright/test';

const bar = (page: Page) => page.getByRole('banner');

/** The colour-mode menu: Light, Dark and Match device. */
export const openColourMenu = (page: Page) => bar(page).getByRole('button', { name: 'Colour mode' }).click();

/** Opens the colour-mode menu and picks a mode; the menu closes after the choice. */
export async function chooseColour(page: Page, mode: 'Light' | 'Dark' | 'Match device') {
  await openColourMenu(page);
  await bar(page).getByRole('button', { name: mode }).click();
}

/** The account menu, behind the avatar: who's signed in, All projects, Admin (admin only) and Sign out. */
export const openAccountMenu = (page: Page) => bar(page).getByRole('button', { name: /^Signed in as / }).click();
