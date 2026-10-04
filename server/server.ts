import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { perevirkaLimitu, pobuduvatyPrompt, poradaDlya } from "./logika.ts";
import { PomylkaAI, vyklikatyAI } from "./ai.ts";import {
  chystyyVidhuk,
  pidsumky,
  validuvatyShlyah,
  validuvatySesiya,
} from "./analytika.ts";

const port = Number(process.env.SERVER_PORT) || 3001;

/**
 * Запит у форматі, який однаково лягає і на `node:http`, і на
 * serverless-хостинг (Vercel/Netlify кладуть розібране тіло в `body`).
 */
export interface ZapitHTTP extends IncomingMessage {
  body?: unknown;
}

/**
 * 🔑 СЕКРЕТНИЙ ключ промо-кодів.
 * Він живе у server/.env — файл НЕ потрапляє у git і НЕ відправляється у браузер.
 * (У застосунку ключі з префіксом VITE_ — навпаки, ВИДНІ всім.)
 */
const sekretnyyKlyuch = process.env.PROMO_SECRET ?? "demo-secret";

const supabaseAdresa = process.env.SUPABASE_URL ?? "";
const supabaseKlyuch = process.env.SUPABASE_ANON_KEY ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const nadislaty = (
  vidpovid: ServerResponse,
  kod: number,
  dany: unknown
): void => {
  vidpovid.writeHead(kod, {
    "Content-Type": "application/json; charset=utf-8",
    ...CORS,
  });
  vidpovid.end(JSON.stringify(dany));
};

/**
 * 🔐 Бар'єр 1 — «пускай тільки вошедших».
 * Перевіряємо Supabase-токен через їхній ендпоінт /auth/v1/user.
 * Якщо токена немає або він брехливий → null (401).
 */
const tokynIzZapytu = (zapit: IncomingMessage): string | null =>
  /^Bearer\s+(.+)$/i.exec(zapit.headers.authorization ?? "")?.[1] ?? null;

interface KorystuvachSupabase {
  id: string;
  email: string;
}

/**
 * Той самий запит, але повертає ще й email — він потрібен, щоб сказати
 * «це не сторінка власника» зрозумілою мовою, а не віддати порожній список.
 */
const khtoKorystuvachZEmailom = async (
  zapit: IncomingMessage
): Promise<KorystuvachSupabase | null> => {
  const tokyn = tokynIzZapytu(zapit);
  if (!tokyn || !supabaseAdresa) return null;
  try {
    const vidpovid = await fetch(`${supabaseAdresa}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${tokyn}`,
        apikey: supabaseKlyuch,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!vidpovid.ok) return null;
    const dany = (await vidpovid.json()) as { id?: string; email?: string };
    return dany.id ? { id: dany.id, email: dany.email ?? "" } : null;
  } catch {
    return null;
  }
};

const khtoKorystuvach = async (
  zapit: IncomingMessage
): Promise<string | null> => (await khtoKorystuvachZEmailom(zapit))?.id ?? null;

/**
 * Email власника застосунку. Якщо змінної нема — перевірка вимкнена
 * (дані все одно захищені RLS у самій базі).
 */
const emailVlasnyka = (process.env.VITE_VLASYNYK_EMAIL ?? "")
  .trim()
  .toLowerCase();

const ciVlasnyk = (email: string): boolean =>
  !emailVlasnyka || email.toLowerCase() === emailVlasnyka;

/**
 * Один виклик Supabase REST (PostgREST).
 * `tokyn` — токен користувача: тоді база застосовує ПОЛІТИКИ до цього юзера
 * (анонімний токен = роль anon = лише те, що дозволено анонімно).
 */
const supabaseZapros = async (zapyt: {
  shlyah: string;
  method: string;
  tilo?: unknown;
  tokyn?: string;
}): Promise<{ ok: boolean; status: number; dany: unknown }> => {
  if (!supabaseAdresa) return { ok: false, status: 503, dany: null };
  try {
    const vidpovid = await fetch(
      `${supabaseAdresa}/rest/v1/${zapyt.shlyah}`,
      {
        method: zapyt.method,
        headers: {
          apikey: supabaseKlyuch,
          Authorization: `Bearer ${zapyt.tokyn ?? supabaseKlyuch}`,
          "Content-Type": "application/json",
          // return=representation вимагає SELECT-прав: анонім їх не має
          // (дані власника приховані RLS) → тоді PostgREST відмовляє.
          ...(zapyt.tokyn ? { Prefer: "return=representation" } : {}),
        },
        body: zapyt.tilo === undefined ? undefined : JSON.stringify(zapyt.tilo),
        signal: AbortSignal.timeout(5000),
      }
    );
    const dany = await vidpovid.json().catch(() => null);
    return { ok: vidpovid.ok, status: vidpovid.status, dany };
  } catch {
    return { ok: false, status: 504, dany: null };
  }
};

