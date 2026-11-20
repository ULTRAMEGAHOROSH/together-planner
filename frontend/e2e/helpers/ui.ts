// The few steps every spec needs on the screen itself.
import { expect, type Page } from '@playwright/test';
import type { TestUser } from './api';

/**
 * Signs in on `/login` like a person: e-mail, password, «Войти». Waits for the schedule of a
 * user who has a workspace (`/week/...`). The browser then keeps its own session.
 */
export async function loginViaUi(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Пароль').fill(user.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/week\//);
}

/** Fills the registration form of `/register` (also after the redirect from an invite link). */
export async function registerViaUi(
  page: Page,
  credentials: { email: string; password: string; displayName: string },
): Promise<void> {
  await page.getByLabel('Как вас зовут').fill(credentials.displayName);
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Пароль').fill(credentials.password);
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
}
