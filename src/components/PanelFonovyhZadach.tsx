// Тиждень 3: панель фонових задач (черга + звіти).
// Показує: що в черзі, що вже зроблено, коли був останній звіт.

import { useEffect, useState } from "react";
import supabase from "../supabase";
import { Button, Card, Tag, message } from "antd";
import { ClockCircleOutlined, ReloadOutlined } from "@ant-design/icons";

interface FonovaZadacha {
  id: string;
  typ: string;
  status: string;
  spryamovano_at: string;
  zakincheno_at: string | null;
}

interface ZvitDen {
  den: string;
  vsego_podorozhey: number;
  vsego_vytrat: number;
  vsego_zibrano: number;
  kilkist_korystuvachiv: number;
}

const STATUSY: Record<string, { kolir: string; nazva: string }> = {
  ochikuyu: { kolir: "orange", nazva: "Очікує" },
  "pracyuyе": { kolir: "blue", nazva: "Працює" },
  gotovo: { kolir: "green", nazva: "Готово" },
  pomylka: { kolir: "red", nazva: "Помилка" },
};

const TYPY: Record<string, string> = {
  zvit: "📊 Щоденний звіт",
  obrobotka_foto: "🖼️ Обробка фото",
  ai_rekomendaciya: "🤖 AI-рекомендація",
};

export default function PanelFonovyhZadach() {
  const [zadachi, setZadachi] = useState<FonovaZadacha[]>([]);
  const [zvity, setZvity] = useState<ZvitDen[]>([]);
  const [zavantazhennya, setZavantazhennya] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const zavantazhyty = async () => {
    setZavantazhennya(true);
    const [zad, zvi] = await Promise.all([
      supabase
        .from("fonovi_zadachi")
        .select("*")
        .order("spryamovano_at", { ascending: false })
        .limit(20),
      supabase
        .from("zvity_den")
        .select("*")
        .order("den", { ascending: false })
        .limit(7),
    ]);
    setZadachi(zad.data ?? []);
    setZvity(zvi.data ?? []);
    setZavantazhennya(false);
  };

  useEffect(() => {
    void zavantazhyty();
    // Оновлюємо кожні 10 секунд
    const timer = setInterval(() => void zavantazhyty(), 10_000);
    return () => clearInterval(timer);
  }, []);

  const dobavytyZadachu = async (typ: string) => {
    const { error } = await supabase.rpc("poklasty_u_chergu", {
      p_typ: typ,
      p_dani: {},
      p_pryoritet: 0,
    });
    if (error) {
      messageApi.error("Не вдалося додати задачу: " + error.message);
      return;
    }
    messageApi.success(`Задачу «${TYPY[typ]}» покладено в чергу!`);
    void zavantazhyty();
  };

  const ochistyty = async () => {
    await supabase
      .from("fonovi_zadachi")
      .delete()
      .eq("status", "gotovo");
    messageApi.success("Готові задачі очищено");
    void zavantazhyty();
  };

  return (
    <Card
      title={
        <>
          <ClockCircleOutlined /> Фонові задачі (черга)
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
      {contextHolder}

      {/* Кнопки для додавання задач */}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button onClick={() => void dobavytyZadachu("zvit")}>
          📊 Звіт зараз
        </Button>
        <Button onClick={() => void dobavytyZadachu("obrobotka_foto")}>
          🖼️ Обробити фото
        </Button>
        <Button onClick={() => void dobavytyZadachu("ai_rekomendaciya")}>
          🤖 AI-факти
        </Button>
        <Button onClick={() => void ochistyty()} danger>
          Очистити готові
        </Button>
      </div>

      {/* Список задач */}
      <div style={{ maxHeight: 300, overflow: "auto" }}>
        {zadachi.length === 0 ? (
          <p style={{ color: "#999" }}>Черга порожня</p>
        ) : (
          zadachi.map((z) => {
            const st = STATUSY[z.status] ?? STATUSY.ochikuyu;
            return (
              <div
                key={z.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <span>{TYPY[z.typ] ?? z.typ}</span>
                <div>
                  <Tag color={st.kolir}>{st.nazva}</Tag>
                  <span style={{ fontSize: 12, color: "#999" }}>
                    {new Date(z.spryamovano_at).toLocaleTimeString("uk-UA")}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Щоденні звіти */}
      {zvity.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4>📈 Щоденні звіти</h4>
          {zvity.map((z) => (
            <div
              key={z.den}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px solid #f0f0f0",
                fontSize: 14,
              }}
            >
              <span>{z.den}</span>
              <span>
                {z.vsego_podorozhey} подорожей · {z.vsego_vytrat} грн витрат ·{" "}
                {z.vsego_zibrano} грн зібрано
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
