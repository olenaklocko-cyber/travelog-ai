import { describe, it, expect, vi, afterEach } from "vitest";
import { obrotyty, type ZapitHTTP } from "./server";

/**
 * Виклик ендпоінта так, як це зробить Vercel: тіло вже розібране у req.body,
 * а шлях передається окремо (`shlyah`). Повертаємо код і тіло відповіді.
 */
const viklikaty = async (zapit: {
  shlyah: string;
  method?: string;
  tilo?: unknown;
  tokyn?: string;
}): Promise<{ kod?: number; tilo?: string }> => {
  const stav: { kod?: number; tilo?: string } = {};
  await new Promise<void>((r) => {
    const res = {
      writeHead: (kod: number) => {
        stav.kod = kod;
        return res;
      },
      setHeader: () => undefined,
      end: (tilo?: string) => {
        stav.tilo = tilo;
        r();
      },
    };
    obrotyty(
      {
        url: zapit.shlyah,
        method: zapit.method ?? "GET",
        headers: zapit.tokyn ? { authorization: `Bearer ${zapit.tokyn}` } : {},
        body: zapit.tilo,
      } as unknown as ZapitHTTP,
      res as never,
      zapit.shlyah
    );
  });
  return stav;
};

/** Мок Supabase: ловимо запити сервера до бази, у мережу не йдемо. */
const supabaseVyklyky: {
  url: string;
  tilo?: unknown;
  zagolovky?: Record<string, string>;
}[] = [];
const supabaseOtvity = (
  roztashuvannya: { url: string; vidpovid: unknown; kod?: number }[]
) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const tilo =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      supabaseVyklyky.push({
        url,
        tilo,
        zagolovky: (init?.headers ?? {}) as Record<string, string>,
      });
      for (const r of roztashuvannya) {
        if (url.includes(r.url)) {
          return new Response(JSON.stringify(r.vidpovid), {
            status: r.kod ?? 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      return new Response(JSON.stringify({}), { status: 404 });
    })
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
  supabaseVyklyky.length = 0;
});

// ————— POST /api/analytics/visit —————

