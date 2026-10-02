import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AiPorada from "./AiPorada";
import FaktyPanel from "./FaktyPanel";
import FinansyPanel from "./FinansyPanel";
import type { Podorozh, Vytrata } from "../types";

const podorozh: Podorozh = {
  id: 1,
  title: "Тестова подорож",
  country_code: "JP",
  budget: 1000,
  status: "Плануються",
};

const budzetApi = {
  budzet: 1000,
  zibranoBase: 200,
  zibranoNad: undefined,
  zminytyBudzet: () => {},
  zminytyZibrano: () => {},
};

const vytraty: Vytrata[] = [{ id: 1, suma: 300, kategoriya: "Їжа" }];

describe("вкладки сторінки подорожі", () => {
  it("рендерить ШІ-карту", () => {
    const html = renderToStaticMarkup(<AiPorada podorozh={podorozh} />);
    expect(html).toContain("Розумна порада від ШІ");
    expect(html).toContain("Запитати ШІ");
  });

  it("рендерить «Цікаві факти»", () => {
    const html = renderToStaticMarkup(<FaktyPanel podorozh={podorozh} />);
    expect(html).toContain("Порада з нашого сервера");
    expect(html).toContain("Конвертер валют");
    expect(html).toContain("Чи знаєте ви, що");
  });

  it("рендерить «Фінанси» з сумами та формою", () => {
    const html = renderToStaticMarkup(
      <FinansyPanel
        vlasnyk
        vytraty={vytraty}
        zminytyVytraty={() => {}}
        budzetApi={budzetApi}
      />
    );
    expect(html).toContain("Загальний бюджет");
    expect(html).toContain("Додати витрату");
    expect(html).toContain("Витрачено");
  });
});
