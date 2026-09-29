import { Button } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import supabase from "../supabase";
import type { Korystuvach } from "../types";
import "./Shapka.css";

interface ShapkaProps {
  korystuvach: Korystuvach;
}

function Shapka({ korystuvach }: ShapkaProps) {
  return (
    <header className="shapka">
      <div className="logo">🧳 Мій розумний тревелог</div>
      <div className="korystuvach">
        <span className="pochta">{korystuvach.email}</span>
        <Button
          size="small"
          icon={<LogoutOutlined />}
          onClick={() => {
            supabase.auth.signOut();
          }}
        >
          Вийти
        </Button>
      </div>
    </header>
  );
}

export default Shapka;
