# design.md — 会議室予約システム 設計骨格

> ステータス: 承認済み(2026-07-13) — developer/testerはこの骨格の中で作業する
> 「現在の設計の地図」。承認後はarchitectが構造変更のたびに上書き維持する
> 出典: ADR-0001(ドメインモデルパック) / ADR-0002(Java+Spring+JPA) / docs/workshop-summary-01-reservation.md

## モジュール境界(パッケージ構成)

Gradle単一プロジェクト。パッケージで層を分け、依存方向はArchUnitで機械強制する(L2)。

```
projects/reservation-system/
  src/main/java/reservation/
    domain/          … 集約・値オブジェクト・ドメインルール。フレームワーク非依存(Spring/JPAを知らない)
    application/     … ユースケース(予約を作成する)。domainを組み立て、portを呼ぶ
    adapter/
      api/           … REST受付(POST /reservations)。契約reservation-api.yamlの形に忠実
      persistence/   … JPAリポジトリ実装・DB制約とのやりとり
  src/test/java/     … 単体テスト(L1)・ArchUnitテスト(L2)
  src/acceptanceTest/java/reservation/acceptance/
    steps/           … step定義(シナリオ文とDSLの対応付けだけ。testerの領分)
    dsl/             … テストDSL(予約を作成する等の業務操作関数。HTTP詳細をここに閉じ込める)
```

依存方向(L2でArchUnit強制): `adapter → application → domain`。逆流禁止。domainはSpring/JPAに依存しない。

## データモデル

ワークの設計判断をそのまま写す。予約1件=1行の小さい集約。

**reservations テーブル**
| 列 | 型 | 備考 |
|---|---|---|
| id | UUID | 予約ID |
| room_id | VARCHAR | 会議室ID |
| reserver_id | VARCHAR | 予約者(社員に限定しない。人間承認済みの一般化) |
| date | DATE | 予約日 |
| start_time / end_time | TIME | 半開区間[start, end)。end含まず |
| attendee_count | INT | 利用人数 |
| business_hours_start / _end | TIME | 予約時点の営業時間スナップショット(ADR-0006相当) |
| capacity_snapshot | INT | 予約時点の定員スナップショット(同上) |
| cancelled_at | TIMESTAMP NULL | このスライスでは常にNULL(キャンセルは次スライス) |
| version | BIGINT | 楽観ロック(@Version) |

**rooms テーブル**(このスライスではGiven用の最小構成)
| 列 | 型 |
|---|---|
| id / name | VARCHAR |
| business_hours_start / _end | TIME |
| capacity | INT |

## 不変条件の実施場所(ワークADR-0002相当の順序)

| ルール | 実施場所 |
|---|---|
| 排他的占有(RSV-C-02〜04) | **DB排他制約が砦**: PostgreSQLのEXCLUDE制約(room_id×時間範囲の重なり禁止、WHERE cancelled_at IS NULL) + 事前チェックで平易なエラーを返す |
| 予約単体のルール(RSV-C-05〜07, 11) | domainの値オブジェクト(TimeSlot)が生成時に弾く |
| 営業時間・定員(RSV-C-08〜10) | domainがRoomスナップショットと突き合わせて弾く |

## DB選定(確定)

排他制約(時間範囲の重なり禁止)はPostgreSQL固有機能のため、**テスト・ローカル実行はTestcontainers上のPostgreSQL**を使う。
コンテナ実行環境は**Podman**(人間確認済み)。TestcontainersはPodmanのDocker互換APIで動かす。

## 主要な流れ(予約作成)

```
POST /reservations
  → adapter/api: リクエスト検証・詰め替え
  → application: 部屋を取得 → スナップショット付きでReservation生成(domainがルール検証)
  → adapter/persistence: INSERT(DB排他制約が最終防衛)
  → 201 or 409/422(理由コード)
```
