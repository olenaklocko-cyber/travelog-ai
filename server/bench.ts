// Бенчмарк тревелогу: «було/стало» для головної сторінки.
// Запуск: npm run bench
// Потрібні у server/.env: SUPABASE_URL, SUPABASE_KEY

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_KEY ?? process.env.VITE_SUPABASE_KEY;

if (!url || !key) {
  console.error("Немає SUPABASE_URL / SUPABASE_KEY у server/.env");
  process.exit(1);
}

const db = createClient(url, key);

async function zameraty(nazva: string, f: () => Promise<unknown>, raziv = 5): Promise<number> {
  const chasy: number[] = [];
  for (let i = 0; i < raziv; i++) {
    const pochatok = performance.now();
    await Promise.resolve(f());
    chasy.push(performance.now() - pochatok);
  }
  const seredne = chasy.reduce((a, b) => a + b, 0) / chasy.length;
  const naykilkyshyye = Math.max(...chasy);
  console.log(`  ${nazva}: середнє ${seredne.toFixed(1)} мс · найповільніший ${naykilkyshyye.toFixed(1)} мс`);
  return seredne;
}

console.log("📊 Бенчмарк «Мій розумний тревелог»\n");

// 1) БУЛО: повний view без кешу (те, що робила Golovna.tsx)
console.log("1) БУЛО — trips_z_vidatamy (view з N+1 підзапитами):");
const bulo = await zameraty("повний запит", () =>
  Promise.resolve(db.from("trips_z_vidatamy").select("*").order("id", { ascending: false }))
);

// 2) krajiny без кешу
console.log("\n2) krajiny без кешу:");
const krajinyBulo = await zameraty("довідник країн", () =>
  Promise.resolve(db.from("krajiny").select("code, nazva, emoji"))
);

// 3) СТАЛО: krajiny з модульним кешем (імітація — другий виклик з пам'яті)
console.log("\n3) СТАЛО — krajiny з кешем (2-й виклик):");
const keshKrayin = new Map<string, unknown>();
const zKeshem = async () => {
  const klyuch = "krajiny";
  if (keshKrayin.has(klyuch)) return keshKrayin.get(klyuch);
  const { data } = await db.from("krajiny").select("code, nazva, emoji");
  keshKrayin.set(klyuch, data);
  return data;
};
await zKeshem(); // прогрів
const krajinyStalo = await zameraty("з кеша", () => zKeshem());

// 4) СТАЛО: trips з оптимізованим запитом (лише потрібні поля + ліміт)
console.log("\n4) СТАЛО — trips (оптимізовано: потрібні поля, ліміт 50):");
const stalo = await zameraty("оптимізований", () =>
  Promise.resolve(db.from("trips").select("id, title, country_code, budget, status").order("id", { ascending: false }).limit(50))
);

// Підсумок
console.log("\n" + "=".repeat(50));
console.log("ПІДСУМОК:");
console.log(`  Головна сторінка: ${bulo.toFixed(1)} мс → ${stalo.toFixed(1)} мс (${(bulo / stalo).toFixed(1)}× швидше)`);
console.log(`  Довідник країн:   ${krajinyBulo.toFixed(1)} мс → ${krajinyStalo.toFixed(1)} мс (кеш)`);
console.log("=".repeat(50));
