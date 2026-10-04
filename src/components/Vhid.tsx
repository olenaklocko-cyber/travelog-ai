import { useState } from "react";
import type { FormEvent } from "react";
import { Input, Button, Segmented, Alert } from "antd";
import {
  LockOutlined,
  MailOutlined,
  LoginOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import supabase from "../supabase";
import FormaVidhuku from "./FormaVidhuku";
import { perekladPomylky } from "../lib/perekladPomylky";
import "./Vhid.css";

function Vhid() {
  const [rezhym, setRezhym] = useState("vhid");
  const [email, setEmail] = useState("");
  const [parol, setParol] = useState("");
  const [pomylka, setPomylka] = useState("");
  const [nadislano, setNadislano] = useState(false);
  const [zavantazhennya, setZavantazhennya] = useState(false);

  const nadislaty = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPomylka("");
    setZavantazhennya(true);

    try {
      if (rezhym === "reestraciya") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: parol,
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setNadislano(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: parol,
        });
        if (error) throw error;
      }
    } catch (err) {
      const tekstPomylky = err instanceof Error ? err.message : String(err);
      setPomylka(perekladPomylky(tekstPomylky));
    }
    setZavantazhennya(false);
  };

  return (
    <div className="vhid-obolonka">
      <div className="vhid-kartka">
        <div className="vhid-zagolovok">
          <h1>🧳 Вхід до тревелогу</h1>
          <p>Кожен бачить лише свої подорожі та свій бюджет</p>
        </div>

        {nadislano ? (
          <div className="povedinka">
            <span className="ikona">📧</span>
            <h2>Перевірте пошту!</h2>
            <p>Ми надіслали вам лист для підтвердження email.</p>
            <Button
              type="primary"
              size="large"
              onClick={() => {
                setNadislano(false);
                setRezhym("vhid");
              }}
            >
              Повернутись до входу
            </Button>
          </div>
        ) : (
          <>
            <ol className="vhid-kroky">
              <li>
                <b>1.</b> Введіть email і пароль — це ваш особистий кабінет.
              </li>
              <li>
                <b>2.</b> Усередині — ваші подорожі, бюджет і збори.
              </li>
              <li>
                <b>3.</b> Не хочете реєструватись? Тоді просто напишіть відгук
                нижче — анонімно.
              </li>
            </ol>

            <Segmented
              block
              value={rezhym}
              onChange={setRezhym}
              options={[
                { label: "Увійти", value: "vhid" },
                { label: "Реєстрація", value: "reestraciya" },
              ]}
              className="rezhymy"
            />

            <form onSubmit={nadislaty}>
              <div className="pole">
                <label>Email</label>
                <Input
                  size="large"
                  type="email"
                  prefix={<MailOutlined />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="pole">
                <label>Пароль</label>
                <Input.Password
                  size="large"
                  prefix={<LockOutlined />}
                  value={parol}
                  onChange={(e) => setParol(e.target.value)}
                  placeholder="Мінімум 6 символів"
                  minLength={6}
                  required
                />
              </div>

              {pomylka && (
                <Alert
                  type="error"
                  showIcon
                  message={pomylka}
                  className="pomylka"
                />
              )}

              <Button
                type="primary"
                size="large"
                htmlType="submit"
                block
                loading={zavantazhennya}
                icon={
                  rezhym === "vhid" ? <LoginOutlined /> : <UserAddOutlined />
                }
              >
                {rezhym === "vhid" ? "Увійти" : "Зареєструватися"}
              </Button>
            </form>
          </>
        )}
        <div className="vhid-vidhuk">
          <FormaVidhuku />
        </div>
      </div>
    </div>
  );
}

export default Vhid;
