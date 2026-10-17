// Тиждень 8: панель здоров'я сервісу.
// Показує: швидкість, помилки, навантаження, статус бази.

import { useEffect, useState } from "react";
import supabase from "../supabase";
import { Card, Progress, Row, Col, Statistic, Alert, Button } from "antd";
import { HeartFilled, ReloadOutlined } from "@ant-design/icons";

interface Zdorovya {
  baza: "pratsuye" | "nevidpovidaє";
  chasBazyMs: number;
  kilkistPodorozhey: number;
  kilkistKrayin: number;
  kilkistLogiv: number;
  kilkistPomylok24h: number;
  kilkistOnline: number;
  chasOstanohoOgljadu: string;
}

export default function PanelZdorovya() {
  const [zdorovya, setZdorovya] = useState<Zdorovya | null>(null);
  const [zavantazhennya, setZavantazhennya] = useState(false);

  const pereviryty = async () => {
    setZavantazhennya(true);
    const pochatok = performance.now();

    // Перевірка бази
    const { error: bazaError } = await supabase
      .from("krajiny")
      .select("code")
      .limit(1);

    const chasBazyMs = performance.now() - pochatok;
    const baza = bazaError ? "nevidpovidaє" : "pratsuye";

    // Збираємо статистику паралельно
    const [podorozhi, krajiny, logy, online] = await Promise.all([
      supabase.from("trips").select("id", { count: "exact", head: true }),
      supabase.from("krajiny").select("code", { count: "exact", head: true }),
      supabase.from("logy").select("id", { count: "exact", head: true }),
      supabase.from("online_korystuvachi").select("sid"),
    ]);

    // Помилки за 24 години
    const chas24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: kilkistPomylok } = await supabase
      .from("logy")
      .select("id", { count: "exact", head: true })
      .in("riven", ["error", "critical"])
      .gte("stvoreno_at", chas24h);

    setZdorovya({
      baza,
      chasBazyMs,
      kilkistPodorozhey: podorozhi.count ?? 0,
      kilkistKrayin: krajiny.count ?? 0,
      kilkistLogiv: logy.count ?? 0,
      kilkistPomylok24h: kilkistPomylok ?? 0,
      kilkistOnline: online.data?.length ?? 0,
      chasOstanohoOgljadu: new Date().toLocaleTimeString("uk-UA"),
    });

    setZavantazhennya(false);
  };

  useEffect(() => {
    void pereviryty();
    // Оновлюємо кожні 30 секунд
    const timer = setInterval(() => void pereviryty(), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Оцінка здоров'я
  const ocinka = zdorovya
    ? zdorovya.baza === "nevidpovidaє"
      ? { kolir: "red", proc: 0, tekst: "❌ База недоступна" }
      : (zdorovya.kilkistPomylok24h ?? 0) > 10
        ? { kolir: "orange", proc: 60, tekst: "⚠️ Багато помилок" }
        : zdorovya.chasBazyMs > 1000
          ? { kolir: "orange", proc: 70, tekst: "⚠️ База повільна" }
          : { kolir: "green", proc: 100, tekst: "✅ Все добре" }
    : { kolir: "blue", proc: 0, tekst: "⏳ Перевіряємо..." };

  return (
    <Card
      title={
        <>
          <HeartFilled style={{ color: "#ff4d4f" }} /> Здоров'я сервісу
        </>
      }
      extra={
        <Button
          icon={<ReloadOutlined />}
          onClick={() => void pereviryty()}
          loading={zavantazhennya}
        />
      }
    >
      {/* Загальна оцінка */}
      <Alert
        message={ocinka.tekst}
        type={zdorovya?.baza === "nevidpovidaє" ? "error" : (zdorovya?.kilkistPomylok24h ?? 0) > 10 ? "warning" : "success"}
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Progress
        percent={ocinka.proc}
        status={ocinka.proc === 100 ? "success" : "active"}
        strokeColor={ocinka.kolir}
        style={{ marginBottom: 24 }}
      />

      {/* Статистика */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={8}>
          <Statistic
            title="База даних"
            value={zdorovya?.chasBazyMs.toFixed(0) ?? "—"}
            suffix="мс"
            valueStyle={{
              color: (zdorovya?.chasBazyMs ?? 0) < 500 ? "#52c41a" : "#ff4d4f",
            }}
          />
        </Col>
        <Col xs={12} md={8}>
          <Statistic
            title="Подорожі"
            value={zdorovya?.kilkistPodorozhey ?? "—"}
          />
        </Col>
        <Col xs={12} md={8}>
          <Statistic
            title="Країни"
            value={zdorovya?.kilkistKrayin ?? "—"}
          />
        </Col>
        <Col xs={12} md={8}>
          <Statistic
            title="Логи"
            value={zdorovya?.kilkistLogiv ?? "—"}
          />
        </Col>
        <Col xs={12} md={8}>
          <Statistic
            title="Помилки (24г)"
            value={zdorovya?.kilkistPomylok24h ?? "—"}
            valueStyle={{
              color: (zdorovya?.kilkistPomylok24h ?? 0) > 5 ? "#ff4d4f" : "#52c41a",
            }}
          />
        </Col>
        <Col xs={12} md={8}>
          <Statistic
            title="Онлайн"
            value={zdorovya?.kilkistOnline ?? "—"}
            valueStyle={{ color: "#1677ff" }}
          />
        </Col>
      </Row>

      {/* Статус */}
      <div style={{ marginTop: 16, textAlign: "right", fontSize: 12, color: "#999" }}>
        Остання перевірка: {zdorovya?.chasOstanohoOgljadu ?? "—"}
      </div>
    </Card>
  );
}
