import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import supabase from "../supabase";
import Shapka from "../components/Shapka";
import PanelPoshuku from "../components/PanelPoshuku";
import SpysokPodorozhey from "../components/SpysokPodorozhey";
import ModalkaNovaPodorozh from "../components/ModalkaNovaPodorozh";
import { krajiny } from "../data/krajiny";
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
    zavantazhyty();
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