/** День у форматі YYYY-MM-DD за UTC — щоб графік не стрибав від поясів. */
const siohoDen = (): string => new Date().toISOString().slice(0, 10);

/**
 * 🛡 Бар'єр 2 — ліміт запитів на користувача (5 на хвилину).
 * Інакше чужі люди (або ми самі) розтратять гроші на моделі.
 */
const MAX_ZAPYTIV = 5;
const VIKNO_MS = 60_000;
const istoriyaLimitiv = new Map<string, number[]>();

/** Анонімні дії теж лімітуємо — інакше бот налапає тисячі рядків. */
const MAX_VIZYTIV = 5; // відвідувань на сесію за хвилину
const MAX_VIDHUKIV = 3; // відгуків на сесію за 10 хвилин
const VIKNO_VIDHUKIV_MS = 10 * 60_000;
const istoriyaVizytiv = new Map<string, number[]>();
const istoriyaVidhukiv = new Map<string, number[]>();

const otrymatyTilo = async (
  zapit: ZapitHTTP
): Promise<Record<string, unknown> | null> => {
  // Vercel/Netlify розбирають тіло заздалегідь і кладуть у req.body
  if (zapit.body !== undefined && zapit.body !== null) {
    const dany = zapit.body;
    return typeof dany === "object"
      ? (dany as Record<string, unknown>)
      : null;
  }
  const chanky: Buffer[] = [];
  for await (const chank of zapit) chanky.push(chank as Buffer);
  try {
    const dany = JSON.parse(Buffer.concat(chanky).toString("utf8"));
    return typeof dany === "object" && dany !== null
      ? (dany as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

/**
 * ЄДИНИЙ диспетчер запитів.
 * Локально його вмикає `createServer` нижче, на Vercel — файл у `api/`.
 * `shlyah` передаємо навмисно: serverless-хостинги інколи переписують req.url.
 */
export const obrotyty = (
  zapit: ZapitHTTP,
  vidpovid: ServerResponse,
  shlyah?: string
): void => {
  // Маршрут і параметри — з РІЗНИХ джерел:
  //  - pathname беремо з `shlyah` (serverless-хостинги інколи переписують req.url);
  //  - query-рядок — ЛИШЕ з req.url, бо `shlyah` передають без «?...»,
  //    і раніше параметр krajyna мовчки відкидався → 400 на Vercel.
  const url = new URL(zapit.url ?? shlyah ?? "/", "http://localhost");
  const shlyahZapytu = new URL(shlyah ?? url.pathname, "http://localhost")
    .pathname;

  if (zapit.method === "OPTIONS") {
    vidpovid.writeHead(204, CORS);
    vidpovid.end();
    return;
  }

  // Ендпоінт 1: перевірка, що сервер живий
  if (zapit.method === "GET" && shlyahZapytu === "/api/zdorovya") {
    nadislaty(vidpovid, 200, {
      ok: true,
      server: "Travelog API",
      chas: new Date().toISOString(),
    });
    return;
  }

  // Ендпоінт 2: порада для країни — за ПРАВИЛАМИ СЕРВЕРА
  if (zapit.method === "GET" && shlyahZapytu === "/api/porada") {
    const kod = url.searchParams.get("krajyna") ?? "";
    if (!kod) {
      nadislaty(vidpovid, 400, { pomylka: "Додайте параметр: ?krajyna=XX" });
      return;
    }
    const porada = poradaDlya(kod, sekretnyyKlyuch);
    if (!porada) {
      nadislaty(vidpovid, 404, {
        pomylka: `Сервер не знає країну «${kod}» — такі наші правила`,
      });
      return;
    }
    nadislaty(vidpovid, 200, porada);
    return;
  }

  // Ендпоінт 3: 🤖 AI-порада — лише для вошедших + ліміт 5/хв
  if (zapit.method === "POST" && shlyahZapytu === "/api/ai/porada") {
    void (async () => {
      // Бар'єр 1: хто це?
      const korystuvachId = await khtoKorystuvach(zapit);
      if (!korystuvachId) {
        nadislaty(vidpovid, 401, {
          pomylka: "Спочатку увійдіть у свій акаунт (AI — лише для своїх)",
        });
        return;
      }

      // Бар'єр 2: ліміт
      const teper = Date.now();
      const stan = perevirkaLimitu(
        istoriyaLimitiv.get(korystuvachId) ?? [],
        teper,
        MAX_ZAPYTIV,
        VIKNO_MS
      );
      if (!stan.dozvoleno) {
        nadislaty(vidpovid, 429, {
          pomylka: `Забагато запитів до ШІ: ліміт ${MAX_ZAPYTIV} на хвилину. Зачекай ${stan.chekatySec} с.`,
        });
        return;
      }

      // Тіло запиту
      const tilo = await otrymatyTilo(zapit);
      const zapyt = typeof tilo?.zapyt === "string" ? tilo.zapyt.trim() : "";
      const kodKrayiny = typeof tilo?.krajyna === "string" ? tilo.krajyna : "";
      if (!zapyt || zapyt.length > 500) {
        nadislaty(vidpovid, 400, {
          pomylka: "Надішліть запит до 500 символів: { zapyt: \"...\" }",
        });
        return;
      }

      // Ліміт зараховується навіть якщо модель відмовить —
      // щоб ніхто не кружляв по 429/502 безкарно.
      const istoriya = (istoriyaLimitiv.get(korystuvachId) ?? []).filter(
        (t) => teper - t < VIKNO_MS
      );
      istoriyaLimitiv.set(korystuvachId, [...istoriya, teper]);

      // Виклик моделі — ключ лишається на сервері
      try {
        const vidpovidAI = await vyklikatyAI(
          pobuduvatyPrompt(kodKrayiny, zapyt)
        );
        nadislaty(vidpovid, 200, {
          odpovid: vidpovidAI.tekst,
          model: vidpovidAI.model,
          zalyshok: stan.zalyshok,
        });
      } catch (e) {
        // ШІ не відповів — квоту повертаємо, щоб ліміт не згорів на збоях
        istoriyaLimitiv.set(korystuvachId, istoriya);
        const pomylka =
          e instanceof PomylkaAI
            ? e
            : new PomylkaAI(502, "Невідома помилка ШІ");
        nadislaty(vidpovid, pomylka.kod, { pomylka: pomylka.message });
      }
    })();
    return;
  }

  // ─── 📊 АНАЛІТИКА ─────────────────────────────────────────────

  // Ендпоінт 4: зафіксувати відвідування (анонімно, без логіну)
  if (zapit.method === "POST" && shlyahZapytu === "/api/analytics/visit") {
    void (async () => {
      const tilo = await otrymatyTilo(zapit);
      const sesiya = tilo?.sesiya;
      const shlyahStorinky = tilo?.shlyah ?? "/";

      if (!validuvatySesiya(sesiya)) {
        nadislaty(vidpovid, 400, {
          pomylka: "Надішліть анонімну сесію: { sesiya: \"...\" }",
        });
        return;
      }
      if (!validuvatyShlyah(shlyahStorinky)) {
        nadislaty(vidpovid, 400, {
          pomylka: "shlyah має бути локальним шляхом: \"/\" або \"/trip/3\"",
        });
        return;
      }

      // Ліміт: одна сесія не може тикати безкінечно
      const teper = Date.now();
      const stan = perevirkaLimitu(
        istoriyaVizytiv.get(sesiya) ?? [],
        teper,
        MAX_VIZYTIV,
        VIKNO_MS
      );
      if (!stan.dozvoleno) {
        nadislaty(vidpovid, 200, { ok: true, opusneno: true });
        return;
      }
      istoriyaVizytiv.set(sesiya, [
        ...(istoriyaVizytiv.get(sesiya) ?? []).filter(
          (t) => teper - t < VIKNO_MS
        ),
        teper,
      ]);

      const zapis = await supabaseZapros({
        shlyah: "vizyty",
        method: "POST",
        tilo: { den: siohoDen(), sesiya, shlyah: shlyahStorinky },
      });
      if (!zapis.ok) {
        nadislaty(vidpovid, 502, { pomylka: "База даних не відповіла" });
        return;
      }
      nadislaty(vidpovid, 200, { ok: true });
    })();
    return;
  }

  // Ендпоінт 5: статистика для графіка — ЛИШЕ власнику
  if (zapit.method === "GET" && shlyahZapytu === "/api/analytics/stats") {
    void (async () => {
      const korystuvach = await khtoKorystuvachZEmailom(zapit);
      if (!korystuvach) {
        nadislaty(vidpovid, 401, {
          pomylka: "Спочатку увійдіть у свій акаунт",
        });
        return;
      }
      if (!ciVlasnyk(korystuvach.email)) {
        nadislaty(vidpovid, 403, { pomylka: "Статистика належить власнику" });
        return;
      }

      const dano = await supabaseZapros({
        shlyah: "vizyty?select=den,sesiya&order=den.asc&limit=5000",
        method: "GET",
        tokyn: tokynIzZapytu(zapit) ?? undefined,
      });
      if (!dano.ok) {
        nadislaty(vidpovid, 502, { pomylka: "База даних не відповіла" });
        return;
      }
      const zapysy = Array.isArray(dano.dany) ? dano.dany : [];
      nadislaty(vidpovid, 200, pidsumky(zapysy));
    })();
    return;
  }

  // ─── 💬 ЗВОРОТНИЙ ЗВ'ЯЗОК ──────────────────────────────────────

  // Ендпоінт 6: залишити анонімний відгук (без логіну)
  if (zapit.method === "POST" && shlyahZapytu === "/api/feedback") {
    void (async () => {
      const tilo = await otrymatyTilo(zapit);
      const teks = chystyyVidhuk(tilo?.teks);
      const sesiya = typeof tilo?.sesiya === "string" ? tilo.sesiya : "";

      if (!teks) {
        nadislaty(vidpovid, 400, {
          pomylka: "Відгук має бути від 3 до 1000 символів",
        });
        return;
      }

      const teper = Date.now();
      const stan = perevirkaLimitu(
        istoriyaVidhukiv.get(sesiya) ?? [],
        teper,
        MAX_VIDHUKIV,
        VIKNO_VIDHUKIV_MS
      );
      if (!stan.dozvoleno) {
        nadislaty(vidpovid, 429, {
          pomylka: `Забагато відгуків. Спробуйте за ${stan.chekatySec} с.`,
        });
        return;
      }
      istoriyaVidhukiv.set(sesiya, [
        ...(istoriyaVidhukiv.get(sesiya) ?? []).filter(
          (t) => teper - t < VIKNO_VIDHUKIV_MS
        ),
        teper,
      ]);

      const zapis = await supabaseZapros({
        shlyah: "vidhuky",
        method: "POST",
        tilo: { teks },
      });
      if (!zapis.ok) {
        nadislaty(vidpovid, 502, { pomylka: "База даних не відповіла" });
        return;
      }
      nadislaty(vidpovid, 201, { ok: true });
    })();
    return;
  }

  // Ендпоінт 7: список відгуків — ЛИШЕ власнику
  if (zapit.method === "GET" && shlyahZapytu === "/api/feedback") {
    void (async () => {
      const korystuvach = await khtoKorystuvachZEmailom(zapit);
      if (!korystuvach) {
        nadislaty(vidpovid, 401, {
          pomylka: "Спочатку увійдіть у свій акаунт",
        });
        return;
      }
      if (!ciVlasnyk(korystuvach.email)) {
        nadislaty(vidpovid, 403, { pomylka: "Відгуки бачить лише власник" });
        return;
      }

      const dano = await supabaseZapros({
        shlyah: "vidhuky?select=id,teks,chas,opraciovano&order=chas.desc&limit=200",
        method: "GET",
        tokyn: tokynIzZapytu(zapit) ?? undefined,
      });
      if (!dano.ok) {
        nadislaty(vidpovid, 502, { pomylka: "База даних не відповіла" });
        return;
      }
      nadislaty(vidpovid, 200, {
        vidhuky: Array.isArray(dano.dany) ? dano.dany : [],
      });
    })();
    return;
  }

  // Ендпоінт 8: позначити відгук опрацьованим — ЛИШЕ власнику
  if (zapit.method === "PATCH" && shlyahZapytu === "/api/feedback") {
    void (async () => {
      const korystuvach = await khtoKorystuvachZEmailom(zapit);
      if (!korystuvach || !ciVlasnyk(korystuvach.email)) {
        nadislaty(vidpovid, 403, { pomylka: "Це може зробити лише власник" });
        return;
      }

      const tilo = await otrymatyTilo(zapit);
      const id = Number(tilo?.id);
      const opraciovano = tilo?.opraciovano === true;
      if (!Number.isInteger(id) || id <= 0) {
        nadislaty(vidpovid, 400, { pomylka: "Надішліть { id, opraciovano }" });
        return;
      }

      const zapis = await supabaseZapros({
        shlyah: `vidhuky?id=eq.${id}`,
        method: "PATCH",
        tilo: { opraciovano },
        tokyn: tokynIzZapytu(zapit) ?? undefined,
      });
      if (!zapis.ok) {
        nadislaty(vidpovid, 502, { pomylka: "База даних не відповіла" });
        return;
      }
      nadislaty(vidpovid, 200, { ok: true });
    })();
    return;
  }

  // Невідомий шлях → теж наша відмова
  nadislaty(vidpovid, 404, { pomylka: "Немає такого ендпоінта" });
};

// Локальний запуск: `npm run server`
// (на Vercel цей файл імпортується, а сервер не піднімається)
const lokalnyyZapusk =
  process.env.VERCEL !== "1" &&
  process.env.VERCEL_ENV === undefined &&
  process.env.VITEST === undefined;

if (lokalnyyZapusk) {
  createServer((zapit, vidpovid) =>
    obrotyty(zapit as ZapitHTTP, vidpovid)
  ).listen(port, () => {
    console.log(`🖥 Travelog API: http://localhost:${port}/api/zdorovya`);
  });
}
