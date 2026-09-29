import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider, Spin } from "antd";
import ukUA from "antd/locale/uk_UA";
import supabase from "./supabase";
import Vhid from "./components/Vhid";
import Golovna from "./pages/Golovna";
import Podorozh from "./pages/Podorozh";
import type { Korystuvach } from "./types";

function App() {
  const [korystuvach, setKorystuvach] = useState<Korystuvach | null>(null);
  const [chekaye, setChekaye] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setKorystuvach(data.session?.user ?? null);
      setChekaye(false);
    });
    const { data: pidpyska } = supabase.auth.onAuthStateChange(
      (_podiya, session) => {
        setKorystuvach(session?.user ?? null);
      }
    );
    return () => pidpyska.subscription.unsubscribe();
  }, []);

  if (chekaye) {
    return (
      <div className="start">
        <Spin size="large" />
        <p>Завантаження...</p>
      </div>
    );
  }

  return (
    <ConfigProvider
      locale={ukUA}
      theme={{
        token: {
          colorPrimary: "#0d9488",
          colorInfo: "#0d9488",
          borderRadius: 10,
        },
      }}
    >
      <HashRouter>
        {!korystuvach ? (
          <Vhid />
        ) : (
          <Routes>
            <Route
              path="/"
              element={<Golovna korystuvach={korystuvach} />}
            />
            <Route
              path="/trip/:id"
              element={<Podorozh korystuvach={korystuvach} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </HashRouter>
    </ConfigProvider>
  );
}

export default App;
