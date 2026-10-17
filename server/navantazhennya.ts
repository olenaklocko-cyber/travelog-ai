// Тиждень 8: навантажувальний тест тревелогу.
// Симулює 500 користувачів одночасно.
// Запуск: npm run navantazhennya

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_KEY;

if (!url || !key) {
  console.error("Немає SUPABASE_URL / SUPABASE_ANON_KEY у server/.env");
  process.exit(1);
}

const db = createClient(url, key);

interface Rezultat {
  nazva: string;
  kilkist: number;
  uspishno: number;
  pomylky: number;
  seredneMs: number;
  naykilkyshyyeMs: number;
  nayshvydsheMs: number;
}

async function navantazhennya(
  nazva: string,
  f: () => Promise<unknown>,
  kilkist: number,
  maksymalnoChasMs = 10000
): Promise<Rezultat> {
  const chasy: number[] = [];
  let uspishno = 0;
  let pomylky = 0;

  // Запускаємо ВСІ запити одночасно (імітація 500 користувачів)
  const obicyanky = Array.from({ length: kilkist }, async () => {
    const t0 = performance.now();
    try {
      await Promise.race([
        f(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), maksymalnoChasMs)),
      ]);
      chasy.push(performance.now() - t0);
      uspishno++;
    } catch {
      chasy.push(performance.now() - t0);
      pomylky++;
    }
  });

  await Promise.all(obicyanky);

  const seredne = chasy.length > 0 ? chasy.reduce((a, b) => a + b, 0) / chasy.length : 0;

  return {
    nazva,
    kilkist,
    uspishno,
    pomylky,
    seredneMs: seredne,
    naykilkyshyyeMs: chasy.length > 0 ? Math.max(...chasy) : 0,
    nayshvydsheMs: chasy.length > 0 ? Math.min(...chasy) : 0,
  };
}

console.log("🏆 Навантажувальний тест «Мій розумний тревелог»\n");
console.log("Симулюємо 500 користувачів одночасно...\n");

// Тест 1: Читання подорожей (найпопулярніший запит)
const t1 = await navantazhennya(
  "Читання подорожей (view)",
  () => Promise.resolve(db.from("trips_z_vidatamy").select("*").order("id", { ascending: false }).limit(50)),
  500
);

// Тест 2: Читання країн (довідник)
const t2 = await navantazhennya(
  "Читання країн",
  () => Promise.resolve(db.from("krajiny").select("code, nazva, emoji")),
  500
);

// Тест 3: Запис логів (фонова дія)
const t3 = await navantazhennya(
  "Запис логів",
  () => Promise.resolve(db.rpc("zapysaty_log", {
    p_riven: "info",
    p_dzherelo: "load-test",
    p_povidomlennya: "Навантажувальний тест",
    p_kontekst: {},
  })),
  200
);

// Тест 4: Реєстрація в онлайні
const t4 = await navantazhennya(
  "Реєстрація в онлайні",
  () => Promise.resolve(db.rpc("ya_tut", {
    p_sid: `load-${Math.random().toString(36).slice(2)}`,
    p_user_name: "Тест",
  })),
  300
);

// Тест 5: Створення подорожі (запис)
const t5 = await navantazhennya(
  "Створення подорожі",
  () => Promise.resolve(db.from("trips").insert({
    user_id: "11111111-1111-1111-1111-111111111111",
    title: `Навантаження ${Math.random().toString(36).slice(2, 8)}`,
    country_code: "IT",
    budget: 10000,
    status: "Плануються",
  })),
  50
);

// Показуємо результати
const rezultaty = [t1, t2, t3, t4, t5];

console.log("📊 РЕЗУЛЬТАТИ:");
console.log("=".repeat(80));
for (const r of rezultaty) {
  const status = r.pomylky === 0 ? "✅" : r.pomylky < r.kilkist * 0.1 ? "⚠️" : "❌";
  console.log(`${status} ${r.nazva}`);
  console.log(`   Запитів: ${r.kilkist} | ✅ ${r.uspishno} | ❌ ${r.pomylky}`);
  console.log(`   Середній: ${r.seredneMs.toFixed(1)} мс | Найшвидший: ${r.nayshvydsheMs.toFixed(1)} мс | Найповільніший: ${r.naykilkyshyyeMs.toFixed(1)} мс`);
  console.log("");
}

// Підсумок
const zagalnoPomylky = rezultaty.reduce((a, r) => a + r.pomylky, 0);
const zagalnoZapytiv = rezultaty.reduce((a, r) => a + r.kilkist, 0);
const winokUspikhu = ((zagalnoZapytiv - zagalnoPomylky) / zagalnoZapytiv * 100).toFixed(1);

console.log("=".repeat(80));
console.log("🏆 ПІДСУМОК:");
console.log(`   Всього запитів: ${zagalnoZapytiv}`);
console.log(`   Успішних: ${zagalnoZapytiv - zagalnoPomylky} (${winokUspikhu}%)`);
console.log(`   Помилок: ${zagalnoPomylky}`);
console.log("=".repeat(80));

if (zagalnoPomylky === 0) {
  console.log("🎉 СЕРВІС ТРИМАЄ НАВАНТАЖЕННЯ! Жодної помилки!");
} else if (zagalnoPomylky < zagalnoZapytiv * 0.05) {
  console.log("✅ СЕРВІС ТРИМАЄ НАВАНТАЖЕННЯ! Менше 5% помилок.");
} else {
  console.log("⚠️ Є ПРОБЛЕМИ! Дивись помилки вище.");
}
