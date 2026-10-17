// Тиждень 5: панель логів (моніторинг помилок).
// Показує логи з Supabase: помилки, попередження, події.

import { useEffect, useState } from "react";
import supabase from "../supabase";
import { Card, Tag, Select, Button, Empty } from "antd";
import { ReloadOutlined, BugOutlined } from "@ant-design/icons";

interface LogEntry {
  id: string;
  riven: string;
  dzherelo: string;
  povidomlennya: string;
  kontekst: Record<string, unknown> | null;
  storinka: string | null;
  stvoreno_at: string;
}

const RIVNI: Record<string, { kolir: string; emoji: string }> = {
  debug: { kolir: "default", emoji: "🔍" },
  info: { kolir: "blue", emoji: "ℹ️" },
  warning: { kolir: "orange", emoji: "⚠️" },
  error: { kolir: "red", emoji: "❌" },
  critical: { kolir: "magenta", emoji: "🚨" },
};

export default function PanelLogiv() {
  const [logy, setLogy] = useState<LogEntry[]>([]);
  const [filtrRiven, setFiltrRiven] = useState<string>("all");
  const [zavantazhennya, setZavantazhennya] = useState(false);
  const [pokazanyDetail, setPokazanyDetail] = useState<string | null>(null);

  const zavantazhyty = async () => {
    setZavantazhennya(true);
    let zapyt = supabase
      .from("logy")
      .select("*")
      .order("stvoreno_at", { ascending: false })
      .limit(50);

    if (filtrRiven !== "all") {
      zapyt = zapyt.eq("riven", filtrRiven);
    }

    const { data } = await zapyt;
    setLogy(data ?? []);
    setZavantazhennya(false);
  };

  useEffect(() => {
    void zavantazhyty();
    // Оновлюємо кожні 15 секунд
    const timer = setInterval(() => void zavantazhyty(), 15_000);
    return () => clearInterval(timer);
  }, [filtrRiven]);

  // Лічильники
  const lychilnyky = {
    error: logy.filter((l) => l.riven === "error" || l.riven === "critical").length,
    warning: logy.filter((l) => l.riven === "warning").length,
    info: logy.filter((l) => l.riven === "info").length,
  };

  return (
    <Card
      title={
        <>
          <BugOutlined /> Логи та моніторинг
        </>
      }
      extra={
        <Button
          icon={<ReloadOutlined />}
          onClick={() => void zavantazhyty()}
          loading={zavantazhennya}
        />
      }
    >
      {/* Лічильники */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <Tag color="red" style={{ fontSize: 14 }}>
          ❌ {lychilnyky.error} помилок
        </Tag>
        <Tag color="orange" style={{ fontSize: 14 }}>
          ⚠️ {lychilnyky.warning} попереджень
        </Tag>
        <Tag color="blue" style={{ fontSize: 14 }}>
          ℹ️ {lychilnyky.info} подій
        </Tag>
      </div>

      {/* Фільтр */}
      <Select
        value={filtrRiven}
        onChange={setFiltrRiven}
        style={{ width: 200, marginBottom: 16 }}
        options={[
          { value: "all", label: "Усі рівні" },
          { value: "error", label: "❌ Помилки" },
          { value: "warning", label: "⚠️ Попередження" },
          { value: "info", label: "ℹ️ Події" },
          { value: "debug", label: "🔍 Debug" },
        ]}
      />

      {/* Список логів */}
      {logy.length === 0 ? (
        <Empty description="Логів поки немає" />
      ) : (
        <div style={{ maxHeight: 400, overflow: "auto" }}>
          {logy.map((l) => {
            const r = RIVNI[l.riven] ?? RIVNI.info;
            const rozgorнутyy = pokazanyDetail === l.id;
            return (
              <div
                key={l.id}
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid #f0f0f0",
                  cursor: "pointer",
                  background: l.riven === "error" || l.riven === "critical" ? "#fff2f0" : undefined,
                }}
                onClick={() => setPokazanyDetail(rozgorнутyy ? null : l.id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{r.emoji}</span>
                  <Tag color={r.kolir}>{l.riven}</Tag>
                  <Tag>{l.dzherelo}</Tag>
                  <span style={{ flex: 1, fontSize: 14 }}>{l.povidomlennya}</span>
                  <span style={{ fontSize: 12, color: "#999" }}>
                    {new Date(l.stvoreno_at).toLocaleTimeString("uk-UA")}
                  </span>
                </div>
                {rozgorнутyy && l.kontekst && (
                  <pre
                    style={{
                      marginTop: 8,
                      padding: 8,
                      background: "#f5f5f5",
                      borderRadius: 4,
                      fontSize: 11,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {JSON.stringify(l.kontekst, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
