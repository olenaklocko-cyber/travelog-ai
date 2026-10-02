import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { perevirkaLimitu, pobuduvatyPrompt, poradaDlya } from "./logika.ts";
import { PomylkaAI, vyklikatyAI } from "./ai.ts";

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
const khtoKorystuvach = async (
  zapit: IncomingMessage
): Promise<string | null> => {
  const zagolovok = zapit.headers.authorization ?? "";
  const tokyn = /^Bearer\s+(.+)$/i.exec(zagolovok)?.[1];
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
    const dany = (await vidpovid.json()) as { id?: string };
    return dany.id ?? null;
  } catch {
    return null;
  }
};

/**
 * 🛡 Бар'єр 2 — ліміт запитів на користувача (5 на хвилину).
 * Інакше чужі люди (або ми самі) розтратять гроші на моделі.
 */
const MAX_ZAPYTIV = 5;
const VIKNO_MS = 60_000;
const istoriyaLimitiv = new Map<string, number[]>();

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
  const url = new URL(shlyah ?? zapit.url ?? "/", "http://localhost");

  if (zapit.method === "OPTIONS") {
    vidpovid.writeHead(204, CORS);
    vidpovid.end();
    return;
  }

  // Ендпоінт 1: перевірка, що сервер живий
  if (zapit.method === "GET" && url.pathname === "/api/zdorovya") {
    nadislaty(vidpovid, 200, {
      ok: true,
      server: "Travelog API",
      chas: new Date().toISOString(),
    });
    return;
  }

  // Ендпоінт 2: порада для країни — за ПРАВИЛАМИ СЕРВЕРА
  if (zapit.method === "GET" && url.pathname === "/api/porada") {
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
  if (zapit.method === "POST" && url.pathname === "/api/ai/porada") {
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

  // Невідомий шлях → теж наша відмова
  nadislaty(vidpovid, 404, { pomylka: "Немає такого ендпоінта" });
};

// Локальний запуск: `npm run server`
// (на Vercel цей файл імпортується, а сервер не піднімається)
const lokalnyyZapusk =
  process.env.VERCEL !== "1" && process.env.VERCEL_ENV === undefined;

if (lokalnyyZapusk) {
  createServer((zapit, vidpovid) =>
    obrotyty(zapit as ZapitHTTP, vidpovid)
  ).listen(port, () => {
    console.log(`🖥 Travelog API: http://localhost:${port}/api/zdorovya`);
  });
}
