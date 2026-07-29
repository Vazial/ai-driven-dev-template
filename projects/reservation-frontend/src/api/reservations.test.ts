import { describe, it, expect, vi, afterEach } from "vitest";
import { createReservation } from "./reservations";

// モックAPI（createReservation）に対する単体テスト。
// contracts/reservation-booking.feature のRFE-B-02/03が要求するAPIレベルの応答形状を検証する
// （画面の振る舞いは src/features/booking の behavior テストで行う）。
// ドメインルール判定自体の網羅は src/api/reservationLogic.test.ts を参照（ここでは
// createReservation が判定結果を正しく反映し、成功時にMOCK_RESERVATIONSへ反映するかを確認する）。
describe("createReservation", () => {
  // RFE-B-02: 空いている時間帯を予約する
  it("空いている時間帯への予約は作成され、成功レスポンスを返す", async () => {
    const result = await createReservation({
      roomId: "room-a",
      reserverId: "sato",
      date: "2026-09-01",
      startTime: "14:00",
      endTime: "15:00",
      attendeeCount: 4,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        roomId: "room-a",
        reserverId: "sato",
        date: "2026-09-01",
        startTime: "14:00",
        endTime: "15:00",
        attendeeCount: 4,
      });
      expect(result.data.reservationId).toBeTruthy();
    }
  });

  // RFE-B-03: 直前に他の予約者に埋まった時間帯を予約しようとして拒否される
  it("直前に他の予約者が埋めた時間帯への予約はTIME_SLOT_CONFLICTで拒否される", async () => {
    const date = "2026-09-02";

    const first = await createReservation({
      roomId: "room-a",
      reserverId: "sato",
      date,
      startTime: "14:00",
      endTime: "15:00",
      attendeeCount: 4,
    });
    expect(first.ok).toBe(true);

    const second = await createReservation({
      roomId: "room-a",
      reserverId: "suzuki",
      date,
      startTime: "14:00",
      endTime: "15:00",
      attendeeCount: 2,
    });

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("TIME_SLOT_CONFLICT");
    }
  });

  it("存在しない会議室への予約はROOM_NOT_FOUNDで拒否される", async () => {
    const result = await createReservation({
      roomId: "存在しない会議室",
      reserverId: "sato",
      date: "2026-09-03",
      startTime: "14:00",
      endTime: "15:00",
      attendeeCount: 2,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ROOM_NOT_FOUND");
    }
  });

  // RSV-C-05相当: ドメインルール違反(30分未満)もそのまま拒否理由として伝わる
  it("30分に満たない予約はTOO_SHORTで拒否される", async () => {
    const result = await createReservation({
      roomId: "room-a",
      reserverId: "sato",
      date: "2026-09-04",
      startTime: "14:00",
      endTime: "14:15",
      attendeeCount: 2,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TOO_SHORT");
    }
  });
});

// 実APIモード（VITE_USE_REAL_RESERVATIONS_API=true）の分岐に対する単体テスト（3本目の実接続。
// rooms＝adr/0009、availability＝adr/0009 決定6(b) に続く初の「書き込み」の実接続）。
// 契約（reservation-api.yaml）が `POST /reservations` に定義する応答は 201・409・422 の3つだけであり、
// それ以外・fetch例外はネットワーク層の失敗として例外伝播させる（ADR-0009 決定4）。global.fetch を
// モックして検証し、実バックエンドは起動しない（meta/adr/0032: 配線・結合は機械検証する／走破は
// 回帰ゲートにしない）。USE_REAL_RESERVATIONS_API はモジュールロード時に評価されるため、env を
// 差し替えてから resetModules + 動的importで実モードのモジュールを取り直す。
describe("createReservation (実APIモード)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadReal() {
    vi.stubEnv("VITE_USE_REAL_RESERVATIONS_API", "true");
    vi.resetModules();
    return import("./reservations");
  }

  // response.ok / status / json() だけを使う実装に合わせた最小のモック応答
  function fetchResponse(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }

  const input = {
    roomId: "660a5b6d",
    reserverId: "user-001",
    date: "2026-07-14",
    startTime: "10:00",
    endTime: "11:00",
    attendeeCount: 4,
  };

  it("201応答は ok:true で ReservationResponse を返し、POST /reservations にJSONを送る", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push([url, init]);
        return fetchResponse(201, { reservationId: "rsv-123", ...input });
      }),
    );
    const { createReservation: real } = await loadReal();

    const result = await real(input);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.reservationId).toBe("rsv-123");

    expect(calls).toHaveLength(1);
    const [url, init] = calls[0];
    expect(url).toBe("/reservations");
    expect(init?.method).toBe("POST");
    // 契約はJSONボディを要求する（requestBody: application/json）
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });

  it("409応答（TIME_SLOT_CONFLICT）は ProblemResponse を剥離して ok:false で返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fetchResponse(409, {
          code: "TIME_SLOT_CONFLICT",
          message: "時間帯が既存の予約と重なっています",
        }),
      ),
    );
    const { createReservation: real } = await loadReal();

    const result = await real(input);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("TIME_SLOT_CONFLICT");
  });

  it("422応答（ドメインルール違反）は ProblemResponse を剥離して ok:false で返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fetchResponse(422, {
          code: "TOO_SHORT",
          message: "予約は30分以上でなければなりません",
        }),
      ),
    );
    const { createReservation: real } = await loadReal();

    const result = await real(input);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("TOO_SHORT");
  });

  it("契約が定義しない応答（例: 500）は例外として伝播する（決定4）", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fetchResponse(500, {})));
    const { createReservation: real } = await loadReal();

    await expect(real(input)).rejects.toThrow();
  });

  // 契約は POST /reservations に404を定義していない（reservation-api.yaml）。モックは存在しない
  // 会議室を ROOM_NOT_FOUND で拒否するが、実モードでは「契約が定義しない応答」＝例外になる。
  // このモード差は意図的（契約に404を足すのは人間承認の要る契約変更。reservations.ts の注記参照）。
  it("契約が定義しない404は ROOM_NOT_FOUND に解釈せず例外として伝播する（モード差は意図的）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fetchResponse(404, { code: "ROOM_NOT_FOUND", message: "会議室が存在しません" }),
      ),
    );
    const { createReservation: real } = await loadReal();

    await expect(real(input)).rejects.toThrow();
  });

  it("fetch自体の失敗（未起動・接続不可）は例外として伝播する（決定4）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const { createReservation: real } = await loadReal();

    await expect(real(input)).rejects.toThrow();
  });

  it("実APIモードでは MOCK_RESERVATIONS を書き換えない（モックの共有状態に触れない）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => fetchResponse(201, { reservationId: "rsv-999", ...input })),
    );
    const { createReservation: real } = await loadReal();
    const { MOCK_RESERVATIONS } = await import("./mockData");
    const before = MOCK_RESERVATIONS.length;

    await real(input);

    expect(MOCK_RESERVATIONS).toHaveLength(before);
  });
});
