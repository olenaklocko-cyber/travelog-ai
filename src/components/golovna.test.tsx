import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SpysokPodorozhey from "./SpysokPodorozhey";
import PanelPoshuku from "./PanelPoshuku";
import ModalkaNovaPodorozh from "./ModalkaNovaPodorozh";
import type { Podorozh } from "../types";

const podorozh: Podorozh = {
  id: "mock-1",
  title: "Карпати восени",
  country_code: "UA",
  budget: 12000,
  status: "Плануються",
};

const bezPodorozh = {
  podorozhi: [],
  vybrani: [],
  zavantazhennya: false,
  vlasnyk: true,
  vydaty: () => {},
  vidkryty: () => {},
};

describe("головна сторінка", () => {
  it("показує картку подорожі й лічильник", () => {
    const html = renderToStaticMarkup(
      <SpysokPodorozhey
        {...bezPodorozh}
        podorozhi={[podorozh]}
        vybrani={[podorozh]}
      />
    );
    expect(html).toContain("Подорожей знайдено: 1");
    expect(html).toContain("Карпати восени");
  });

  it("пояснює, що подорожей ще немає", () => {
    const html = renderToStaticMarkup(<SpysokPodorozhey {...bezPodorozh} />);
    expect(html).toContain("Поки що подорожей немає");
  });

  it("панель пошуку має поле і фільтри", () => {
    const html = renderToStaticMarkup(
      <PanelPoshuku
        poshuk=""
        setPoshuk={() => {}}
        filtr="Усі"
        setFiltr={() => {}}
        podorozhi={[]}
        onDodano={() => {}}
      />
    );
    expect(html).toContain("Куди летимо цього разу?");
    expect(html).toContain("Активні збори");
  });

  it("модалка нової подорожі не падає при закритті", () => {
    const html = renderToStaticMarkup(
      <ModalkaNovaPodorozh
        vidkryto={false}
        zakryty={vi.fn()}
        dobavyty={async () => true}
      />
    );
    expect(typeof html).toBe("string");
  });
});
