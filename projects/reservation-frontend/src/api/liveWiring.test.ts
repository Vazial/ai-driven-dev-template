import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// 「配線」の回帰ゲート（軽量版）。
//
// ADR-0031 は、クロスプロジェクト結合ゲートの実ジョブの中身を実装スライスへ委譲した。本スライスの
// 選択は「走破（ADR-0024、人間が最終判断）＋軽い配線テスト」であり、これがその軽い配線テストにあたる。
// 実スタック（PostgreSQL＋Spring）を起動せず、フロント側だけで次の不変条件を固定する:
//
//   実APIモードの fetch が叩くパスは、Vite dev server の proxy が同一オリジンに見せる
//   プレフィックスで必ずカバーされていなければならない。
//
// これが崩れる変更（proxyルールの削除・改名、実fetchパスを proxy 外へ変える＝越境が必要になる、等）は、
// モックのみで完結する L1/L4 では検出できず、走破まで無言で壊れる（FR-007 が実証した「配線・識別子空間は
// モックでは検出できない」性質）。本テストはその配線ドリフトを CI で先に捕まえる（P-10: 走破=上段で
// 見つかった失敗種で下段の検証を強化する）。バックエンドは無変更・CORSなし（ADR-0009 決定2）という前提も、
// 「実fetchは proxy 配下の相対パスだけを叩く」ことと同義であり、それを本テストが担保する。

const here = path.dirname(fileURLToPath(import.meta.url));

/** vite.config.ts の server.proxy が宣言するプレフィックス（例: '/rooms'）を素朴に抽出する */
function proxiedPrefixes(): string[] {
  const configText = readFileSync(path.resolve(here, "../../vite.config.ts"), "utf-8");
  const proxyIndex = configText.indexOf("proxy");
  const proxyBlock = proxyIndex >= 0 ? configText.slice(proxyIndex) : "";
  return [...proxyBlock.matchAll(/['"](\/[A-Za-z0-9/_-]+)['"]\s*:/g)].map((m) => m[1]);
}

/** response.ok/status/json だけを使う実装に合わせた最小のモック応答 */
function fetchResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe("実API配線: fetchパスは Vite proxy プレフィックスでカバーされる", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("vite.config.ts が proxy プレフィックスを少なくとも1つ宣言している", () => {
    expect(proxiedPrefixes().length).toBeGreaterThan(0);
  });

  it("rooms・availability の実fetchが叩くパスが、全て proxy プレフィックス配下にある", async () => {
    const prefixes = proxiedPrefixes();

    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        // rooms は {rooms:[]}、availability は {availableSlots:[]} を期待する。両方を満たす形で返す
        return fetchResponse({ rooms: [], roomId: "r", date: "d", availableSlots: [] });
      }),
    );

    vi.stubEnv("VITE_USE_REAL_ROOMS_API", "true");
    vi.stubEnv("VITE_USE_REAL_AVAILABILITY_API", "true");
    vi.resetModules();
    const rooms = await import("./rooms");
    const availability = await import("./availability");

    await rooms.listRooms();
    await availability.getRoomAvailability("room-x", "2026-07-14");

    expect(urls.length).toBe(2);
    for (const url of urls) {
      const covered = prefixes.some((p) => url.startsWith(p));
      expect(
        covered,
        `実fetchのパス ${url} が proxy(${prefixes.join(", ")})でカバーされていない＝越境が必要になる配線ドリフト`,
      ).toBe(true);
    }
    // availability が実際に /availability を叩いていることも固定する（パスの取り違え防止）
    expect(urls.some((u) => u.includes("/availability"))).toBe(true);
  });
});
