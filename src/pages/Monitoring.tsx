// Тиждень 8: сторінка моніторингу.
// Тут: фонові задачі, логи, стійкість, здоров'я сервісу.
// З головної сторінки — кнопка «Моніторинг».

import { Button } from "antd";
import { ArrowLeftOutlined, DashboardOutlined, BugOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Shapka from "../components/Shapka";
import PanelFonovyhZadach from "../components/PanelFonovyhZadach";
import PanelLogiv from "../components/PanelLogiv";
import PanelStiykosti from "../components/PanelStiykosti";
import PanelZdorovya from "../components/PanelZdorovya";
import { log } from "../lib/logy";
import type { Korystuvach } from "../types";

function Monitoring({ korystuvach }: { korystuvach: Korystuvach }) {
  const nav = useNavigate();

  const zlamatyKod = () => {
    log.info("demo", "Користувач натиснув «Зламати код»");
    setTimeout(() => {
      throw new Error("Навмисна помилка для демонстрації логування! 🐛");
    }, 100);
  };

  return (
    <div className="obolonka">
      <Shapka korystuvach={korystuvach} />

      <div className="vmist">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ margin: 0 }}>
            <DashboardOutlined /> Моніторинг сервісу
          </h1>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => nav("/")}
            size="large"
          >
            На головну
          </Button>
        </div>

        {/* Здоров'я сервісу */}
        <div style={{ marginBottom: 24 }}>
          <PanelZdorovya />
        </div>

        {/* Фонові задачі */}
        <div style={{ marginBottom: 24 }}>
          <PanelFonovyhZadach />
        </div>

        {/* Логи та моніторинг */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8, textAlign: "right" }}>
            <Button
              danger
              icon={<BugOutlined />}
              onClick={zlamatyKod}
              title="Навмисна помилка для демонстрації логування"
            >
              🐛 Зламати код
            </Button>
          </div>
          <PanelLogiv />
        </div>

        {/* Стійкість до збоїв */}
        <div style={{ marginBottom: 24 }}>
          <PanelStiykosti />
        </div>
      </div>
    </div>
  );
}

export default Monitoring;
