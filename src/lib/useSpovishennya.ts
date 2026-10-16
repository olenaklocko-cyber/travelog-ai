// Тиждень 4: realtime-сповіщення.
// Коли хтось створює/видаляє подорож — з'являється сповіщення для всіх.

import { useEffect, useState } from "react";
import supabase from "../supabase";

export interface Spovishennya {
  id: string;
  typ: string;
  danі: { title?: string; country?: string; trip_id?: string };
  user_name: string | null;
  stvoreno_at: string;
}

export function useSpovishennya(): Spovishennya[] {
  const [spovishennya, setSpovishennya] = useState<Spovishennya[]>([]);

  useEffect(() => {
    // Підписка на нові сповіщення
    const channel = supabase
      .channel("spovishennya-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "spovishennya" },
        (payload) => {
          const nove = payload.new as Spovishennya;
          setSpovishennya((star) => [nove, ...star].slice(0, 10)); // тримаємо 10 останніх
        }
      )
      .subscribe();

    // Завантажуємо останні сповіщення
    void supabase
      .from("spovishennya")
      .select("*")
      .order("stvoreno_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setSpovishennya(data);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return spovishennya;
}
