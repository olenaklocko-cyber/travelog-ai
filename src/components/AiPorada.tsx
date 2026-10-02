import { useState } from "react";
import { Button, Input, Spin } from "antd";
import supabase from "../supabase";
import { apiAdres } from "../lib/api";
import type { Podorozh } from "../types";

interface AiPoradaProps {
  podorozh: Podorozh | null;
}

type StanAI =
  | { stan: "spokijno" }
  | { stan: "shukayemo" }
  | { stan: "vidpovid"; tekst: string; model: string; zalyshok?: number }
  | { stan: "pomylka"; tekst: string };

const shvytriZapyty = [
  "Що взяти з собою в цю подорож?",
  "Як заощадити в поїздці?",
  "Порадь що подивитись місцевим?",
];

/**
 * 🤖 AI-порада: запит летить на НАШ сервер (POST /api/ai/porada),
 * сервер перевіряє логін + ліміт, вже потім дзвонить у модель.
 * Ключ моделі у браузер не потрапляє — його взагалі тут немає.
 */
export default function AiPorada({ podorozh }: AiPoradaProps) {
  const [zapitAI, setZapitAI] = useState("");
  const [stanAI, setStanAI] = useState<StanAI>({ stan: "spokijno" });

  const zapytatyAI = async (tekst?: string) => {
    const zapyt = (tekst ?? zapitAI).trim();
    if (!zapyt || !podorozh) return;
    if (stanAI.stan === "shukayemo") return;
    setStanAI({ stan: "shukayemo" });
    try {
      const { data } = await supabase.auth.getSession();
      const tokyn = data.session?.access_token;
      const vidpovid = await fetch(apiAdres("/api/ai/porada"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tokyn ? { Authorization: `Bearer ${tokyn}` } : {}),
        },
        body: JSON.stringify({ zapyt, krajyna: podorozh.country_code }),
      });
      const dany = (await vidpovid.json()) as {
        odpovid?: string;
        model?: string;
        zalyshok?: number;
        pomylka?: string;
      };
      if (!vidpovid.ok) {
        setStanAI({
          stan: "pomylka",
          tekst: dany.pomylka ?? "Сервер відмовив (невідома помилка)",
        });
        return;
      }
      setStanAI({
        stan: "vidpovid",
        tekst: dany.odpovid ?? "",
        model: dany.model ?? "",
        zalyshok: dany.zalyshok,
      });
    } catch {
      setStanAI({
        stan: "pomylka",
        tekst: "Сервер AI не відповідає — запусти: npm run server",
      });
    }
  };

  return (
    <div className="server-kartka ai-kartka">
      <h3>🤖 Розумна порада від ШІ</h3>
      <p className="ai-pidkazka">
        Запит іде на наш сервер → сервер перевіряє, що ти увійшла і що ліміт не
        вичерпано → уже потім дзвонить у модель. Ключ моделі лишається на
        сервері.
      </p>
      <div className="ai-ryadok">
        <Input
          value={zapitAI}
          onChange={(e) => setZapitAI(e.target.value)}
          placeholder="Напиши запит, напр.: що взяти до Японії в листопаді?"
          maxLength={500}
          onPressEnter={() => void zapytatyAI()}
          disabled={stanAI.stan === "shukayemo"}
        />
        <Button
          type="primary"
          loading={stanAI.stan === "shukayemo"}
          onClick={() => void zapytatyAI()}
        >
          Запитати ШІ
        </Button>
      </div>
      <div className="ai-shvytri">
        {shvytriZapyty.map((shvytryy) => (
          <Button
            key={shvytryy}
            size="small"
            disabled={stanAI.stan === "shukayemo"}
            onClick={() => void zapytatyAI(shvytryy)}
          >
            {shvytryy}
          </Button>
        ))}
      </div>
      {stanAI.stan === "shukayemo" && (
        <div className="ai-stan">
          <Spin size="small" /> ШІ думає над відповіддю...
        </div>
      )}
      {stanAI.stan === "pomylka" && (
        <>
          <p className="ai-stan ai-pomylka">{stanAI.tekst}</p>
          <div className="ai-shvytri">
            <Button size="small" onClick={() => setStanAI({ stan: "spokijno" })}>
              🔁 Спробувати ще раз
            </Button>
          </div>
        </>
      )}
      {stanAI.stan === "vidpovid" && (
        <div className="ai-vidpovid">
          <p>{stanAI.tekst}</p>
          <p className="ai-meta">
            🤖 модель {stanAI.model} — на сервері
            {stanAI.zalyshok !== undefined && (
              <>
                {" "}
                · залишилось запитів до ліміту: <b>{stanAI.zalyshok}</b>
              </>
            )}
          </p>
          <div className="ai-shvytri">
            <Button
              size="small"
              onClick={() => {
                setStanAI({ stan: "spokijno" });
                setZapitAI("");
              }}
            >
              🔁 Запитай ще
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
