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

export const vyklikatyAI = async (
  prompt: string
): Promise<VidpovidAI> => {
  const klyuch = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "gemini-2.0-flash";
  if (!klyuch) {
    throw new PomylkaAI(
      503,
      "ШІ ще не налаштовано: немає LLM_API_KEY у server/.env"
    );
  }

  let vidpovid: Response;
  try {
    vidpovid = await fetch(adres(model), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": klyuch },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new PomylkaAI(502, "Модель не відповідає — спробуй пізніше");
  }

  if (!vidpovid.ok) {
    throw new PomylkaAI(
      502,
      `Модель відмовилась (HTTP ${vidpovid.status}) — спробуй пізніше`
    );
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
