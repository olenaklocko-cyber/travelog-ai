/**
 * Адреса НАШОГО сервера (server/server.ts).
 *
 * Локально: http://localhost:3001 (за замовчуванням).
 * На хостингу: задай VITE_API_BASE (або порожній рядок — тоді запити підуть
 * на той самий домен, куди задеплоєний фронт).
 *
 * Ключ моделі сюди НЕ потрапляє — він лише на сервері (server/.env).
 */
const LOCALLY = "http://localhost:3001";

export const API_BASE: string = (
  // Прод (Vercel/GitHub Pages): запити йдуть на ТОЙ САМИЙ домен —
  // у браузера користувача немає нашого сервера на localhost.
  import.meta.env.VITE_API_BASE ??
  (import.meta.env.PROD ? "" : LOCALLY)
).replace(/\/$/, "");

export const apiAdres = (shlyah: string): string =>
  `${API_BASE}${shlyah.startsWith("/") ? shlyah : `/${shlyah}`}`;
