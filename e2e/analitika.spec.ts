import { expect, test, type Page } from "@playwright/test";

/**
 * E2E: аналітика відвідувань + анонімний відгук.
 * Мокаємо API — тест нічого не пише у справжню базу.
 */

interface Perehopleno {
  url: string;
  tilo?: unknown;
}

const lovyty = (page: Page, shlyah: string, kod = 200, vidpovid = {}) => {
  const zapyty: Perehopleno[] = [];
  const shlyahShyrokyy =
    shlyah === "/api/analytics/visit" || shlyah === "/api/feedback"
      ? `**${shlyah}`
      : `**${shlyah}*`;
  void page.route(shlyahShyrokyy, async (route) => {
    const tilo = route.request().postDataJSON();
    zapyty.push({ url: route.request().url(), tilo });
    await route.fulfill({
      status: kod,
      contentType: "application/json",
      body: JSON.stringify(vidpovid),
    });
  });
  return zapyty;
};

/** Успішний вхід: мокаємо, що Supabase повернув сесію. */
const mokSesiya = async (page: Page) => {
  await page.route("**/auth/v1/**", async (route) => {
    const url = route.request().url();
    const teper = new Date().toISOString();
    if (url.includes("grant_type=password")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "e2e-access",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "e2e-refresh",
          user: {
            id: "e2e-user",
            aud: "authenticated",
            email: "olenaklocko@gmail.com",
            email_confirmed_at: teper,
            created_at: teper,
            updated_at: teper,
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_token: "e2e-access", user: {} }),
    });
  });
};

test("відвідування фіксується: робот відкриває сторінку — запит пішов", async ({
  page,
}) => {
  const vizyty = lovyty(page, "/api/analytics/visit", 200, { ok: true });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Вхід до тревелогу/ })
  ).toBeVisible();
  await expect.poll(() => vizyty.length).toBeGreaterThan(0);
  expect(vizyty[0].tilo).toMatchObject({ shlyah: "/" });
});

test("анонімний відгук: форму заповнено, надіслано, бачимо «Дякуємо»", async ({
  page,
}) => {
  const vidhuky = lovyty(page, "/api/feedback", 201, { ok: true });
  await page.goto("/");
  await page.getByTestId("pole-vidhuku").fill("Дуже зручний застосунок!");
  await page.getByRole("button", { name: /Надіслати анонімно/ }).click();

  await expect(page.getByText(/Дякуємо! Відгук надіслано/i)).toBeVisible();
  await expect.poll(() => vidhuky.length).toBe(1);
  expect(vidhuky[0].tilo).toMatchObject({
    teks: "Дуже зручний застосунок!",
  });
});

test("закороткий відгук не надсилається, кнопка вимкнена", async ({ page }) => {
  const vidhuky = lovyty(page, "/api/feedback", 201, {});
  await page.goto("/");
  await page.getByTestId("pole-vidhuku").fill("аб");
  await expect(page.getByRole("button", { name: /Надіслати/ })).toBeDisabled();
  expect(vidhuky).toHaveLength(0);
});

test("власник бачить графік: кнопка з головної веде на /analityka", async ({
  page,
}) => {
  await mokSesiya(page);
  const stats = lovyty(page, "/api/analytics/stats", 200, {
    dni: [
      { den: "2026-10-03", unikalni: 2, zapysiv: 4 },
      { den: "2026-10-04", unikalni: 5, zapysiv: 9 },
    ],
    vsogoUnikalnyh: 7,
    vsogoZapysiv: 13,
    denOstanniy: "2026-10-04",
  });
  lovyty(page, "/api/feedback", 200, {
    vidhuky: [
      {
        id: 1,
        teks: "Бракує карти",
        chas: "2026-10-04T10:00:00Z",
        opraciovano: false,
      },
    ],
  });
  lovyty(page, "/api/analytics/visit", 200, { ok: true });

  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill("olenaklocko@gmail.com");
  await page.getByPlaceholder("Мінімум 6 символів").fill("e2e-parol-1");
  await page.getByRole("button", { name: "Увійти" }).click();

  await page.getByRole("link", { name: /Графік відвідувань/ }).click();
  await expect(page.getByRole("heading", { name: /Аналітика/ })).toBeVisible();

  // цифри підсумків (кожна у своїй картці)
  const pidsumok = (nazva: string) =>
    page.locator(".ant-statistic").filter({ hasText: nazva });
  await expect(pidsumok("Унікальних відвідувачів")).toContainText("7");
  await expect(pidsumok("Заходів на сайт")).toContainText("13");
  await expect(pidsumok("Відгуків")).toContainText("1");
  // графік і відгук на місці
  await expect(
    page.getByText("Відвідуваність по днях")
  ).toBeVisible();
  await expect(page.getByText("Бракує карти")).toBeVisible();
  await expect.poll(() => stats.length).toBeGreaterThan(0);
});
