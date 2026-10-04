import { useEffect, useState } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { ConfigProvider, Spin } from "antd";
import ukUA from "antd/locale/uk_UA";
import supabase from "./supabase";
import Vhid from "./components/Vhid";
import Golovna from "./pages/Golovna";
import Podorozh from "./pages/Podorozh";
import Analityka from "./pages/Analityka";
import { zafiksovatyVizyt } from "./lib/analytika";
import { ciToVlasnyk } from "./data/dostup";
import type { Korystuvach } from "./types";

/** 📈 Анонімний лічильник: фіксуємо кожну переглянуту сторінку. */
function StrizhVizytiv() {
  const { pathname } = useLocation();
  useEffect(() => {
    void zafiksovatyVizyt(pathname || "/");
  }, [pathname]);
  return null;
}

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
        <StrizhVizytiv />
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
            <Route
              path="/analityka"
              element={
                <Analityka
                  korystuvach={korystuvach}
                  vlasnyk={ciToVlasnyk(korystuvach)}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </HashRouter>
    </ConfigProvider>
  );
}

export default App;
