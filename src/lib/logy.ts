// Тиждень 5: логування для клієнта.
// Пише логи в Supabase + console.
// НІКОЛИ не пише паролі, токени, ключі!

import supabase from "../supabase";

export type RivenLogu = "debug" | "info" | "warning" | "error" | "critical";

interface LogEntry {
  riven: RivenLogu;
  dzherelo: string;
  povidomlennya: string;
  kontekst?: Record<string, unknown>;
  storinka?: string;
}

// Заборонені ключі — ніколи не логуємо
const ZABORONENI_KLYUCHI = new Set([
  "password", "pass", "пароль", "token", "api_key", "apikey",
  "secret", "key", "authorization", "cookie", "session",
  "llm_api_key", "promo_secret", "supabase_key",
]);

// Очищаємо контекст від секретів
function ochystytyKontekst(kontekst: Record<string, unknown>): Record<string, unknown> {
  const ochyscheno: Record<string, unknown> = {};
  for (const [klyuch, znachennya] of Object.entries(kontekst)) {
    const nyzhniy = klyuch.toLowerCase();
    if (ZABORONENI_KLYUCHI.has(nyzhniy) || nyzhniy.includes("password") || nyzhniy.includes("secret")) {
      ochyscheno[klyuch] = "***";
    } else if (typeof znachennya === "object" && znachennya !== null) {
      ochyscheno[klyuch] = ochystytyKontekst(znachennya as Record<string, unknown>);
    } else {
      ochyscheno[klyuch] = znachennya;
    }
  }
  return ochyscheno;
}

// Основна функція логування
export async function zapisatyLog(entry: LogEntry): Promise<void> {
  const kontekst = entry.kontekst ? ochystytyKontekst(entry.kontekst) : {};

  // Console (для розробника)
  const consoleMethod = entry.riven === "error" || entry.riven === "critical"
    ? "error"
    : entry.riven === "warning"
      ? "warn"
      : "log";
  console[consoleMethod](`[${entry.riven.toUpperCase()}] ${entry.dzherelo}: ${entry.povidomlennya}`, kontekst);

  // Supabase (для моніторингу)
  try {
    await supabase.rpc("zapysaty_log", {
      p_riven: entry.riven,
      p_dzherelo: entry.dzherelo,
      p_povidomlennya: entry.povidomlennya,
      p_kontekst: kontekst,
      p_storinka: entry.storinka ?? window.location.pathname,
    });
  } catch {
    // Якщо Supabase недоступний — лише console
  }
}

// Зручні обгортки
export const log = {
  debug: (dzherelo: string, povidomlennya: string, kontekst?: Record<string, unknown>) =>
    zapisatyLog({ riven: "debug", dzherelo, povidomlennya, kontekst }),

  info: (dzherelo: string, povidomlennya: string, kontekst?: Record<string, unknown>) =>
    zapisatyLog({ riven: "info", dzherelo, povidomlennya, kontekst }),

  warning: (dzherelo: string, povidomlennya: string, kontekst?: Record<string, unknown>) =>
    zapisatyLog({ riven: "warning", dzherelo, povidomlennya, kontekst }),

  error: (dzherelo: string, povidomlennya: string, kontekst?: Record<string, unknown>) =>
    zapisatyLog({ riven: "error", dzherelo, povidomlennya, kontekst }),

  critical: (dzherelo: string, povidomlennya: string, kontekst?: Record<string, unknown>) =>
    zapisatyLog({ riven: "critical", dzherelo, povidomlennya, kontekst }),
};

// Глобальний обробник помилок
export function uviklnutyPomylky(): void {
  // Помилки JS
  window.addEventListener("error", (event) => {
    void zapisatyLog({
      riven: "error",
      dzherelo: "client",
      povidomlennya: event.message,
      kontekst: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      },
    });
  });

  // Необроблені Promise
  window.addEventListener("unhandledrejection", (event) => {
    void zapisatyLog({
      riven: "error",
      dzherelo: "client",
      povidomlennya: `Unhandled promise: ${String(event.reason)}`,
      kontekst: { reason: String(event.reason), stack: (event.reason as Error)?.stack },
    });
  });
}
