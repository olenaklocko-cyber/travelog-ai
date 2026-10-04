import { expect, test, type Page } from "@playwright/test";

/**
 * E2E: робот клацає як користувач.
 * Supabase мокаємо — тест не має створювати реальних акаунтів
 * і не залежить від мережі.
 */
const mokSupabase = async (page: Page) => {
  await page.route("**/auth/v1/**", async (route) => {
    const url = route.request().url();

    if (url.includes("signup")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "e2e-user",
            aud: "authenticated",
            role: "authenticated",
            email: "olena+e2e@example.com",
            email_confirmed_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          session: null,
        }),
      });
      return;
    }

    if (url.includes("grant_type=password")) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "invalid_grant",
          error_description: "Invalid login credentials",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
};

test("реєстрація: робот заповнює форму і бачить «Перевірте пошту»", async ({
  page,
}) => {
  await mokSupabase(page);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Вхід до тревелогу/ })
  ).toBeVisible();

  await page.getByText("Реєстрація").click();
  await page.getByPlaceholder("your@email.com").fill("olena+e2e@example.com");
  await page.getByPlaceholder("Мінімум 6 символів").fill("nadyznyj-parol");
  await page.getByRole("button", { name: "Зареєструватися" }).click();

  await expect(page.getByRole("heading", { name: /Перевірте пошту/ })).toBeVisible();
  await expect(page.getByText(/надіслали вам лист/i)).toBeVisible();

  await page.getByRole("button", { name: "Повернутись до входу" }).click();
  await expect(page.getByRole("button", { name: "Увійти" })).toBeVisible();
});

test("невірний пароль показує українську підказку, а не англійську", async ({
  page,
}) => {
  await mokSupabase(page);
  await page.goto("/");

  await page.getByPlaceholder("your@email.com").fill("olena@example.com");
  await page.getByPlaceholder("Мінімум 6 символів").fill("ne-takyj-parol");
  await page.getByRole("button", { name: "Увійти" }).click();

  await expect(page.getByText("Невірний email або пароль")).toBeVisible();
  await expect(page.getByText("Invalid login credentials")).toHaveCount(0);
});

test("підказка: користувач одразу бачить, куди натискати", async ({ page }) => {
  await mokSupabase(page);
  await page.goto("/");
  // три кроки з'являються ДО форми (за відгуком «не розумію куди нажати»)
  await expect(page.getByText(/Введіть email і пароль/)).toBeVisible();
  await expect(page.getByText(/Усередині — ваші подорожі/)).toBeVisible();
  await expect(page.getByText(/напишіть відгук/)).toBeVisible();
});
