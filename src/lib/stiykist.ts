// Тиждень 6: стійкість до збоїв (resilience).
// Набір прийомів: retry, timeout, rate limit, graceful degradation, feature flags.

// 1) TIMEOUT — обмеження часу очікування
export async function zTimeout<T>(
  promis: Promise<T>,
  ms: number,
  nazva = "запит"
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const taymaut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Таймаут ${nazva}: більше ${ms} мс`));
    }, ms);
  });
  try {
    return await Promise.race([promis, taymaut]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// 2) RETRY — повтор при сбої з «експоненційним» зростанням затримки
export interface OptytsiyRetry {
  zminy: number;          // скільки разів повторювати
  zatrymkaMs: number;     // базова затримка
  naibilshaZatrymkaMs: number;
}

export async function zRetry<T>(
  f: () => Promise<T>,
  opts: Partial<OptytsiyRetry> = {}
): Promise<T> {
  const { zminy = 3, zatrymkaMs = 500, naibilshaZatrymkaMs = 5000 } = opts;
  let ostannyaPomylka: Error = new Error("Невідома помилка");

  for (let sproba = 0; sproba <= zminy; sproba++) {
    try {
      return await f();
    } catch (e) {
      ostannyaPomylka = e as Error;
      if (sproba < zminy) {
        // Затримка подвоюється: 500мс → 1000мс → 2000мс
        const zatrymka = Math.min(zatrymkaMs * 2 ** sproba, naibilshaZatrymkaMs);
        console.warn(`Спроба ${sproba + 1} впала, повторюю через ${zatrymka}мс...`, e);
        await new Promise((r) => setTimeout(r, zatrymka));
      }
    }
  }
  throw ostannyaPomylka;
}

// 3) RATE LIMIT — обмеження частоти запитів
export class RateLimit {
  private zapyty: number[] = [];

  constructor(
    private maksimalno: number,
    private viknoMs: number
  ) {}

  dozvoleno(): boolean {
    const tepер = Date.now();
    // Прибираємо старі запити поза вікном
    this.zapyty = this.zapyty.filter((t) => tepер - t < this.viknoMs);
    if (this.zapyty.length >= this.maksimalno) {
      return false;
    }
    this.zapyty.push(tepер);
    return true;
  }

  skilky(): number {
    return this.zapyty.length;
  }
}

// Глобальний rate limit для AI-запитів: максимум 10 на хвилину
export const rateLimitAI = new RateLimit(10, 60_000);

// 4) GRACEFUL DEGRADATION — запасний варіант при сбої
export interface RezultatZapusk<T> {
  danі: T | null;
  pomylka: Error | null;
  dzherelo: "osnovne" | "zapaskove" | "zovnishnie";
}

export async function zZapaskovym<T>(
  osnovne: () => Promise<T>,
  zapasne: () => T | Promise<T>,
  opts: { timeoutMs?: number; retry?: number } = {}
): Promise<RezultatZapusk<T>> {
  const { timeoutMs = 5000, retry = 2 } = opts;

  try {
    // Спочатку намагаємось основний шлях (з timeout + retry)
    const danі = await zTimeout(zRetry(osnovne, { zminy: retry }), timeoutMs);
    return { danі, pomylka: null, dzherelo: "osnovne" };
  } catch (pomylka) {
    console.warn("Основний шлях впав, використовую запасний:", pomylka);
    try {
      const danі = await zapasne();
      return { danі, pomylka: pomylka as Error, dzherelo: "zapaskove" };
    } catch (zapasnaPomylka) {
      return { danі: null, pomylka: zapasnaPomylka as Error, dzherelo: "zovnishnie" };
    }
  }
}

// 5) FEATURE FLAGS — увімкнення/вимкнення фіч без правки коду
// Зберігаються в localStorage, можна міняти в консолі браузера:
//   localStorage.setItem("ff:ai", "false")  — вимкнути AI
//   localStorage.removeItem("ff:ai")        — увімкнути AI
export function uvimknenoFlag(nazva: string, zamovchennya = true): boolean {
  try {
    const znachennya = localStorage.getItem(`ff:${nazva}`);
    if (znachennya === null) return zamovchennya;
    return znachennya !== "false" && znachennya !== "0";
  } catch {
    return zamovchennya;
  }
}

// 6) CIRCUIT BREAKER — «предохранитель»:
// якщо N помилок поспіль — «вимикаємо» запити на час, щоб не «доливати»
export class Predokhranitel {
  private stan: "zakrytyй" | "vidkrytyй" = "zakrytyй";
  private pomylkyPospil = 0;
  private ostanniaPomylkaAt = 0;

  constructor(
    private maksimalnoPomylok: number,
    private chasVidkryttiaMs: number
  ) {}

  dozvoleno(): boolean {
    if (this.stan === "zakrytyй") return true;
    // Якщо минув час відкриття — пробуємо знову
    if (Date.now() - this.ostanniaPomylkaAt > this.chasVidkryttiaMs) {
      this.stan = "zakrytyй";
      this.pomylkyPospil = 0;
      return true;
    }
    return false;
  }

  zapisatyUspikh(): void {
    this.pomylkyPospil = 0;
    this.stan = "zakrytyй";
  }

  zapisatyPomylku(): void {
    this.pomylkyPospil++;
    this.ostanniaPomylkaAt = Date.now();
    if (this.pomylkyPospil >= this.maksimalnoPomylok) {
      this.stan = "vidkrytyй";
      console.warn(`Предохранитель відкрито: ${this.pomylkyPospil} помилок поспіль`);
    }
  }

  yakStan(): string {
    return this.stan;
  }
}

// Глобальний предохранитель для AI: 3 помилки → відкриваємо на 30 секунд
export const predokhranitelAI = new Predokhranitel(3, 30_000);
