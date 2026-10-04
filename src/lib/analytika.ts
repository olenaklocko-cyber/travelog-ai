import { apiAdres } from "./api";
import type { PidsumkyAnalityky, Vidhuk } from "../types";

/**
 * 📊 Аналітика та зворотний зв'язок — клієнтська частина.
 *
 * Все анонімно: ми зберігаємо у браузері лише випадковий id сесії
 * (crypto.randomUUID) — ні email, ні імені, нічого особистого.
 * Лічильник рахує «зайшло стільки-то людей», а не «олена зайшла 5 разів».
 */

const KLYUCH_SESIYI = "travelog-sesiya";

/** Стабільний анонімний id цього браузера. */
export const otrymatySesiyu = (): string => {
  try {
    const nayadenе = localStorage.getItem(KLYUCH_SESIYI);
    if (nayadenе) return nayadenе;
    const nova = crypto.randomUUID();
    localStorage.setItem(KLYUCH_SESIYI, nova);
    return nova;
  } catch {
    // Приватний режим / сховище заблоковане — id існуватиме лише зараз
    return crypto.randomUUID();
  }
};

/**
 * Фіксує відвідування. Помилки ковтаємо НАВМИСНО:
 * аналітика ніколи не має ламати роботу застосунку.
 */
export const zafiksovatyVizyt = async (shlyah: string): Promise<void> => {
  try {
    await fetch(apiAdres("/api/analytics/visit"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sesiya: otrymatySesiyu(), shlyah }),
      keepalive: true,
    });
  } catch {
    /* офлайн / блокувальник — і так зрозуміло */
  }
};

const zagolovkyZTokynom = async (): Promise<Record<string, string>> => {
  const { data } = await (await import("../supabase")).default.auth.getSession();
  const tokyn = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(tokyn ? { Authorization: `Bearer ${tokyn}` } : {}),
  };
};

/** Текст помилки із сервера або запасний варіант. */
const pomylkaZ = async (vidpovid: Response): Promise<string> => {
  try {
    const dany = (await vidpovid.json()) as { pomylka?: string };
    return dany.pomylka ?? "Сервер відмовив";
  } catch {
    return "Сервер відповів незрозуміле";
  }
};

/** Надіслати анонімний відгук. Кине помилку, якщо щось не так. */
export const nadislatyVidhuk = async (teks: string): Promise<void> => {
  const vidpovid = await fetch(apiAdres("/api/feedback"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teks, sesiya: otrymatySesiyu() }),
  });
  if (!vidpovid.ok) throw new Error(await pomylkaZ(vidpovid));
};

/** Статистика для графіка (потрібен токен власника). */
export const otrymatyStatystyku = async (): Promise<PidsumkyAnalityky> => {
  const vidpovid = await fetch(apiAdres("/api/analytics/stats"), {
    headers: await zagolovkyZTokynom(),
  });
  if (!vidpovid.ok) throw new Error(await pomylkaZ(vidpovid));
  return (await vidpovid.json()) as PidsumkyAnalityky;
};

/** Список відгуків (потрібен токен власника). */
export const otrymatyVidhuky = async (): Promise<Vidhuk[]> => {
  const vidpovid = await fetch(apiAdres("/api/feedback"), {
    headers: await zagolovkyZTokynom(),
  });
  if (!vidpovid.ok) throw new Error(await pomylkaZ(vidpovid));
  const dany = (await vidpovid.json()) as { vidhuky?: Vidhuk[] };
  return dany.vidhuky ?? [];
};

/** Позначити відгук опрацьованим (тільки власник). */
export const opratyuvatyVidhuk = async (
  id: number,
  opraciovano: boolean
): Promise<void> => {
  const vidpovid = await fetch(apiAdres("/api/feedback"), {
    method: "PATCH",
    headers: await zagolovkyZTokynom(),
    body: JSON.stringify({ id, opraciovano }),
  });
  if (!vidpovid.ok) throw new Error(await pomylkaZ(vidpovid));
};
