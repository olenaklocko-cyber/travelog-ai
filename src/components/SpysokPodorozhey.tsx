import { Button, Empty, Popconfirm, Spin, Tag } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { krajiny } from "../data/krajiny";
import { obkladynkaPodorozhi } from "../data/obkladynky";
import { nazvaCSV, podorozhiDoCSV, skachatyCSV } from "../lib/eksportCSV";
import { formatHryven, procentZibrano } from "../lib/rakhunky";
import type { Podorozh, StatusPodorozhi } from "../types";
import "./SpysokPodorozhey.css";

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

interface SpysokPodorozheyProps {
  /** Усі подорожі — для повідомлення «поки що подорожей немає». */
  podorozhi: Podorozh[];
  /** Ті, що пройшли пошук і фільтр. */
  vybrani: Podorozh[];
  zavantazhennya: boolean;
  vlasnyk: boolean;
  vydaty: (p: Podorozh) => void | Promise<void>;
  vidkryty: (p: Podorozh) => void;
}

/** Сітка карток подорожей + лічильник, завантаження і порожній стан. */
export default function SpysokPodorozhey({
  podorozhi,
  vybrani,
  zavantazhennya,
  vlasnyk,
  vydaty,
  vidkryty,
}: SpysokPodorozheyProps) {
  const eksportuvaty = () => {
    skachatyCSV(nazvaCSV(), podorozhiDoCSV(vybrani, krajiny));
  };

  return (
    <>
      <div className="lichilnyk-ryadok">
        <p className="lichilnyk">Подорожей знайдено: {vybrani.length}</p>
        {vybrani.length > 0 && (
          <Button
            icon={<DownloadOutlined />}
            className="knopa-eksport"
            onClick={eksportuvaty}
          >
            Експорт CSV
          </Button>
        )}
      </div>

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
                    onConfirm={() => vydaty(p)}
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
                    onClick={() => vidkryty(p)}
                  >
                    Переглянути світ мандрівника →
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
