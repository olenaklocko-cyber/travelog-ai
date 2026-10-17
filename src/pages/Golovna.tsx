import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, message } from "antd";
import { BarChartOutlined, PlusOutlined } from "@ant-design/icons";
import supabase from "../supabase";
import { keshPodorozhey } from "../lib/kesh";
import PanelFonovyhZadach from "../components/PanelFonovyhZadach";
import LichylnykOnlain from "../components/LichylnykOnlain";
import StromkaSpovishen from "../components/StromkaSpovishen";
import PanelLogiv from "../components/PanelLogiv";
import PanelStiykosti from "../components/PanelStiykosti";
import { log } from "../lib/logy";
import { zZapaskovym } from "../lib/stiykist";
import Shapka from "../components/Shapka";
import PanelPoshuku from "../components/PanelPoshuku";
import SpysokPodorozhey from "../components/SpysokPodorozhey";
import ModalkaNovaPodorozh from "../components/ModalkaNovaPodorozh";
import { krajiny, zavantazhytyKrajinyZBazy } from "../data/krajiny";
import {
  zavantazhPodorozhiAPI,
  zberezhytyPodorozhAPI,
  vydalytyPodorozhAPI,
  prykhovaniMock,
  prykhovatyMock,
} from "../data/podorozhiAPI";
import { zastosuvatyBudzety, zastosuvatyZibrano } from "../data/budzety";
import { ciToVlasnyk } from "../data/dostup";
import { mockTrips } from "../data/mockTrips";
import type {
  Korystuvach,
  NovaPodorozhForm,
  Podorozh,
} from "../types";
import { statusDozvolenyy } from "../lib/rakhunky";
import "./Golovna.css";

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
  const [messageApi, contextHolder] = message.useMessage();

  const zavantazhyty = useCallback(async () => {
    try {
      // Тиждень 6: стійкість — timeout + retry + graceful degradation
      const rezultat = await zZapaskovym(
        // Основний шлях: кеш або запит до бази
        async () => {
          const trips = (await keshPodorozhey.aboObchyslyty("trips", async () => {
            const { data } = await supabase
              .from("trips_z_vidatamy")
              .select("*")
              .order("id", { ascending: false })
              .limit(50);
            return data ?? [];
          })) as Record<string, unknown>[];
          return trips;
        },
        // Запасний: localStorage або порожній список
        () => {
          log.warning("golovna", "Основний шлях впав, використовую запасний");
          return [] as Record<string, unknown>[];
        },
        { timeoutMs: 5000, retry: 2 }
      );

      const trips = rezultat.danі ?? [];

      const realni = trips.map((t) => ({
        ...t,
        id: t.id,
        title: String(t.title ?? ""),
        country_code: String(t.country_code ?? ""),
        budget: Number(t.budget) || 0,
        status: statusDozvolenyy(String(t.status)) ? t.status : "Активні збори",
        zibrano: Number(t.zibrano) || 0,
        vytrachenoSuma: Number(t.vytracheno) || 0,
      })) as Podorozh[];

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
    void zavantazhytyKrajinyZBazy();

    // Тиждень 4: realtime-підписка на зміни trips
    // Коли хтось додає/видаляє подорож — оновлюємо список миттєво
    const pidpyska = supabase
      .channel("trips-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        () => {
          // Скидаємо кеш і перезавантажуємо
          keshPodorozhey.ochystytyKlyuch("trips");
          void zavantazhyty();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(pidpyska);
    };
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
    keshPodorozhey.ochystytyKlyuch("trips");
    messageApi.success(`Подорож «${p.title}» видалено ✌️`);
  };

  const dobavyty = async (znachennya: NovaPodorozhForm): Promise<boolean> => {
    const { error } = await supabase.from("trips").insert({
      user_id: korystuvach.id,
      title: znachennya.title,
      country_code: znachennya.country_code,
      budget: znachennya.budget,
      status: znachennya.status,
    });
    if (error) {
      messageApi.error("Не вдалося додати подорож: " + error.message);
      return false;
    }
    messageApi.success("Подорож додано!");
    // Тиждень 2: оптимістичне оновлення + інвалідація кешу
    keshPodorozhey.ochystytyKlyuch("trips");
    setPodorozhi((star) => [
      {
        ...znachennya,
        id: `new-${Date.now()}`,
        zibrano: 0,
        vytrachenoSuma: 0,
      } as Podorozh,
      ...star,
    ]);
    return true;
  };

  // Країну з API додано у «Плануються»: зберігаємо і додаємо у список.
  const dopysatyApiKrayinu = (nova: Podorozh, nazvaKrayiny: string) => {
    zberezhytyPodorozhAPI(korystuvach, nova);
    setPodorozhi((star) => [nova, ...star]);
    messageApi.success(
      `«${nova.title}» додано у «Плануються» (країна: ${nazvaKrayiny}, бюджет 50 000 грн)!`
    );
  };

  // Тиждень 5+6: навмисна помилка для демонстрації логування.
  // Throw у setTimeout → глобальний обловник ловить і пише в логи.
  const zlamatyKod = () => {
    log.info("demo", "Користувач натиснув «Зламати код»");
    messageApi.info("Кидаю помилку... Подивись панель логів нижче 👇");
    setTimeout(() => {
      throw new Error("Навмисна помилка для демонстрації логування! 🐛");
    }, 100);
  };

  return (
    <div className="obolonka">
      {contextHolder}
      <Shapka korystuvach={korystuvach} />

      {/* Тиждень 4: онлайн-лічильник (реальний час) */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 24px" }}>
        <LichylnykOnlain korystuvach={korystuvach} />
      </div>

      <div className="vmist">
        {/* Тиждень 4: realtime-сповіщення */}
        <StromkaSpovishen />

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
          <div className="zaholovok-diyi">
            <Button
              size="large"
              icon={<BarChartOutlined />}
              href="#/analityka"
            >
              Графік відвідувань
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={() => setModalka(true)}
            >
              Додати подорож
            </Button>
          </div>
        </div>

        <PanelPoshuku
          poshuk={poshuk}
          setPoshuk={setPoshuk}
          filtr={filtr}
          setFiltr={setFiltr}
          podorozhi={podorozhi}
          onDodano={dopysatyApiKrayinu}
        />

        <SpysokPodorozhey
          podorozhi={podorozhi}
          vybrani={vybrani}
          zavantazhennya={zavantazhennya}
          vlasnyk={vlasnyk}
          vydaty={vydatyPodorozh}
          vidkryty={(p) => nav(`/trip/${p.id}`)}
        />

        {/* Тиждень 3: фонові задачі */}
        <div style={{ marginTop: 24 }}>
          <PanelFonovyhZadach />
        </div>

        {/* Тиждень 5: логи та моніторинг */}
        <div style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 8, textAlign: "right" }}>
            <Button
              danger
              size="small"
              onClick={zlamatyKod}
              title="Навмисна помилка для демонстрації логування"
            >
              🐛 Зламати код
            </Button>
          </div>
          <PanelLogiv />
        </div>

        {/* Тиждень 6: стійкість до збоїв */}
        <div style={{ marginTop: 24 }}>
          <PanelStiykosti />
        </div>
      </div>

      <ModalkaNovaPodorozh
        vidkryto={modalka}
        zakryty={() => setModalka(false)}
        dobavyty={dobavyty}
      />
    </div>
  );
}

export default Golovna;
