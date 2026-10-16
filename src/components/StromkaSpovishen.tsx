// Тиждень 4: realtime-сповіщення (realtime-стрічка).
// Коли хтось створює/видаляє подорож — з'являється тут миттєво.

import { useSpovishennya } from "../lib/useSpovishennya";
import { Tag } from "antd";

const TYPY: Record<string, { kolir: string; emoji: string; tekst: (d: Record<string, string>) => string }> = {
  nova_podorozh: {
    kolir: "green",
    emoji: "➕",
    tekst: (d) => `Нова подорож: «${d.title}» (${d.country})`,
  },
  vydalena: {
    kolir: "red",
    emoji: "🗑️",
    tekst: (d) => `Видалено: «${d.title}» (${d.country})`,
  },
};

export default function StromkaSpovishen() {
  const spovishennya = useSpovishennya();

  if (spovishennya.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ margin: "8px 0", fontSize: 14, color: "#666" }}>
        🔔 Реальні оновлення
      </h4>
      {spovishennya.map((s) => {
        const t = TYPY[s.typ];
        if (!t) return null;
        return (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 0",
              borderBottom: "1px solid #f5f5f5",
              fontSize: 13,
            }}
          >
            <span>{t.emoji}</span>
            <Tag color={t.kolir}>{t.tekst(s.danі ?? {})}</Tag>
            <span style={{ color: "#999", fontSize: 12 }}>
              {s.user_name ?? "?"} ·{" "}
              {new Date(s.stvoreno_at).toLocaleTimeString("uk-UA")}
            </span>
          </div>
        );
      })}
    </div>
  );
}