describe("POST /api/analytics/visit — лічильник відвідувань", () => {
  it("без sesiya → 400, у базу не йдемо", async () => {
    supabaseOtvity([]);
    const { kod, tilo } = await viklikaty({
      shlyah: "/api/analytics/visit",
      method: "POST",
      tilo: { shlyah: "/" },
    });
    expect(kod).toBe(400);
    expect(tilo).toContain("sesiya");
    expect(supabaseVyklyky).toHaveLength(0);
  });

  it("shlyah зі сторонньою адресою → 400", async () => {
    supabaseOtvity([]);
    const { kod } = await viklikaty({
      shlyah: "/api/analytics/visit",
      method: "POST",
      tilo: { sesiya: "ses-test-1", shlyah: "//evil.example" },
    });
    expect(kod).toBe(400);
    expect(supabaseVyklyky).toHaveLength(0);
  });

  it("валідні дані → пишемо в vizyty і відповідаємо 200", async () => {
    supabaseOtvity([{ url: "/rest/v1/vizyty", vidpovid: [], kod: 201 }]);
    const { kod } = await viklikaty({
      shlyah: "/api/analytics/visit",
      method: "POST",
      tilo: { sesiya: "ses-visit-1", shlyah: "/trip/3" },
    });
    expect(kod).toBe(200);
    expect(supabaseVyklyky).toHaveLength(1);
    expect(supabaseVyklyky[0].url).toContain("/rest/v1/vizyty");
    const tilo = supabaseVyklyky[0].tilo as Record<string, unknown>;
    expect(tilo.sesiya).toBe("ses-visit-1");
    expect(tilo.shlyah).toBe("/trip/3");
    expect(tilo.den).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("регресія: анонімна вставка БЕЗ return=representation (RLS не має SELECT-прав)", async () => {
    supabaseOtvity([{ url: "/rest/v1/vizyty", vidpovid: null, kod: 201 }]);
    const { kod } = await viklikaty({
      shlyah: "/api/analytics/visit",
      method: "POST",
      tilo: { sesiya: "ses-prefer-1", shlyah: "/" },
    });
    expect(kod).toBe(200);
    expect(supabaseVyklyky[0].zagolovky?.Prefer).toBeUndefined();
  });

  it("база впала → 502, а не тихий успіх", async () => {
    supabaseOtvity([{ url: "/rest/v1/vizyty", vidpovid: [], kod: 500 }]);
    const { kod } = await viklikaty({
      shlyah: "/api/analytics/visit",
      method: "POST",
      tilo: { sesiya: "ses-visit-2", shlyah: "/" },
    });
    expect(kod).toBe(502);
  });

  it("ліміт: 6-й виклик за хвилину не створює зайвий рядок", async () => {
    supabaseOtvity([{ url: "/rest/v1/vizyty", vidpovid: [], kod: 201 }]);
    for (let i = 0; i < 5; i += 1) {
      const { kod } = await viklikaty({
        shlyah: "/api/analytics/visit",
        method: "POST",
        tilo: { sesiya: "ses-spam-1", shlyah: "/" },
      });
      expect(kod).toBe(200);
    }
    expect(supabaseVyklyky).toHaveLength(5);

    const { kod, tilo } = await viklikaty({
      shlyah: "/api/analytics/visit",
      method: "POST",
      tilo: { sesiya: "ses-spam-1", shlyah: "/" },
    });
    expect(kod).toBe(200);
    expect(tilo).toContain("opusneno");
    expect(supabaseVyklyky).toHaveLength(5); // у базу нічого не додалося
  });
});

// ————— GET /api/analytics/stats —————

describe("GET /api/analytics/stats — графік для власника", () => {
  it("без токена → 401", async () => {
    supabaseOtvity([]);
    const { kod } = await viklikaty({ shlyah: "/api/analytics/stats" });
    expect(kod).toBe(401);
  });

  it("чужий акаунт → 403, дані йому не віддаємо", async () => {
    supabaseOtvity([
      {
        url: "/auth/v1/user",
        vidpovid: { id: "user-2", email: "chuzhyy@example.com" },
      },
    ]);
    const { kod, tilo } = await viklikaty({
      shlyah: "/api/analytics/stats",
      tokyn: "чужий-токен",
    });
    expect(kod).toBe(403);
    expect(supabaseVyklyky).toHaveLength(1); // лише перевірка юзера, без читання
    expect(tilo).toContain("власнику");
  });

  it("власник → добові підсумки для графіка", async () => {
    supabaseOtvity([
      {
        url: "/auth/v1/user",
        vidpovid: { id: "user-1", email: "olenaklocko@gmail.com" },
      },
      {
        url: "/rest/v1/vizyty",
        vidpovid: [
          { den: "2026-10-04", sesiya: "ses-a" },
          { den: "2026-10-04", sesiya: "ses-b" },
          { den: "2026-10-04", sesiya: "ses-a" },
          { den: "2026-10-05", sesiya: "ses-c" },
        ],
      },
    ]);
    const { kod, tilo } = await viklikaty({
      shlyah: "/api/analytics/stats",
      tokyn: "мій-токен",
    });
    expect(kod).toBe(200);
    const dany = JSON.parse(tilo ?? "{}");
    expect(dany.vsogoUnikalnyh).toBe(3);
    expect(dany.vsogoZapysiv).toBe(4);
    expect(dany.dni).toEqual([
      { den: "2026-10-04", unikalni: 2, zapysiv: 3 },
      { den: "2026-10-05", unikalni: 1, zapysiv: 1 },
    ]);
    expect(dany.denOstanniy).toBe("2026-10-05");
    // власник має токен → Prefer дозволений (рядки повертаються)
    const zapytDoBazy = supabaseVyklyky.find((v) =>
      v.url.includes("/rest/v1/vizyty")
    );
    expect(zapytDoBazy?.zagolovky?.Prefer).toBe("return=representation");
  });
});

// ————— POST/GET /api/feedback —————

describe("POST /api/feedback — анонімний відгук", () => {
  it("закороткий відгук → 400", async () => {
    supabaseOtvity([]);
    const { kod } = await viklikaty({
      shlyah: "/api/feedback",
      method: "POST",
      tilo: { teks: "аб", sesiya: "ses-fb-1" },
    });
    expect(kod).toBe(400);
    expect(supabaseVyklyky).toHaveLength(0);
  });

  it("нормальний відгук → 201, запис у vidhuky", async () => {
    supabaseOtvity([{ url: "/rest/v1/vidhuky", vidpovid: [], kod: 201 }]);
    const { kod } = await viklikaty({
      shlyah: "/api/feedback",
      method: "POST",
      tilo: { teks: "  Дуже зручний застосунок!  ", sesiya: "ses-fb-2" },
    });
    expect(kod).toBe(201);
    const tilo2 = supabaseVyklyky[0].tilo as Record<string, unknown>;
    expect(tilo2.teks).toBe("Дуже зручний застосунок!"); // обрізано
  });

  it("база впала → 502", async () => {
    supabaseOtvity([{ url: "/rest/v1/vidhuky", vidpovid: [], kod: 500 }]);
    const { kod } = await viklikaty({
      shlyah: "/api/feedback",
      method: "POST",
      tilo: { teks: "Нормально все", sesiya: "ses-fb-3" },
    });
    expect(kod).toBe(502);
  });
});

describe("GET /api/feedback — список лише для власника", () => {
  it("без токена → 401", async () => {
    supabaseOtvity([]);
    const { kod } = await viklikaty({ shlyah: "/api/feedback" });
    expect(kod).toBe(401);
  });

  it("власник → повний список відгуків", async () => {
    supabaseOtvity([
      {
        url: "/auth/v1/user",
        vidpovid: { id: "user-1", email: "olenaklocko@gmail.com" },
      },
      {
        url: "/rest/v1/vidhuky",
        vidpovid: [
          {
            id: 1,
            teks: "Бракує карти",
            chas: "2026-10-04T10:00:00Z",
            opraciovano: false,
          },
        ],
      },
    ]);
    const { kod, tilo } = await viklikaty({
      shlyah: "/api/feedback",
      tokyn: "мій-токен",
    });
    expect(kod).toBe(200);
    const dany = JSON.parse(tilo ?? "{}");
    expect(dany.vidhuky).toHaveLength(1);
    expect(dany.vidhuky[0].teks).toBe("Бракує карти");
  });
});

describe("PATCH /api/feedback — позначка «опрацьовано»", () => {
  it("без токена → 403", async () => {
    supabaseOtvity([]);
    const { kod } = await viklikaty({
      shlyah: "/api/feedback",
      method: "PATCH",
      tilo: { id: 1, opraciovano: true },
    });
    expect(kod).toBe(403);
  });

  it("власник → оновлюємо рядок", async () => {
    supabaseOtvity([
      {
        url: "/auth/v1/user",
        vidpovid: { id: "user-1", email: "olenaklocko@gmail.com" },
      },
      { url: "/rest/v1/vidhuky", vidpovid: [] },
    ]);
    const { kod } = await viklikaty({
      shlyah: "/api/feedback",
      method: "PATCH",
      tilo: { id: 7, opraciovano: true },
      tokyn: "мій-токен",
    });
    expect(kod).toBe(200);
    const ostatniy = supabaseVyklyky[supabaseVyklyky.length - 1];
    expect(ostatniy.url).toContain("id=eq.7");
    expect(ostatniy.tilo).toEqual({ opraciovano: true });
  });

  it("некоректний id → 400", async () => {
    supabaseOtvity([
      {
        url: "/auth/v1/user",
        vidpovid: { id: "user-1", email: "olenaklocko@gmail.com" },
      },
    ]);
    const { kod } = await viklikaty({
      shlyah: "/api/feedback",
      method: "PATCH",
      tilo: { id: "не-число", opraciovano: true },
      tokyn: "мій-токен",
    });
    expect(kod).toBe(400);
  });
});
