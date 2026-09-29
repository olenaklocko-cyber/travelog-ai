import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  message,
} from "antd";
import { PlusOutlined, SendOutlined } from "@ant-design/icons";
import supabase from "../supabase";
import Shapka from "../components/Shapka";
import { krajiny, krajinyVyboru, statusy, dodatyKrayinuMapy } from "../data/krajiny";
import { obkladynkaPodorozhi } from "../data/obkladynky";
import {
  zavantazhPodorozhiAPI,
  zberezhytyPodorozhAPI,
  vydalytyPodorozhAPI,
  prykhovaniMock,
  prykhovatyMock,
} from "../data/podorozhiAPI";
import { populyarniDestynaciyi } from "../data/populyarniDestynaciyi";
import { zastosuvatyBudzety, zastosuvatyZibrano } from "../data/budzety";
import { ciToVlasnyk } from "../data/dostup";
import { mockTrips } from "../data/mockTrips";
import type { Korystuvach, Podorozh, StatusPodorozhi } from "../types";
import {
  formatHryven,
  normZapyt,
  praporZCode,
  procentZibrano,
  statusDozvolenyy,
} from "../lib/rakhunky";
import "./Golovna.css";

const versalizuvaty = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const timeoutDlyaFetch = () =>
  typeof AbortSignal !== "undefined" && AbortSignal.timeout
    ? AbortSignal.timeout(10000)
    : undefined;

const kolirStatusu: Record<
  StatusPodorozhi,
  { tag: string; smuga: string }
> = {
  "Активні збори": {
    tag: "processing",
    smuga: "linear-gradient(90deg, #0d9488, #2dd4bf)",
  },
  "Плануються": {
    tag: "warning",
    smuga: "linear-gradient(90deg, #f59e0b, #fbbf24)",
  },
  "Вже відвідані": {
    tag: "success",
    smuga: "linear-gradient(90deg, #16a34a, #4ade80)",
  },
};

const vkladkyFiltra = [
  {
    znachennya: "Усі",
    nadpis: "Усі подорожі",
    ikona: "🌍",
    kolir: "linear-gradient(135deg, #0f766e, #14b8a6)",
    smuga: "0 8px 20px rgba(15, 118, 110, 0.4)",
  },
  {
    znachennya: "Активні збори",
    nadpis: "Активні збори",
    ikona: "💰",
    kolir: "linear-gradient(135deg, #f59e0b, #fbbf24)",
    smuga: "0 8px 20px rgba(245, 158, 11, 0.4)",
  },
  {
    znachennya: "Плануються",
    nadpis: "Плануються",
    ikona: "📅",
    kolir: "linear-gradient(135deg, #8b5cf6, #a78bfa)",
    smuga: "0 8px 20px rgba(139, 92, 246, 0.4)",
  },
  {
    znachennya: "Вже відвідані",
    nadpis: "Вже відвідані",
    ikona: "✅",
    kolir: "linear-gradient(135deg, #16a34a, #4ade80)",
    smuga: "0 8px 20px rgba(22, 163, 74, 0.4)",
  },
];

/** Країна, знайдена через API країн світу */
interface KrayinaZAPI {
  code: string;
  name: string;
  nameUa: string;
  nameUaNorm: string;
  capital: string;
  kodyValut: string[];
}

/** Кешований каталог: валюти + список країн */
interface KatalogKrayin {
  valuty: Record<string, { name: string }>;
  spysok: KrayinaZAPI[];
}

/** Країна після збагачення (прапор, валюта текстом) */
interface ZnaydenaKrayyna extends KrayinaZAPI {
  cherezSlovnyk: boolean;
  dzoom: string;
  prapor: string;
  valutaText: string;
}

/** Стан попереднього перегляду країни у пошуку */
type StanKrayyny = {
  zapit: string;
  stan: "shukayemo" | "nema" | "uzhe" | "znaydeno" | "pomylka";
  krayna?: ZnaydenaKrayyna;
};

/** Дані з форми «Нова подорож» */
interface NovaPodorozhForm {
  title: string;
  country_code: string;
  budget: number;
  status: StatusPodorozhi;
}

