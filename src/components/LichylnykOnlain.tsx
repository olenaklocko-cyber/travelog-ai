// Тиждень 4: лічильник онлайн (реальний час).
// Показує скільки людей зараз на сайті. Оновлюється миттєво.

import { useOnlain } from "../lib/useOnlain";
import type { Korystuvach } from "../types";
import { Avatar, Tooltip } from "antd";
import { UsergroupAddOutlined } from "@ant-design/icons";

export default function LichylnykOnlain({ korystuvach }: { korystuvach: Korystuvach | null }) {
  const online = useOnlain(korystuvach);

  if (online.kilkist === 0) return null;

  return (
    <Tooltip title={online.imena.join(", ")}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <UsergroupAddOutlined style={{ color: "#52c41a" }} />
        <span style={{ fontSize: 14 }}>
          {online.kilkist} онлайн
        </span>
        <Avatar.Group max={{ count: 3 }}>
          {online.imena.map((imya, i) => (
            <Avatar key={i} size="small" style={{ backgroundColor: "#52c41a" }}>
              {imya[0]?.toUpperCase() ?? "?"}
            </Avatar>
          ))}
        </Avatar.Group>
      </div>
    </Tooltip>
  );
}
