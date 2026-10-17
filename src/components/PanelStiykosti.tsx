// Тиждень 6: панель демонстрації стійкості до збоїв.
// Тестує: timeout, retry, rate limit, circuit breaker, graceful degradation.

import { useState } from "react";
import { Card, Button, Tag, message, Alert } from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";
import {
  zTimeout,
  zRetry,
  rateLimitAI,
  predokhranitelAI,
  uvimknenoFlag,
  zZapaskovym,
} from "../lib/stiykist";
import { log } from "../lib/logy";

interface RezultatTestu {
  nazva: string;
  stan: "ok" | "pomylka" | "zapaska";
  detalі: string;
  chas: number;
}

export default function PanelStiykosti() {
  const [rezultaty, setRezultaty] = useState<RezultatTestu[]>([]);
  const [messageApi, contextHolder] = message.useMessage();

  // Тест 1: Timeout — «вбиваємо» повільний запит
  const testTimeout = async () => {
    const pochatok = performance.now();
    try {
      // Запит, який «ніколи» не завершиться (10с)
      await zTimeout(new Promise((r) => setTimeout(r, 10_000)), 1000, "тест");
      setRezultaty((star) => [...star, { nazva: "Timeout", stan: "ok", detalі: "Не мав би пройти!", chas: performance.now() - pochatok }]);
    } catch {
      setRezultaty((star) => [...star, {
        nazva: "Timeout",
        stan: "pomylka",
        detalі: "✅ Спрацював: запит обірвано через 1с (не чекаємо 10с)",
        chas: performance.now() - pochatok,
      }]);
      void log.info("stiykist-test", "Timeout тест пройшов");
    }
  };

  // Тест 2: Retry — «вбиваємо» перші 2 спроби
  const testRetry = async () => {
    const pochatok = performance.now();
    let sproba = 0;
    try {
      const rezultat = await zRetry(
        async () => {
          sproba++;
          if (sproba < 3) throw new Error(`Спроба ${sproba} впала`);
          return "Успіх на 3-й спробі!";
        },
        { zminy: 3, zatrymkaMs: 100 }
      );
      setRezultaty((star) => [...star, {
        nazva: "Retry",
        stan: "ok",
        detalі: `✅ Працює: ${rezultat} (всього ${sproba} спроб)`,
        chas: performance.now() - pochatok,
      }]);
    } catch {
      setRezultaty((star) => [...star, { nazva: "Retry", stan: "pomylka", detalі: "Не спрацював!", chas: performance.now() - pochatok }]);
    }
  };

  // Тест 3: Rate Limit — 12 запитів за короткий час
  const testRateLimit = async () => {
    const pochatok = performance.now();
    const tempLimit = new (rateLimitAI.constructor as new (m: number, v: number) => typeof rateLimitAI)(5, 10_000);
    let dozvoleno = 0;
    let blokovano = 0;
    for (let i = 0; i < 8; i++) {
      if (tempLimit.dozvoleno()) dozvoleno++;
      else blokovano++;
    }
    setRezultaty((star) => [...star, {
      nazva: "Rate Limit",
      stan: "ok",
      detalі: `✅ Працює: ${dozvoleno} пройшло, ${blokovano} заблоковано (ліміт 5)`,
      chas: performance.now() - pochatok,
    }]);
  };

  // Тест 4: Circuit Breaker — 3 помилки поспіль
  const testCircuitBreaker = async () => {
    const pochatok = performance.now();
    const temp = new (predokhranitelAI.constructor as new (m: number, v: number) => typeof predokhranitelAI)(3, 5000);
    for (let i = 0; i < 3; i++) temp.zapisatyPomylku();
    const dozvoleno = temp.dozvoleno();
    setRezultaty((star) => [...star, {
      nazva: "Circuit Breaker",
      stan: dozvoleno ? "pomylka" : "ok",
      detalі: dozvoleno
        ? "❌ Не спрацював"
        : `✅ Спрацював: 3 помилки → запити заблоковано (стан: ${temp.yakStan()})`,
      chas: performance.now() - pochatok,
    }]);
  };

  // Тест 5: Graceful Degradation — «вбиваємо» основне джерело
  const testGraceful = async () => {
    const pochatok = performance.now();
    const rezultat = await zZapaskovym(
      async () => { throw new Error("Основне джерело «мертве»"); },
      () => "🚀 Запасний варіант працює!",
      { timeoutMs: 1000, retry: 1 }
    );
    setRezultaty((star) => [...star, {
      nazva: "Graceful Degradation",
      stan: rezultat.dzherelo === "zapaskove" ? "ok" : "pomylka",
      detalі: `✅ Джерело: ${rezultat.dzherelo} → ${rezultat.danі}`,
      chas: performance.now() - pochatok,
    }]);
  };

  // Тест 6: Feature Flag — вимкнути AI
  const testFeatureFlag = () => {
    const zaраз = uvimknenoFlag("ai", true);
    localStorage.setItem("ff:ai", String(!zaраз));
    const novyiStan = uvimknenoFlag("ai", true);
    messageApi.info(`AI ${novyiStan ? "увімкнено" : "вимкнено"} (без правки коду!)`);
    setRezultaty((star) => [...star, {
      nazva: "Feature Flag",
      stan: "ok",
      detalі: `✅ AI: ${zaраз} → ${novyiStan}. Повернути: localStorage.removeItem("ff:ai")`,
      chas: 0,
    }]);
  };

  const ochystyty = () => setRezultaty([]);

  return (
    <Card
      title={
        <>
          <SafetyCertificateOutlined /> Тестування стійкості 🧯
        </>
      }
      extra={<Button onClick={ochystyty}>Очистити</Button>}
    >
      {contextHolder}

      <Alert
        message="Натисни кнопки — побачиш як працює кожен прийом стійкості"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Button onClick={() => void testTimeout()}>⏱️ Timeout</Button>
        <Button onClick={() => void testRetry()}>🔄 Retry</Button>
        <Button onClick={() => void testRateLimit()}>🚦 Rate Limit</Button>
        <Button onClick={() => void testCircuitBreaker()}>⚡ Circuit Breaker</Button>
        <Button onClick={() => void testGraceful()}>🛟 Graceful Degradation</Button>
        <Button onClick={testFeatureFlag}>🚩 Feature Flag</Button>
      </div>

      {rezultaty.map((r, i) => (
        <div
          key={i}
          style={{
            padding: "8px 12px",
            marginBottom: 8,
            borderRadius: 6,
            background: r.stan === "ok" ? "#f6ffed" : r.stan === "zapaska" ? "#fffbe6" : "#fff2f0",
            border: `1px solid ${r.stan === "ok" ? "#b7eb8f" : r.stan === "zapaska" ? "#ffe58f" : "#ffccc7"}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>{r.nazva}</b>
            <Tag color={r.stan === "ok" ? "green" : r.stan === "zapaska" ? "orange" : "red"}>
              {r.stan}
            </Tag>
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{r.detalі}</div>
          {r.chas > 0 && (
            <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
              ⏱️ {r.chas.toFixed(0)} мс
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}
