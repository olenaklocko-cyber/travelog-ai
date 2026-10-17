// Тиждень 6: AI-сервіс зі стійкістю до збоїв.
// Викликає зовнішній AI API з: timeout, retry, rate limit, circuit breaker, graceful degradation.

import {
  zTimeout,
  zRetry,
  rateLimitAI,
  predokhranitelAI,
  uvimknenoFlag,
} from "./stiykist";
import { log } from "./logy";

const AI_API_URL = "/api/porada";

export interface AIvіdpovіdіdь {
  tekst: string;
  dzherelo: "ai" | "zapaska";
  shvydkist: number; // мс
}

// Запасні відповіді (graceful degradation)
const ZAPASNI_VIDPOVIDI: Record<string, string> = {
  default:
    "🤖 AI зараз недоступний, ось базові поради: перевір документи, купі авіаквитки заздалегідь, і не забудь страховку! ✈️",
  IT: "🇮🇹 Італія: Рим, Венеція, Флоренція. Спробуй піцу в Неаполі та гелато в Римі!",
  FR: "🇫🇷 Франція: Париж, Ліон, Ніцца. Ейфелева вежа та круасани — must have!",
  JP: "🇯🇵 Японія: Токіо, Кіото, Осака. Суші, храми та вишневий цвіт!",
  UA: "🇺🇦 Україна: Київ, Львів, Одеса. Борщ, сирники та Карпати!",
  EG: "🇪🇬 Єгипет: Хургада, Шарм-ель-Шейх. Червоне море та піраміди!",
};

export async function otrymatyAIporadu(
  countryCode: string,
  nazva: string
): Promise<AIvіdpovіdіdь> {
  const pochatok = performance.now();

  // 0) Feature flag: AI можна вимкнути без правки коду
  if (!uvimknenoFlag("ai", true)) {
    log.info("ai", "AI вимкнено feature flag'ом");
    return {
      tekst: ZAPASNI_VIDPOVIDI[countryCode] ?? ZAPASNI_VIDPOVIDI.default,
      dzherelo: "zapaska",
      shvydkist: performance.now() - pochatok,
    };
  }

  // 1) Rate limit: не більше 10 запитів на хвилину
  if (!rateLimitAI.dozvoleno()) {
    log.warning("ai", "Rate limit: забагато AI-запитів");
    return {
      tekst: ZAPASNI_VIDPOVIDI[countryCode] ?? ZAPASNI_VIDPOVIDI.default,
      dzherelo: "zapaska",
      shvydkist: performance.now() - pochatok,
    };
  }

  // 2) Circuit breaker: якщо AI «мертвий» — не доливаємо
  if (!predokhranitelAI.dozvoleno()) {
    log.warning("ai", "Circuit breaker відкрито: AI недоступний");
    return {
      tekst: ZAPASNI_VIDPOVIDI[countryCode] ?? ZAPASNI_VIDPOVIDI.default,
      dzherelo: "zapaska",
      shvydkist: performance.now() - pochatok,
    };
  }

  // 3) Основний запит з timeout (5с) + retry (2 спроби)
  try {
    const vіdpovіdіdь = await zTimeout(
      zRetry(
        async () => {
          const response = await fetch(AI_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ country: countryCode, name: nazva }),
          });
          if (!response.ok) {
            throw new Error(`AI API: HTTP ${response.status}`);
          }
          return (await response.json()) as { text?: string };
        },
        { zminy: 2, zatrymkaMs: 300 }
      ),
      5000, // timeout 5 секунд
      "AI запит"
    );

    predokhranitelAI.zapisatyUspikh();
    const tekst = vіdpovіdіdь.text ?? ZAPASNI_VIDPOVIDI[countryCode] ?? ZAPASNI_VIDPOVIDI.default;

    return {
      tekst: tekst,
      dzherelo: "ai",
      shvydkist: performance.now() - pochatok,
    };
  } catch (pomylka) {
    // 4) Circuit breaker: фіксуємо помилку
    predokhranitelAI.zapisatyPomylku();

    log.warning("ai", `AI недоступний: ${(pomylka as Error).message}`, {
      countryCode,
      stanPredokhranitelya: predokhranitelAI.yakStan(),
    });

    // 5) Graceful degradation: запасна відповідь
    return {
      tekst: ZAPASNI_VIDPOVIDI[countryCode] ?? ZAPASNI_VIDPOVIDI.default,
      dzherelo: "zapaska",
      shvydkist: performance.now() - pochatok,
    };
  }
}
