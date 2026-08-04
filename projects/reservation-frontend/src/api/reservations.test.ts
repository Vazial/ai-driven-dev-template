import { describe, it, expect, vi, afterEach } from "vitest";
import { createReservation, cancelReservation } from "./reservations";
import { getRoomAvailability } from "./availability";

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

// POST /reservations/{reservationId}/cancel 相当（モックAPI cancelReservation）に対する単体テスト。
// contracts/my-reservations.feature（RFE-C）のRFE-C-03/04/05が要求するAPIレベルの応答形状を検証する
// （画面の振る舞いは src/features/my-reservations の behavior テストで行う）。
// ドメインルール判定自体の網羅は src/api/cancellationLogic.test.ts を参照（ここでは cancelReservation が
// 判定結果を正しく反映し、成功時にMOCK_RESERVATIONSへ論理削除として反映するかを確認する）。
// モック（cancelMockReservation）はNOT_RESERVER判定を実装しないため、reserverId引数の値は
// モックモードの判定結果には影響しない（契約解釈ポイント(2)、reservations.tsの注記参照）。
describe("cancelReservation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // RFE-C-03: 自分の予約をキャンセルする
  it("期限内のキャンセルは成功し、CancelledReservationResponseを返す", async () => {
    const created = await createReservation({
      roomId: "room-a",
      reserverId: "sato",
      date: "2026-09-10",
      startTime: "14:00",
      endTime: "15:00",
      attendeeCount: 2,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    vi.setSystemTime(new Date("2026-09-10T10:00:00")); // 開始15分前より十分前
    const result = await cancelReservation(created.data.reservationId, "sato");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        reservationId: created.data.reservationId,
        roomId: "room-a",
        date: "2026-09-10",
        startTime: "14:00",
        endTime: "15:00",
      });
      expect(result.data.cancelledAt).toBeTruthy();
    }
  });

  // RFE-C-03の3つ目のThen: キャンセルすると空き状況画面で再び空きになる
  it("キャンセルが成功すると、空き状況(getRoomAvailability)にその時間帯が空きとして反映される", async () => {
    const date = "2026-09-11";
    const created = await createReservation({
      roomId: "room-a",
      reserverId: "sato",
      date,
      startTime: "14:00",
      endTime: "15:00",
      attendeeCount: 2,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const before = await getRoomAvailability("room-a", date);
    expect(before.ok).toBe(true);
    if (before.ok) {
      // 14:00〜15:00が占有されているため、営業時間まるごと一つの空き区間にはならない
      expect(before.data.availableSlots).not.toEqual([
        { startTime: "09:00", endTime: "18:00" },
      ]);
    }

    vi.setSystemTime(new Date(`${date}T10:00:00`));
    const cancelled = await cancelReservation(created.data.reservationId, "sato");
    expect(cancelled.ok).toBe(true);

    const after = await getRoomAvailability("room-a", date);
    expect(after.ok).toBe(true);
    if (after.ok) {
      expect(after.data.availableSlots).toEqual([
        { startTime: "09:00", endTime: "18:00" },
      ]);
    }
  });

  // RFE-C-04: 開始直前になった予約をキャンセルしようとして拒否される
  // (Given「現在時刻は"10:15"である」と同一時刻をそのまま使う)
  it("開始15分前を過ぎた予約はCANCEL_DEADLINE_PASSEDで拒否される", async () => {
    const date = "2026-09-12";
    const created = await createReservation({
      roomId: "room-a",
      reserverId: "sato",
      date,
      startTime: "10:00",
      endTime: "11:00",
      attendeeCount: 2,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    vi.setSystemTime(new Date(`${date}T10:15:00`));
    const result = await cancelReservation(created.data.reservationId, "sato");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CANCEL_DEADLINE_PASSED");
  });

  // RFE-C-05: 別の画面で既にキャンセル済みの予約を、もう一度キャンセルしようとして拒否される
  it("既にキャンセル済みの予約は再びキャンセルできない(ALREADY_CANCELLED)", async () => {
    const date = "2026-09-13";
    const created = await createReservation({
      roomId: "room-a",
      reserverId: "sato",
      date,
      startTime: "14:00",
      endTime: "15:00",
      attendeeCount: 2,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    vi.setSystemTime(new Date(`${date}T10:00:00`));
    const first = await cancelReservation(created.data.reservationId, "sato");
    expect(first.ok).toBe(true);

    const second = await cancelReservation(created.data.reservationId, "sato");
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("ALREADY_CANCELLED");
  });

  it("存在しない予約IDはRESERVATION_NOT_FOUNDで拒否される(契約解釈ポイント(3)。通常到達しない経路)", async () => {
    const result = await cancelReservation("rsv-does-not-exist", "sato");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("RESERVATION_NOT_FOUND");
  });

  // 時刻の扱い（スライス指示）: 判定に使う現在時刻はモジュール読み込み時ではなく、cancelReservationの
  // 呼び出し時点で評価されなければならない（vi.setSystemTimeでもPlaywrightのpage.clockでも制御可能で
  // あるため）。モジュール読み込み時に一度だけ評価して固定していないことを、同一プロセス内で時刻を
  // 進めてから呼び出すことで確認する。
  it("現在時刻はモジュール読み込み時ではなく呼び出し時点で評価される", async () => {
    const date = "2026-09-14";
    const created = await createReservation({
      roomId: "room-a",
      reserverId: "sato",
      date,
      startTime: "10:00",
      endTime: "11:00",
      attendeeCount: 2,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // モジュールは既に読み込み済み。ここで初めて時刻を「開始後」に進めてから呼び出す。
    // 呼び出し時点評価でなければ(モジュール読み込み時に固定されていれば)この変更は反映されないはず
    vi.setSystemTime(new Date(`${date}T10:15:00`));
    const result = await cancelReservation(created.data.reservationId, "sato");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CANCEL_DEADLINE_PASSED");
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

// 実APIモード（VITE_USE_REAL_RESERVATIONS_CANCEL_API=true）の分岐に対する単体テスト（4本目の実接続。
// rooms＝adr/0009、availability＝adr/0009 決定6(b)、reservations作成 に続く）。
// 契約（reservation-api.yaml）が `POST /reservations/{reservationId}/cancel` に定義する応答は
// 200・403・409・422・404 の5つであり、それ以外・fetch例外はネットワーク層の失敗として例外伝播させる
// （ADR-0009 決定4）。global.fetch をモックして検証し、実バックエンドは起動しない（meta/adr/0032）。
describe("cancelReservation (実APIモード)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadReal() {
    vi.stubEnv("VITE_USE_REAL_RESERVATIONS_CANCEL_API", "true");
    vi.resetModules();
    return import("./reservations");
  }

  function fetchResponse(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }

  const cancelledResponse = {
    reservationId: "rsv-123",
    roomId: "room-a",
    reserverId: "user-sato",
    date: "2026-07-14",
    startTime: "10:00",
    endTime: "11:00",
    attendeeCount: 4,
    cancelledAt: "2026-07-14T09:30:00+09:00",
  };

  it("200応答は ok:true で CancelledReservationResponse を返し、reserverIdを含むJSONを送る", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push([url, init]);
        return fetchResponse(200, cancelledResponse);
      }),
    );
    const { cancelReservation: real } = await loadReal();

    const result = await real("rsv-123", "user-sato");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.cancelledAt).toBe(cancelledResponse.cancelledAt);

    expect(calls).toHaveLength(1);
    const [url, init] = calls[0];
    expect(url).toBe("/reservations/rsv-123/cancel");
    expect(init?.method).toBe("POST");
    // 契約はJSONボディに reserverId（必須）を要求する（CancelReservationRequest）
    expect(JSON.parse(String(init?.body))).toEqual({ reserverId: "user-sato" });
  });

  it("403応答（NOT_RESERVER）は ProblemResponse を剥離して ok:false で返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fetchResponse(403, { code: "NOT_RESERVER", message: "予約した本人ではありません" }),
      ),
    );
    const { cancelReservation: real } = await loadReal();

    const result = await real("rsv-123", "user-suzuki");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_RESERVER");
  });

  it("409応答（ALREADY_CANCELLED）は ProblemResponse を剥離して ok:false で返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fetchResponse(409, {
          code: "ALREADY_CANCELLED",
          message: "この予約は既にキャンセルされています",
        }),
      ),
    );
    const { cancelReservation: real } = await loadReal();

    const result = await real("rsv-123", "user-sato");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("ALREADY_CANCELLED");
  });

  it("422応答（CANCEL_DEADLINE_PASSED）は ProblemResponse を剥離して ok:false で返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fetchResponse(422, {
          code: "CANCEL_DEADLINE_PASSED",
          message: "開始15分前を過ぎているためキャンセルできません",
        }),
      ),
    );
    const { cancelReservation: real } = await loadReal();

    const result = await real("rsv-123", "user-sato");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CANCEL_DEADLINE_PASSED");
  });

  // 契約は POST /reservations/{reservationId}/cancel に404(RESERVATION_NOT_FOUND)を定義している
  // （POST /reservationsの404差＝ROOM_NOT_FOUNDとは異なり、こちらは契約・モックとも定義済みで
  // 差が無い。reservations.tsの注記参照）。
  it("404応答（RESERVATION_NOT_FOUND）は ProblemResponse を剥離して ok:false で返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fetchResponse(404, { code: "RESERVATION_NOT_FOUND", message: "予約が存在しません" }),
      ),
    );
    const { cancelReservation: real } = await loadReal();

    const result = await real("rsv-does-not-exist", "user-sato");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("RESERVATION_NOT_FOUND");
  });

  it("契約が定義しない応答（例: 500）は例外として伝播する（決定4）", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fetchResponse(500, {})));
    const { cancelReservation: real } = await loadReal();

    await expect(real("rsv-123", "user-sato")).rejects.toThrow();
  });

  it("fetch自体の失敗（未起動・接続不可）は例外として伝播する（決定4）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const { cancelReservation: real } = await loadReal();

    await expect(real("rsv-123", "user-sato")).rejects.toThrow();
  });

  it("実APIモードでは MOCK_RESERVATIONS を書き換えない（モックの共有状態に触れない）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => fetchResponse(200, cancelledResponse)),
    );
    const { cancelReservation: real } = await loadReal();
    const { MOCK_RESERVATIONS } = await import("./mockData");
    const before = MOCK_RESERVATIONS.map((r) => ({ ...r }));

    await real("rsv-123", "user-sato");

    expect(MOCK_RESERVATIONS).toEqual(before);
  });
});
