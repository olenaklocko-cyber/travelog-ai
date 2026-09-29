/**
 * 🤖 Виклик ШІ-моделі (Google Gemini) — з СЕРВЕРА.
 * Ключ LLM_API_KEY читається лише з server/.env — у браузер він не потрапляє.
 */

const adres = (model: string): string =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

interface VidpovidGemini {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

export interface VidpovidAI {
  tekst: string;
  model: string;
}

export class PomylkaAI extends Error {
  readonly kod: number;

  constructor(kod: number, message: string) {
    super(message);
    this.kod = kod;
    this.name = "PomylkaAI";
  }
}

const CHAS_OCHKI = 40_000;
const SPROBY = 4;
const VSYO_MAX = 95_000; // загальний бюджет часу на всі спроби
const CHYNY = [1_500, 3_000, 5_000, 8_000];
const zatyshky = (ms: number): Promise<void> =>
  new Promise((riznytsya) => setTimeout(riznytsya, ms));

// Google сам пише, скільки чекати: "Please retry in 31.9s"
const chasChekannya = (
  tekstPomylky: string,
  sproba: number,
  lishylo: number
): number => {
  const znaideno = /retry in ([\d.]+)s/i.exec(tekstPomylky);
  const sekundy = znaideno ? Number(znaideno[1]) : Number.NaN;
  const bachyty = Number.isFinite(sekundy) && sekundy > 0
    ? Math.min(sekundy * 1000 + 700, 65_000)
    : CHYNY[sproba] ?? 8_000;
  return Math.min(bachyty, lishylo);
};

export const vyklikatyAI = async (
  prompt: string
): Promise<VidpovidAI> => {
  const klyuch = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "gemini-3.8-flash";
  if (!klyuch) {
    throw new PomylkaAI(
      503,
      "ШІ ще не налаштовано: немає LLM_API_KEY у server/.env"
    );
  }

  let vidpovid: Response | null = null;
  let pomylkaKoda = 0;
  const start = Date.now();
  for (let sproba = 0; sproba < SPROBY; sproba += 1) {
    const lishylo = VSYO_MAX - (Date.now() - start);
    if (lishylo <= 0) break;
    try {
      vidpovid = await fetch(adres(model), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": klyuch },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
        }),
        signal: AbortSignal.timeout(Math.min(CHAS_OCHKI, lishylo)),
      });
    } catch {
      throw new PomylkaAI(502, "Модель не відповідає — спробуй пізніше");
    }

    if (vidpovid.ok) break;
    pomylkaKoda = vidpovid.status;
    // 429/500/503 — тимчасові: чекаємо й пробуємо ще раз
    if (vidpovid.status !== 429 && vidpovid.status !== 500 && vidpovid.status !== 503) {
      break;
    }
    let tekstPomylky = "";
    try {
      tekstPomylky = await vidpovid.text();
    } catch {
      tekstPomylky = "";
    }
    vidpovid = null;
    const chekatyMs = chasChekannya(
      tekstPomylky,
      sproba,
      VSYO_MAX - (Date.now() - start)
    );
    if (chekatyMs <= 0) break;
    await zatyshky(chekatyMs);
  }

  if (!vidpovid || !vidpovid.ok) {
    const kod = vidpovid ? vidpovid.status : pomylkaKoda || 503;
    throw new PomylkaAI(502, `Модель відмовилась (HTTP ${kod}) — спробуй пізніше`);
  }

  const dany = (await vidpovid.json()) as VidpovidGemini;
  const tekst = dany.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!tekst) {
    throw new PomylkaAI(502, "Модель повернула порожню відповідь");
  }
  return { tekst, model };
};
