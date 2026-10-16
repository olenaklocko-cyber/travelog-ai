// Тиждень 2: кеш із TTL у пам'яті.
// Простий «словник»: ключ → значення + час створення.
// Якщо минув TTL — значення «протермінувалося» і перераховується.

type Zahodzhennya<T> = { znachennya: T; chas: number };

export class Kesh<T> {
  private danі = new Map<string, Zahodzhennya<T>>();
  private ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  /** Отримати з кеша або обчислити й запам'ятати. */
  async aboObchyslyty(klyuch: string, f: () => Promise<T>): Promise<T> {
    const tepер = Date.now();
    const cache = this.danі.get(klyuch);
    if (cache && tepер - cache.chas < this.ttlMs) {
      return cache.znachennya;
    }
    const znachennya = await f();
    this.danі.set(klyuch, { znachennya, chas: tepер });
    return znachennya;
  }

  /** Очистити кеш (напр., після додавання нового запису). */
  ochystyty(): void {
    this.danі.clear();
  }

  /** Очистити лише один ключ. */
  ochystytyKlyuch(klyuch: string): void {
    this.danі.delete(klyuch);
  }

  /** Скільки записів у кеші (для дебагу). */
  rozmir(): number {
    return this.danі.size;
  }
}

/** Глобальний кеш довідника країн (TTL 24 години). */
export const keshKrayin = new Kesh<{ code: string; nazva: string; emoji: string }[]>(24 * 60 * 60 * 1000);

/** Глобальний кеш подорожей (TTL 2 хвилини). */
export const keshPodorozhey = new Kesh<Record<string, unknown>[]>(2 * 60 * 1000);
