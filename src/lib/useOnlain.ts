// Тиждень 4: realtime-онлайн.
// Показує скільки людей зараз на сайті (presence).
// Оновлюється миттєво у всіх вікнах.

import { useEffect, useRef, useState } from "react";
import supabase from "../supabase";
import type { Korystuvach } from "../types";

export interface OnlainStatus {
  kilkist: number;
  imena: string[];
}

export function useOnlain(korystuvach: Korystuvach | null): OnlainStatus {
  const [status, setStatus] = useState<OnlainStatus>({ kilkist: 0, imena: [] });
  const sidRef = useRef<string>(`sid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    const sid = sidRef.current;
    let heartbeatTimer: ReturnType<typeof setInterval>;

    // Реєструємося в онлайні
    const zaytys = async () => {
      await supabase.rpc("ya_tut", {
        p_sid: sid,
        p_user_id: korystuvach?.id ?? null,
        p_user_name: korystuvach?.email ?? "Гість",
        p_storinka: window.location.pathname,
      });
    };

    // Heartbeat кожні 15 секунд
    const heartbeat = async () => {
      await supabase.rpc("ya_tut", {
        p_sid: sid,
        p_user_id: korystuvach?.id ?? null,
        p_user_name: korystuvach?.email ?? "Гість",
        p_storinka: window.location.pathname,
      });
    };

    // Підписка на realtime-зміни таблиці online_korystuvachi
    const pidpyska = supabase
      .channel("online-korystuvachi")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "online_korystuvachi" },
        async () => {
          // Перераховуємо онлайн
          const { data } = await supabase
            .from("online_korystuvachi")
            .select("user_name");
          if (data) {
            setStatus({
              kilkist: data.length,
              imena: data.map((r) => r.user_name ?? "Гість").slice(0, 5),
            });
          }
        }
      )
      .subscribe();

    // Початковий запит
    void zaytys().then(async () => {
      const { data } = await supabase
        .from("online_korystuvachi")
        .select("user_name");
      if (data) {
        setStatus({
          kilkist: data.length,
          imena: data.map((r) => r.user_name ?? "Гість").slice(0, 5),
        });
      }
    });

    heartbeatTimer = setInterval(() => void heartbeat(), 15_000);

    // При закритті — йдемо з онлайну
    const vyity = () => {
      void supabase.rpc("vyity", { p_sid: sid });
    };
    window.addEventListener("beforeunload", vyity);

    return () => {
      clearInterval(heartbeatTimer);
      window.removeEventListener("beforeunload", vyity);
      void supabase.rpc("vyity", { p_sid: sid });
      void supabase.removeChannel(pidpyska);
    };
  }, [korystuvach]);

  return status;
}
