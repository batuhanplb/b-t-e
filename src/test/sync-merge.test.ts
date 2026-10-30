import { describe, it, expect, vi } from "vitest";
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));
vi.mock("@lovable.dev/cloud-auth-js", () => ({ createLovableAuth: () => ({}) }));
(globalThis as any).__SB_URL__ = "x"; (globalThis as any).__SB_KEY__ = "y";
const { mergeMonth } = await import("../cloud-store/entry");
const a = { id: "a", v: 1 }, b = { id: "b", v: 1 }, c = { id: "c", v: 1 };
describe("ay birleştirme", () => {
  it("eski cihaz başka cihazın eklediği işlemi silmez", () => {
    expect(mergeMonth([a], [a, b], [a, c]).map(t => t.id)).toEqual(["a", "c", "b"]);
  });
  it("yerelde silinen işlem silinir", () => {
    expect(mergeMonth([a, b], [a], [a, b]).map(t => t.id)).toEqual(["a"]);
  });
  it("yerel düzenleme kazanır", () => {
    expect(mergeMonth([a], [{ id: "a", v: 2 }], [a])).toEqual([{ id: "a", v: 2 }]);
  });
});
