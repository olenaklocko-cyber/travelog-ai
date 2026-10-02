import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { usePodorozh } from "./usePodorozh";
import type { Korystuvach } from "../types";

const korystuvach: Korystuvach = { id: "test-user", email: "test@example.com" };

function Probe() {
  const dani = usePodorozh("mock-1", korystuvach);
  return (
    <div
      data-nazva={dani.podorozh?.title ?? "немає"}
      data-zavantazhennya={String(dani.zavantazhennya)}
      data-budzet={dani.budzetApi.budzet}
      data-vytraty={dani.vytraty.length}
      data-chek={dani.chek?.length ?? 0}
    />
  );
}

describe("usePodorozh", () => {
  it("знаходить mock-подорож і одразу віддає всі дані", () => {
    const html = renderToStaticMarkup(<Probe />);
    expect(html).not.toContain('data-nazva="немає"');
    expect(html).toContain('data-zavantazhennya="false"');
    expect(html).toContain('data-vytraty="0"');
    expect(html).toContain('data-chek="3"');
  });

  it("бюджет — число, навіть коли нічого не збережено", () => {
    const html = renderToStaticMarkup(<Probe />);
    expect(html).toMatch(/data-budzet="\d+"/);
  });
});