function Golovna({ korystuvach }: { korystuvach: Korystuvach }) {
  const nav = useNavigate();
  const vlasnyk = ciToVlasnyk(korystuvach);
  const [podorozhi, setPodorozhi] = useState<Podorozh[]>(() =>
    zastosuvatyBudzety(zastosuvatyZibrano(mockTrips, korystuvach), korystuvach)
  );
  const [zavantazhennya, setZavantazhennya] = useState(false);
  const [poshuk, setPoshuk] = useState("");
  const [filtr, setFiltr] = useState("Усі");
  const [modalka, setModalka] = useState(false);
  const [daye, setDaye] = useState(false);
  const [krayynaAPI, setKrayynaAPI] = useState<StanKrayyny | null>(null);
  const krayinyUseRef = useRef<KatalogKrayin | null>(null);
  const [forma] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const zavantazhyty = useCallback(async () => {
    try {
      const [{ data: trips }, { data: operaciyi }] = await Promise.all([
        supabase
          .from("trips")
          .select("*")
          .eq("user_id", korystuvach.id)
          .order("id", { ascending: false }),
        supabase
          .from("expenses")
          .select("trip_id, amount, type")
          .eq("user_id", korystuvach.id),
      ]);

      const zibrano: Record<string, number> = {};
      const vytracheno: Record<string, number> = {};
      (operaciyi || []).forEach((o) => {
        const suma = Number(o.amount) || 0;
        if (o.type === "Дохід") {
          zibrano[o.trip_id] = (zibrano[o.trip_id] || 0) + suma;
        } else {
          vytracheno[o.trip_id] = (vytracheno[o.trip_id] || 0) + suma;
        }
      });

      const realni = (trips || []).map((t) => ({
        ...t,
        status: statusDozvolenyy(String(t.status)) ? t.status : "Активні збори",
        zibrano: zibrano[t.id] || 0,
        vytrachenoSuma: vytracheno[t.id] || 0,
      }));

      // Кожен акаунт має свій список прихованих карток:
      // чиє видалення діє лише під цим акаунтом, на інших — не впливає.
      const pryhovani = new Set(prykhovaniMock(korystuvach).map(String));
      setPodorozhi(
        zastosuvatyBudzety(
          zastosuvatyZibrano(
            [
              ...realni,
              ...zavantazhPodorozhiAPI(korystuvach),
              ...mockTrips,
            ].filter((p) => !pryhovani.has(String(p.id))),
            korystuvach
          ),
          korystuvach
        )
      );
    } catch {
      // мережа недоступна — вітрина не спорожнюється, лишаємо наявні картки
    } finally {
      setZavantazhennya(false);
    }
  }, [korystuvach]);

  useEffect(() => {
    zavantazhyty();
  }, [zavantazhyty]);

  const lychilnyky = useMemo(
    () => ({
      vidvidani: podorozhi.filter((p) => p.status === "Вже відвідані").length,
      aktivni: podorozhi.filter((p) => p.status === "Активні збори").length,
      planuyutsya: podorozhi.filter((p) => p.status === "Плануються").length,
    }),
    [podorozhi]
  );

  const vybrani = useMemo(() => {
    const zapyt = poshuk.trim().toLowerCase();
    return podorozhi.filter((p) => {
      const nazvaKrayiny = krajiny[p.country_code]?.nazva || p.country_code;
      const sovpada =
        !zapyt ||
        p.title.toLowerCase().includes(zapyt) ||
        nazvaKrayiny.toLowerCase().includes(zapyt) ||
        p.country_code.toLowerCase() === zapyt;
      const statusOK = filtr === "Усі" || p.status === filtr;
      return sovpada && statusOK;
    });
  }, [podorozhi, poshuk, filtr]);

  useEffect(() => {
    const zapit = poshuk.trim();
    if (zapit.length < 2) return undefined;

    const taymer = setTimeout(async () => {
      const q = normZapyt(zapit);
      const yLocal = podorozhi.some((p) => {
        const nazvaKrayiny = krajiny[p.country_code]?.nazva || p.country_code;
        return (
          normZapyt(p.title).includes(q) ||
          normZapyt(nazvaKrayiny).includes(q) ||
          p.country_code.toLowerCase() === q
        );
      });
      if (yLocal) return;

      setKrayynaAPI({ zapit, stan: "shukayemo" });
      try {
        if (!krayinyUseRef.current) {
          const [katalogKrayin, katalogValut, perelykUa] = await Promise.all([
            fetch(
              "https://raw.githubusercontent.com/annexare/Countries/master/dist/countries.min.json",
              { signal: timeoutDlyaFetch() }
            ).then((r) => {
              if (!r.ok) throw new Error("API недоступне");
              return r.json();
            }),
            fetch(
              "https://raw.githubusercontent.com/annexare/Countries/master/dist/currencies.min.json",
              { signal: timeoutDlyaFetch() }
            ).then((r) => r.json()),
            fetch(
              "https://raw.githubusercontent.com/umpirsky/country-list/master/data/uk/country.json",
              { signal: timeoutDlyaFetch() }
            ).then((r) => r.json()),
          ]);

          krayinyUseRef.current = {
            valuty: katalogValut,
            spysok: Object.entries(
              katalogKrayin as Record<
                string,
                { name?: string; capital?: string; currency?: string[] }
              >
            ).map(([code, k]) => ({
              code,
              name: k.name || "",
              nameUa: perelykUa[code] || "",
              nameUaNorm: normZapyt(perelykUa[code] || ""),
              capital: k.capital || "",
              kodyValut: k.currency || [],
            })),
          };
        }

        const katalog: KatalogKrayin = krayinyUseRef.current;
        const { spysok, valuty } = katalog;
        const kodZSlovnyka = populyarniDestynaciyi[q];
        let znaydena = kodZSlovnyka
          ? spysok.find((k) => k.code === kodZSlovnyka)
          : undefined;
        if (!znaydena) {
          znaydena = spysok.find(
            (k) =>
              k.name.toLowerCase().includes(q) ||
              k.nameUaNorm.includes(q) ||
              k.code.toLowerCase() === q ||
              (k.capital && k.capital.toLowerCase().includes(q))
          );
        }

        if (!znaydena) {
          setKrayynaAPI({ zapit, stan: "nema" });
          return;
        }

        const krayna = {
          ...znaydena,
          cherezSlovnyk: Boolean(kodZSlovnyka),
          dzoom: zapit,
          prapor: `https://flagcdn.com/w320/${znaydena.code.toLowerCase()}.png`,
          valutaText:
            znaydena.kodyValut.length === 0
              ? "—"
              : znaydena.kodyValut
                  .map((c) => (valuty[c] ? `${valuty[c].name} (${c})` : c))
                  .join(", "),
        };

        const uzhe = podorozhi.some((p) => p.country_code === krayna.code);
        setKrayynaAPI({ zapit, stan: uzhe ? "uzhe" : "znaydeno", krayna });
      } catch {
        setKrayynaAPI({ zapit, stan: "pomylka" });
      }
    }, 600);

    return () => clearTimeout(taymer);
  }, [poshuk, podorozhi]);

  const apiPrev =
    krayynaAPI && krayynaAPI.zapit === poshuk.trim() ? krayynaAPI : null;

  const dobatyApiKrayinu = () => {
    const krayna = apiPrev?.krayna;
    if (!krayna) return;

    const nazvaKrayiny = krayna.nameUa || krayna.name;
    const nazva = krayna.cherezSlovnyk
      ? versalizuvaty(krayna.dzoom)
      : nazvaKrayiny;
    dodatyKrayinuMapy(krayna.code, {
      prapor: praporZCode(krayna.code),
      nazva: nazvaKrayiny,
      valiuta: krayna.kodyValut[0] || "",
    });

    const novaPodorozh: Podorozh = {
      id: `api-${Date.now()}`,
      title: nazva,
      country_code: krayna.code,
      budget: 50000,
      status: "Плануються",
      zibrano: 0,
      vytrachenoSuma: 0,
    };

    zberezhytyPodorozhAPI(korystuvach, novaPodorozh);
    setPodorozhi((star) => [novaPodorozh, ...star]);
    setPoshuk("");
    setKrayynaAPI(null);
    messageApi.success(
      `«${nazva}» додано у «Плануються» (країна: ${nazvaKrayiny}, бюджет 50 000 грн)!`
    );
  };

  const vydatyPodorozh = async (p: Podorozh) => {
    const id = String(p.id);
    if (id.startsWith("api-")) {
      vydalytyPodorozhAPI(korystuvach, id);
    } else if (id.startsWith("mock-")) {
      prykhovatyMock(korystuvach, id);
    } else {
      const { error } = await supabase
        .from("trips")
        .delete()
        .eq("id", p.id)
        .eq("user_id", korystuvach.id);
      if (error) {
        messageApi.error("Не вдалося видалити подорож: " + error.message);
        return;
      }
    }
    setPodorozhi((star) => star.filter((t) => String(t.id) !== id));
    messageApi.success(`Подорож «${p.title}» видалено ✌️`);
  };

  const dobavyty = async (znachennya: NovaPodorozhForm) => {
    setDaye(true);
    const { error } = await supabase.from("trips").insert({
      user_id: korystuvach.id,
      title: znachennya.title,
      country_code: znachennya.country_code,
      budget: znachennya.budget,
      status: znachennya.status,
    });
    setDaye(false);

    if (error) {
      messageApi.error("Не вдалося додати подорож: " + error.message);
      return;
    }
    messageApi.success("Подорож додано!");
    setModalka(false);
    forma.resetFields();
    zavantazhyty();
  };

  return (
    <div className="obolonka">
      {contextHolder}
      <Shapka korystuvach={korystuvach} />

      <div className="vmist">
        <div className="zaholovok">
          <div className="zaholovok-titul">
            <h1>
              <span className="h1-tekst">Світ моїх мрій</span>
              <span className="h1-emo">
                <span>✈️</span>
                <span>🌍</span>
                <span className="blysk">✨</span>
              </span>
            </h1>
            <p className="privit">
              Привіт, мандрівнику! Ти вже відвідав{" "}
              <b className="c-vidvidani">{lychilnyky.vidvidani}</b> локацій,
              активно збираєш гроші на{" "}
              <b className="c-aktivni">{lychilnyky.aktivni}</b> напрямки та
              плануєш ще{" "}
              <b className="c-planuyutsya">{lychilnyky.planuyutsya}</b> мрій!
            </p>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setModalka(true)}
          >
            Додати подорож
          </Button>
        </div>

        <div className="panel">
          <Input
            allowClear
            size="large"
            prefix={<SendOutlined className="lupa" />}
            placeholder="Куди летимо цього разу? Введіть будь-яку країну світу..."
            value={poshuk}
            onChange={(e) => setPoshuk(e.target.value)}
            className="velykyy-poshuk"
          />
          <div className="vkladky">
            {vkladkyFiltra.map((v) => (
              <button
                key={v.znachennya}
                type="button"
                className={`vkladka ${filtr === v.znachennya ? "aktyvna" : ""}`}
                style={
                  filtr === v.znachennya
                    ? { background: v.kolir, boxShadow: v.smuga }
                    : undefined
                }
                onClick={() => setFiltr(v.znachennya)}
              >
                <span className="vkladka-ikona">{v.ikona}</span>
                {v.nadpis}
              </button>
            ))}
          </div>

          {apiPrev && (
            <div className="api-prevyu">
              {apiPrev.stan === "shukayemo" && (
                <div className="api-stan">
                  <Spin size="small" />
                  Шукаємо «{apiPrev.zapit}» у базі країн світу...
                </div>
              )}

              {apiPrev.stan === "nema" && (
                <div className="api-stan api-pomylka">
                  😕 Країну «{apiPrev.zapit}» не знайдено ні у ваших подорожах,
                  ні в інтернеті
                </div>
              )}

              {apiPrev.stan === "uzhe" && apiPrev.krayna && (
                <div className="api-stan api-uspih">
                  ✅ «{apiPrev.krayna.nameUa || apiPrev.krayna.name}» вже є у
                  вашому списку подорожей!
                </div>
              )}

              {apiPrev.stan === "pomylka" && (
                <div className="api-stan api-pomylka">
                  ⚠️ Не вдалося зв'язатися з API країн — перевірте інтернет і
                  спробуйте ще раз
                </div>
              )}

              {apiPrev.stan === "znaydeno" && apiPrev.krayna && (
                <div className="api-kartka">
                  <img
                    className="api-prapor"
                    src={apiPrev.krayna.prapor}
                    alt={apiPrev.krayna.name}
                  />
                  <div className="api-dani">
                    <h4>
                      {apiPrev.krayna.cherezSlovnyk
                        ? versalizuvaty(apiPrev.krayna.dzoom)
                        : apiPrev.krayna.nameUa || apiPrev.krayna.name}{" "}
                      <span className="api-name-en">
                        {apiPrev.krayna.name}
                      </span>
                    </h4>
                    {apiPrev.krayna.cherezSlovnyk && (
                      <p className="api-misto">
                        🏙 Це популярний напрямок країни{" "}
                        {apiPrev.krayna.nameUa || apiPrev.krayna.name}
                      </p>
                    )}
                    <p>
                      🏛 Столиця: <b>{apiPrev.krayna.capital || "—"}</b>
                    </p>
                    <p>
                      💵 Валюта: <b>{apiPrev.krayna.valutaText}</b>
                    </p>
                  </div>
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlusOutlined />}
                    className="api-knopka"
                    onClick={dobatyApiKrayinu}
                  >
                    Запланувати подорож
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="lichilnyk">Подорожей знайдено: {vybrani.length}</p>

        {zavantazhennya ? (
          <div className="centr">
            <Spin size="large" />
            <p>Завантаження подорожей...</p>
          </div>
        ) : vybrani.length === 0 ? (
          <Empty
            className="porozhnya"
            description={
              podorozhi.length === 0
                ? "Поки що подорожей немає — створіть першу!"
                : "Нічого не знайдено. Спробуйте інший запит"
            }
          />
        ) : (
          <div className="sitka">
            {vybrani.map((p) => {
              const budzet = Number(p.budget) || 0;
              const procent = procentZibrano(p.zibrano, budzet);
              const mockKarta = String(p.id).startsWith("mock-");
              const chuzheZibrano = !vlasnyk && mockKarta && !p.zibranoSvoe;
              const kolir =
                kolirStatusu[p.status] || kolirStatusu["Активні збори"];
              const krajyna = krajiny[p.country_code] || {
                prapor: "🌍",
                nazva: p.country_code,
              };

              return (
                <div className="karta" key={p.id}>
                  <div className="karta-obkladynka">
                    <span className="obkladynka-zapaska">{krajyna.prapor}</span>
                    <img
                      src={obkladynkaPodorozhi(p)}
                      alt={p.title}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <Popconfirm
                      title={`Видалити «${p.title}»?`}
                      description="Подорож зникне лише у вашому акаунті"
                      okText="Видалити"
                      cancelText="Скасувати"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => vydatyPodorozh(p)}
                    >
                      <button
                        className="karta-vidalyty"
                        aria-label="Видалити подорож"
                      >
                        ×
                      </button>
                    </Popconfirm>
                    <span className="prapor-kolo">{krajyna.prapor}</span>
                  </div>

                  <div className="karta-tilo">
                    <h3 className="karta-nazva">{p.title}</h3>
                    <div className="karta-meta">
                      <span className="karta-krajyna">
                        {krajyna.prapor} {krajyna.nazva}
                      </span>
                      <Tag color={kolir.tag}>{p.status}</Tag>
                    </div>

                    <div className="prohres">
                      <div className="prohres-smuga">
                        <div
                          className="prohres-zapovnennya"
                          style={{
                            width: `${chuzheZibrano ? 0 : procent}%`,
                            background: kolir.smuga,
                          }}
                        />
                      </div>
                      <div className="prohres-nyzh">
                        <p className="prohres-tekst">
                          💰 Зібрано:{" "}
                          <b>
                            {chuzheZibrano
                              ? "— грн"
                              : `${formatHryven(p.zibrano)} грн`}
                          </b>{" "}
                          з {formatHryven(budzet)} грн
                        </p>
                        <span
                          className="prohres-procent"
                          style={{ background: kolir.smuga }}
                        >
                          {chuzheZibrano ? "—" : `${procent}%`}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="primary"
                      block
                      className="karta-knopka"
                      onClick={() => nav(`/trip/${p.id}`)}
                    >
                      Переглянути світ мандрівника →
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        title="🧳 Нова подорож"
        open={modalka}
        onCancel={() => {
          setModalka(false);
          forma.resetFields();
        }}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={forma}
          layout="vertical"
          onFinish={dobavyty}
          initialValues={{ country_code: "IT", status: "Активні збори" }}
        >
          <Form.Item
            name="title"
            label="Назва або місто"
            rules={[{ required: true, message: "Вкажіть назву або місто" }]}
          >
            <Input placeholder="Наприклад: Рим" maxLength={60} />
          </Form.Item>

          <Form.Item
            name="country_code"
            label="Країна"
            rules={[{ required: true, message: "Оберіть країну" }]}
          >
            <Select
              options={krajinyVyboru.map((code) => ({
                value: code,
                label: `${krajiny[code].prapor} ${krajiny[code].nazva}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="budget"
            label="Бюджет збору"
            rules={[{ required: true, message: "Вкажіть бюджет" }]}
          >
            <InputNumber
              min={1}
              max={100000000}
              style={{ width: "100%" }}
              addonAfter="грн"
              placeholder="Наприклад: 40000"
            />
          </Form.Item>

          <Form.Item name="status" label="Статус">
            <Select options={statusy.map((s) => ({ value: s, label: s }))} />
          </Form.Item>

          <Space className="modalka-knopy">
            <Button onClick={() => setModalka(false)}>Скасувати</Button>
            <Button type="primary" htmlType="submit" loading={daye}>
              Додати
            </Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}

export default Golovna;
