import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  List,
  Space,
  Statistic,
  Spin,
} from "antd";
import {
  ArrowLeftOutlined,
  BarChartOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Shapka from "../components/Shapka";
import {
  otrymatyStatystyku,
  otrymatyVidhuky,
  opratyuvatyVidhuk,
} from "../lib/analytika";
import type { Korystuvach, PidsumkyAnalityky, Vidhuk } from "../types";
import "./Analityka.css";

interface AnalitykaProps {
  korystuvach: Korystuvach;
  vlasnyk: boolean;
}

/** Коротке подання дати «2026-10-04» → «04.10». */
const skorotytyDen = (den: string): string => {
  const [, misyats, denChyslom] = den.split("-");
  return `${denChyslom}.${misyats}`;
};

function Analityka({ korystuvach, vlasnyk }: AnalitykaProps) {
  const nav = useNavigate();
  const [stats, setStats] = useState<PidsumkyAnalityky | null>(null);
  const [vidhuky, setVidhuky] = useState<Vidhuk[]>([]);
  const [zavantazhennya, setZavantazhennya] = useState(vlasnyk);
  const [pomylka, setPomylka] = useState("");

  // setState — лише ПІСЛЯ await: тоді ефект не запускає ланцюжок рендерів.
  const zavantazyty = useCallback(async () => {
    try {
      const [s, v] = await Promise.all([
        otrymatyStatystyku(),
        otrymatyVidhuky(),
      ]);
      setStats(s);
      setVidhuky(v);
      setPomylka("");
    } catch (e) {
      setPomylka(
        e instanceof Error ? e.message : "Не вдалося завантажити статистику"
      );
    } finally {
      setZavantazhennya(false);
    }
  }, []);

  useEffect(() => {
    if (!vlasnyk) return;
    const pid = window.setTimeout(() => void zavantazyty(), 0);
    return () => window.clearTimeout(pid);
  }, [vlasnyk, zavantazyty]);

  const pereklucyty = async (v: Vidhuk) => {
    try {
      await opratyuvatyVidhuk(v.id, !v.opraciovano);
      setVidhuky((star) =>
        star.map((it) =>
          it.id === v.id ? { ...it, opraciovano: !v.opraciovano } : it
        )
      );
    } catch (e) {
      setPomylka(e instanceof Error ? e.message : "Не вдалося оновити");
    }
  };

  if (!vlasnyk) {
    return (
      <div className="obolonka">
        <Shapka korystuvach={korystuvach} />
        <div className="vmist">
          <Alert
            type="warning"
            showIcon
            message="Ця сторінка лише для власника застосунку"
            description={
              <Space>
                <span>Статистика та відгуки приховані.</span>
                <Link to="/">На головну</Link>
              </Space>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="obolonka">
      <Shapka korystuvach={korystuvach} />

      <div className="vmist">
        <div className="analityka-shapka">
          <div>
            <h1>
              <span className="h1-tekst">Аналітика</span>
            </h1>
            <p className="privit">
              Хто заходить, що каже — усе анонімно, без імен і пошт.
            </p>
          </div>
          <Button
            icon={<ArrowLeftOutlined />}
            size="large"
            onClick={() => nav("/")}
          >
            На головну
          </Button>
        </div>

        {pomylka && (
          <Alert
            type="error"
            showIcon
            message={pomylka}
            closable
            onClose={() => setPomylka("")}
            style={{ marginBottom: 16 }}
          />
        )}

        {!vlasnyk ? null : zavantazhennya ? (
          <div className="start">
            <Spin size="large" />
            <p>Завантаження...</p>
          </div>
        ) : (
          <>
            <div className="pidsumky">
              <Card>
                <Statistic
                  title="Унікальних відвідувачів"
                  value={stats?.vsogoUnikalnyh ?? 0}
                  prefix="👥"
                />
              </Card>
              <Card>
                <Statistic
                  title="Заходів на сайт"
                  value={stats?.vsogoZapysiv ?? 0}
                  prefix="📈"
                />
              </Card>
              <Card>
                <Statistic
                  title="Відгуків"
                  value={vidhuky.length}
                  prefix="💬"
                />
              </Card>
            </div>

            <Card
              className="kartka-grafika"
              title={
                <Space>
                  <BarChartOutlined />
                  Відвідуваність по днях
                </Space>
              }
            >
              {stats && stats.dni.length > 0 ? (
                <div className="grafik-visota">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.dni.map((d) => ({
                        ...d,
                        podannya: skorotytyDen(d.den),
                      }))}
                      margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="podannya" fontSize={12} />
                      <YAxis allowDecimals={false} fontSize={12} />
                      <Tooltip />
                      <Bar
                        dataKey="unikalni"
                        name="Люди"
                        fill="#0d9488"
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="zapysiv"
                        name="Заходи"
                        fill="#99f6e4"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty
                  description="Поки що порожньо: даних ще не зібрано"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </Card>

            <Card
              className="kartka-vidhukiv"
              title={
                <Space>
                  <MessageOutlined />
                  Відгуки користувачів
                </Space>
              }
            >
              <List
                dataSource={vidhuky}
                locale={{ emptyText: "Відгуків ще немає" }}
                renderItem={(v) => (
                  <List.Item
                    actions={[
                      <Checkbox
                        key="op"
                        checked={v.opraciovano}
                        onChange={() => void pereklucyty(v)}
                      >
                        Опрацьовано
                      </Checkbox>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <span
                          className={
                            v.opraciovano ? "vidhuk-opracyovano" : undefined
                          }
                        >
                          {v.teks}
                        </span>
                      }
                      description={new Date(v.chas).toLocaleString("uk-UA")}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export default Analityka;
