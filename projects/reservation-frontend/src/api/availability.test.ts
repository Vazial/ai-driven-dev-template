import { describe, it, expect, vi, afterEach } from "vitest";
import { getRoomAvailability } from "./availability";

// モックAPI（getRoomAvailability）に対する単体テスト。
// contracts/availability-view.feature のRFE-A-01/02/03が要求するAPIレベルの応答形状を検証する
// （画面表示の検証は src/features/availability の behavior テストで行う）。
describe("getRoomAvailability", () => {
  // RFE-A-01
  it("一部の時間帯に予約がある会議室は、空いている時間帯を返す", async () => {
    const result = await getRoomAvailability("room-a", "2026-07-14");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.availableSlots).toEqual([
        { startTime: "09:00", endTime: "10:00" },
        { startTime: "11:00", endTime: "18:00" },
      ]);
    }
  });

  // RFE-A-02
  it("終日埋まっている会議室は、空いている時間帯が無い(空配列)ことを返す", async () => {
    const result = await getRoomAvailability("room-a", "2026-07-15");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.availableSlots).toEqual([]);
    }
  });

  // RFE-A-03
  it("存在しない会議室はROOM_NOT_FOUNDで拒否される", async () => {
    const result = await getRoomAvailability("存在しない会議室", "2026-07-14");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ROOM_NOT_FOUND");
    }
  });
});

// 実APIモード（VITE_USE_REAL_AVAILABILITY_API=true）の分岐に対する単体テスト（2本目の実接続、
// reservation-frontend/adr/0009 決定6(b)）。実fetchの3つの分岐——200=成功 / 404=契約の拒否
// （ROOM_NOT_FOUND、ApiResultのok:false）/ それ以外・fetch例外=ネットワーク層失敗として例外伝播
// （ADR-0009 決定4）——を、global.fetch をモックして検証する。実バックエンドは起動しない。
// USE_REAL_AVAILABILITY_API はモジュールロード時に評価されるため、env を差し替えてから
// resetModules + 動的importで実モードのモジュールを取り直す。
describe("getRoomAvailability (実APIモード)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadReal() {
    vi.stubEnv("VITE_USE_REAL_AVAILABILITY_API", "true");
    vi.resetModules();
    return import("./availability");
  }

  // response.ok / status / json() だけを使う実装に合わせた最小のモック応答
  function fetchResponse(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }

  it("200応答は ok:true で availableSlots を返し、/rooms/{id}/availability?date= を叩く", async () => {
    const captured: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        captured.push(url);
        return fetchResponse(200, {
          roomId: "660a5b6d",
          date: "2026-07-14",
          availableSlots: [{ startTime: "09:00", endTime: "18:00" }],
        });
      }),
    );
    const { getRoomAvailability: real } = await loadReal();

    const result = await real("660a5b6d", "2026-07-14");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.availableSlots).toHaveLength(1);
    expect(captured).toEqual(["/rooms/660a5b6d/availability?date=2026-07-14"]);
  });

  it("404応答は ProblemResponse を剥離して ok:false（ROOM_NOT_FOUND）で返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fetchResponse(404, { code: "ROOM_NOT_FOUND", message: "会議室が存在しません" }),
      ),
    );
    const { getRoomAvailability: real } = await loadReal();

    const result = await real("missing", "2026-07-14");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("ROOM_NOT_FOUND");
  });

  it("契約が定義しない非200/非404（例: 500）は例外として伝播する（決定4）", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fetchResponse(500, {})));
    const { getRoomAvailability: real } = await loadReal();

    await expect(real("room-a", "2026-07-14")).rejects.toThrow();
  });

  it("fetch自体の失敗（未起動・接続不可）は例外として伝播する（決定4）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const { getRoomAvailability: real } = await loadReal();

    await expect(real("room-a", "2026-07-14")).rejects.toThrow();
  });
});
