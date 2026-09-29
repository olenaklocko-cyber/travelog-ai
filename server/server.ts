import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { poradaDlya } from "./logika.ts";

const port = Number(process.env.SERVER_PORT) || 3001;

/**
 * 🔑 СЕКРЕТНИЙ ключ промо-кодів.
 * Він живе у server/.env — файл НЕ потрапляє у git і НЕ відправляється у браузер.
 * (У застосунку ключі з префіксом VITE_ — навпаки, ВИДНІ всім.)
 */
const sekretnyyKlyuch = process.env.PROMO_SECRET ?? "demo-secret";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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

createServer((zapit: IncomingMessage, vidpovid: ServerResponse) => {
  const url = new URL(zapit.url ?? "/", "http://localhost");

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

  // Невідомий шлях → теж наша відмова
  nadislaty(vidpovid, 404, { pomylka: "Немає такого ендпоінта" });
}).listen(port, () => {
  console.log(`🖥 Travelog API: http://localhost:${port}/api/zdorovya`);
});
