/**
 * Адреса НАШОГО сервера (server/server.ts).
 *
 * Локально: http://localhost:3001 (за замовчуванням).
 * На хостингу: задай VITE_API_BASE (або порожній рядок — тоді запити підуть
 * на той самий домен, куди задеплоєний фронт).
 *
 * Ключ моделі сюди НЕ потрапляє — він лише на сервері (server/.env).
 */
export const API_BASE: string = (
  import.meta.env.VITE_API_BASE ?? "http://localhost:3001"
).replace(/\/$/, "");

export const apiAdres = (shlyah: string): string =>
  `${API_BASE}${shlyah.startsWith("/") ? shlyah : `/${shlyah}`}`;
