import { useState } from "react";
import { Alert, Button, Input } from "antd";
import { MessageOutlined, SendOutlined } from "@ant-design/icons";
import { nadislatyVidhuk } from "../lib/analytika";
import "./FormaVidhuku.css";

const MIN = 3;
const MAX = 1000;

/**
 * 💬 Анонімний зворотний зв'язок: «Що тобі не сподобалось?»
 * Ніякого email — лише текст + випадковий id сесії.
 */
function FormaVidhuku({ poshta = false }: { poshta?: boolean }) {
  const [teks, setTeks] = useState("");
  const [stan, setStan] = useState<"spokijno" | "nadyilno" | "uspeh">(
    "spokijno"
  );
  const [pomylka, setPomylka] = useState("");

  const skidyty = async () => {
    const chystyy = teks.trim();
    if (chystyy.length < MIN || chystyy.length > MAX) {
      setPomylka(`Відгук має бути від ${MIN} до ${MAX} символів`);
      setStan("spokijno");
      return;
    }
    setStan("nadyilno");
    setPomylka("");
    try {
      await nadislatyVidhuk(chystyy);
      setTeks("");
      setStan("uspeh");
    } catch (e) {
      setStan("spokijno");
      setPomylka(
        e instanceof Error ? e.message : "Не вдалося надіслати. Спробуй ще."
      );
    }
  };

  if (stan === "uspeh") {
    return (
      <div className={`forma-vidhuku${poshta ? " poshta" : ""}`}>
        <Alert
          type="success"
          showIcon
          message="Дякуємо! Відгук надіслано анонімно."
          description="Я прочитаю його на сторінці «Аналітика»."
        />
        <Button
          style={{ marginTop: 12 }}
          onClick={() => setStan("spokijno")}
        >
          Написати ще
        </Button>
      </div>
    );
  }

  return (
    <div className={`forma-vidhuku${poshta ? " poshta" : ""}`}>
      <label className="forma-vidhuku-zagolovok" htmlFor="vidhuk-teks">
        <MessageOutlined /> Що тобі не сподобалось? Напиши — виправлю
      </label>
      <Input.TextArea
        id="vidhuk-teks"
        data-testid="pole-vidhuku"
        value={teks}
        maxLength={MAX}
        rows={3}
        placeholder="Наприклад: незрозуміло, як додати подорож…"
        onChange={(e) => setTeks(e.target.value)}
        status={pomylka ? "error" : ""}
      />
      <div className="forma-vidhuku-dni">
        <span className="forma-vidhuku-lychylnyk">
          {teks.trim().length}/{MAX}
        </span>
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={stan === "nadyilno"}
          disabled={teks.trim().length < MIN}
          onClick={() => void skidyty()}
        >
          Надіслати анонімно
        </Button>
      </div>
      {pomylka && (
        <div className="forma-vidhuku-pomylka" role="alert">
          {pomylka}
        </div>
      )}
      <p className="forma-vidhuku-mala">
        Без email і без імені: ми бачимо лише текст.
      </p>
    </div>
  );
}

export default FormaVidhuku;
