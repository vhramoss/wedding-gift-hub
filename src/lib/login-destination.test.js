import { test, expect } from "bun:test";
import { loginDestination } from "./login-destination";
test("convidado vinculado vai ao casamento mesmo antes de confirmar", () => {
  expect(loginDestination(undefined, "pedro-e-beatriz")).toBe("/casamento/pedro-e-beatriz");
  expect(loginDestination("/", "pedro-e-beatriz")).toBe("/casamento/pedro-e-beatriz");
});
test("convite interno é preservado e destino externo é rejeitado", () => {
  expect(loginDestination("/convite/individual", "pedro-e-beatriz")).toBe("/convite/individual");
  expect(loginDestination("//outro.site", "pedro-e-beatriz")).toBe("/casamento/pedro-e-beatriz");
  expect(loginDestination("/\\outro.site", "pedro-e-beatriz")).toBe("/casamento/pedro-e-beatriz");
});