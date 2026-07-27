---
id: 0007
scope: project/reservation-frontend
status: superseded
date: 2026-07-26
approved_by: null
supersedes: []
superseded_by: 0008
relates_to: [P-01, P-02, P-05, P-06, P-10, FR-005]
---
# ADR-0007: フロント検証を実装フェーズへ運用化する（L1/L4のCIゲート化・Playwright E2E導入）。L3の型生成をconsumer-driven契約に合わせてdeferする

> **（superseded注記）** 本ADRのL3（型生成）に関する結論（`meta/adr/0023`のconsumer-driven契約との
> 前提逆転を理由にdeferする）は、`meta/adr/0025`（クロスプロジェクトのSSoT一元化。「形を決める権利」
> と「形を保管する場所」を分離）の制定により前提が解消されたため、`reservation-frontend/adr/0008`が
> supersedeする。L1/L4のCIゲート化・Playwright E2E導入・L2/L5を今回のスコープに含めない判断は、
> ADR-0008がそのまま引き継いでおり、内容として失われるものはない（本文はP-06により編集しない）。

> **承認者向けサマリ**: `reservation-frontend/adr/0003`（承認済み）は、フロント検証の方式（L1: Vitest+lint、
> L2: 境界ルール、L3: `reservation-api.yaml`からの型生成、L4: Playwright E2E）を既に決定していたが、
> 実装は伴っていなかった（Playwright未導入、フロントはCI未接続でVitest 42件すらCIで回っていない、L2は
> `no-restricted-imports`による部分的な担保のみ、L3は未着手）。人間は「方式は決めた通り、実装フェーズに
> 落とし込む（ADR＋実装＋CI）」ことを決定した。本ADRはその落とし込み方をarchitectが起草するもので、
> 完全スコープ・Playwright採用・CIゲート化そのものは人間確定であり再検討しない。
>
> **今回実装する範囲**: (1) 既存Vitest（42件）とlintを**フロントCIジョブで緑ゲート**にする。(2)
> **Playwright E2E**を導入し、承認済み設計骨格のスライス（RFE-A/RFE-B）が持つユースケース（空いている
> 時間帯を予約する・二重予約は拒否され理由が画面で分かる）の走破を、**最初のE2Eとしてスクリプト化し
> CIで実行する**。これは`meta/adr/0024`の決定Cが持つ限界（走破がorchestratorのブラウザ操作ツールに
> 依存し、その実行自体が不安定）を、安定・再現可能・自動ゲート化されたE2Eで補う位置づけである。
>
> **今回整合を取る重要な点**: `reservation-frontend/adr/0003`のL3（`openapi-typescript`等で
> `reservation-api.yaml`から型・クライアントを生成する）は「バックエンド契約が先にある」ことを前提と
> していたが、`meta/adr/0023`はその後consumer-driven契約（**フロントの`src/api/`が先行して形を決め、
> `reservation-api.yaml`は後でformalizeされる**）を制度化しており、前提が現状と逆転している。本ADRは
> **L3の型生成を当面deferする**と結論する。`reservation-frontend/adr/0003`本文は編集しない（P-06）。
>
> **今回やらないこと**: L5（VRT）は新設しない（`meta/adr/0024`のリーン方針を踏襲）。L2の境界ルール強化
> （`eslint-plugin-boundaries`等への移行）も今回のスコープに含めない（現状の`no-restricted-imports`を
> 維持）。承認いただきたいのは、この実装範囲の切り分けとL3整合の結論そのものである。

## 文脈

### 1. 方式は決定済み、実装は未着手

`reservation-frontend/adr/0003`（承認済み、2026-07-18）は、フロント検証の全段（L1〜L5）のツールを
既に決定している。

| 段 | ADR-0003が決めたツール | 現状 |
|---|---|---|
| L1 | Vitest + Testing Library、ESLint + Prettier | Vitestで42件のテストは存在するが、CIで実行されていない |
| L2 | ESLint境界ルール（例: eslint-plugin-boundaries）またはdependency-cruiser | `no-restricted-imports`による部分的担保のみ |
| L3 | openapi-typescript等による`reservation-api.yaml`からの型・クライアント自動生成 | 未実装 |
| L4 | Playwright（E2E、主要フローに限定） | 未導入 |

つまりフロントエンドは、`.github/workflows/ci.yml`（現状reservation-system専用、L0〜L4のJavaパイプ
ラインのみを持つ）に一切接続されていない。人間が「フロントの検証・CIを完全に実装する（ADR＋実装＋CI）」
と決定した。これはADR-0003の再検討ではなく、その運用化（operationalize）である。

### 2. `meta/adr/0024`（決定C）の限界と、E2Eの位置づけ

`meta/adr/0024`は、FR-005（表示モデルの変更に伴い利用者の操作自由度が黙って失われた欠陥）を受けて、
断面②の検証にユースケース走破（実機で目的を通しで達成できるかを試す）を加えることを決定した（決定C）。
同ADRは走破・照合による校正の中で、**Cの実効性の限界**も自ら記録している: 走破はorchestratorが持つ
ブラウザ操作ツールの実行に依存し、その実行自体の信頼性に限界がある（スクリーンショット取得の失敗、
アクセシビリティツリーの陳腐化が実際に観測された）。0024はこの限界を踏まえ、「Cは人間の目視レビューを
置換せず、それを補助するバックストップ」と位置づけている。

本ADRが導入するPlaywright E2Eは、この限界を補う**別の層**である。RFE-A/RFE-Bの主要フロー（空いている
時間帯を予約する・二重予約は拒否される）を自動化されたE2Eとしてスクリプト化すれば、そのフローについては
「orchestratorが都度ブラウザを操作して確かめる」不安定な手段に頼らず、**安定・再現可能・CIで継続的に
実行される回帰の網**として機能する。ただし、これは`meta/adr/0024`の決定Cそのものを置き換えるものでは
ない（0024は編集しない、P-06）。今後の新規スライスの断面②における走破（orchestrator実施・人間最終
判断）は、0024が定める手順のまま続く。E2Eは「一度走破し終えたユースケースを、以後は機械が継続的に
見張る」という**下の段への押し込み**（P-10: 上の段で見つかった失敗・限界は下の段の検証を強化する材料に
する）であり、Cという手順自体の要否を再検討するものではない。

### 3. L3とconsumer-driven契約の前提の逆転

`meta/adr/0023`（クロスプロジェクトの協調の正式化）は、reservation-frontendとreservation-systemの
初の実連動（`GET /rooms`）から、**consumer-driven contract**（UIの設計・実装がバックエンド契約の形を
駆動してよい。フロントは"契約に対して"作り、動くバックエンドの完成を待たない）を制度化した。

`reservation-frontend/adr/0003`のL3は、`reservation-api.yaml`を出発点として型・クライアントを生成する
方式であり、これは**「バックエンド契約が先に確定している」ことを前提にした方式**である。しかし現状の
実態は逆である: RFE-B（予約作成）はバックエンドの`POST /reservations`（RSV-C）契約を参照するが、
`GET /rooms`はまだreservation-system側で人間承認前（`status: 提案中`）であり、フロントは自身の
`src/api/`（手書きの型・クライアント）を先行させて実装を進めている。これがconsumer-driven契約が実際に
機能している状態そのものであり、`src/api/`が現時点での**emerging contract**（形成途上の契約）である。

この状態で`reservation-api.yaml`からの型生成をL3として今実装すると、以下の問題が生じる:
- 生成元の`reservation-api.yaml`自体がバックエンド側で人間承認前の部分を含み、生成した型を「確定した
  契約」であるかのように扱ってしまう（実態はまだ形成途上）
- consumer-driven契約が定めた依存の向き（フロントの必要→バックエンド契約の形）と、L3の生成の向き
  （バックエンド契約→フロントの型）が逆転しており、どちらが真の発生源かが曖昧になる

## 決定

以下は人間確定（完全スコープ・Playwright採用・CIゲート化）であり、architectはこれを再検討しない
（`meta/adr/0011`の精神）。本ADRはその実装範囲の切り分けと、L3整合の結論を定める。

### 1. 今実装する範囲

- **L1（実装の内部品質）**: 既存のVitest（42件）とESLint + Prettier（lint）を、**フロントCIジョブとして
  緑ゲート化**する。新規のテスト・ルールをこのADRで追加するものではなく、既存の資産をCIに接続する
- **L4（仕様の充足）**: **Playwright**を導入し、E2Eを主要フローに限定して実装する。**最初のE2Eとして、
  承認済み設計骨格のスライスRFE-A/RFE-Bが持つユースケースの走破をスクリプト化する**: 空いている時間帯を
  クリックして予約者ID・人数を入力し予約を確定する→タイムラインに予約済みとして反映される、および
  二重予約（他の予約者に先に埋められた時間帯への予約）は拒否され、拒否の理由が画面で分かる。この2フロー
  は`contracts/reservation-booking.feature`（RFE-B-01〜03）が既に受け入れシナリオとして持つ内容であり、
  同ユースケースをE2Eとして機械実行可能な形にする。**シナリオ本文・具体的なテストデータ（会議室名・
  時刻等）の選定はdeveloper/testerの実装判断に委ねる**（本ADRはユースケースの範囲・位置づけのみ決める。
  ADR-0014の精神により、実装コード・具体的なテストコードはarchitectが書かない）
- 上記2点により、フロントエンドはL1とL4を持つCIゲートを得る。**L2・L3は今回のCIゲートに含めない**
  （L2は現状の`no-restricted-imports`を維持し新規のCIジョブ化はしない。L3は下記2.の通りdeferする）。
  CI上の段の実行順序は`meta/verification.md` 3.3（L1→L2→L3→L4、下が落ちたら上を実行しない）の精神を
  踏まえ、フロントのチェーンは実質**L1→L4**（L2は既存lintの一部として、L3は無し）となる

### 2. L3（型生成）はconsumer-driven契約に合わせてdeferする

**`reservation-frontend/adr/0003`のL3（`reservation-api.yaml`からの型・クライアント自動生成）は、
当面実装しない（defer）。** フロントの`src/api/`が現時点の契約の源（emerging contract）であり続ける。
理由は「文脈」3.の通り: L3が前提としていた「バックエンド契約が先に確定している」という順序が、
`meta/adr/0023`のconsumer-driven契約によって実態として反転しているため、今generateすると誤った依存の
向き（バックエンド→フロント）を固定してしまう。

- **本ADRは`reservation-frontend/adr/0003`本文を編集しない（P-06）**。同ADRのL3に関する前提を、本ADR
  側でのみ上書き宣言する。これは`meta/adr/0024`が`meta/adr/0021`（骨格凍結）に対して行った関係整理
  （supersedeはせず、限界・前提の食い違いを新ADR側にのみ明記する）と同型の扱いである
- **再検討条件**: フロントの`src/api/`が形成してきたemerging contractが、consumer-driven契約の手順
  （`meta/adr/0023`）に沿って`reservation-api.yaml`側にformalizeされ、バックエンド側の人間承認を経た
  後に、L3の向き（`reservation-api.yaml`からの生成、または双方の突き合わせ）を改めて検討する。それまでは
  `reservation-api.yaml`とフロントの型定義の整合はL3の機械検証を持たない状態が続く
- `meta/verification.md` 4節（段×手段の対応表）のフロントL3「同一API仕様→クライアント/型生成」は
  引き続き**将来の到達点**として有効であり、本ADRはこれを取り下げるものではない。今このタイミングでの
  実装をdeferするだけである

### 3. 今回やらないこと（過剰にしない）

- **L5（VRT）は新設しない**。`meta/adr/0024`が既に「コスト方針として規約と検証手順に留め、ツールは
  作らない（VRT等の自動化は今回採らない）」と決定しており、本ADRもこれを踏襲する。新しい決定ではない
- **L2の境界ルール強化は今回のスコープに含めない**。`eslint-plugin-boundaries`への移行や
  dependency-cruiserの導入は、現状の`no-restricted-imports`による部分的担保からの構造的な強化に
  あたるが、今回は現状維持でよいと判断する。必要になった時点で別途提案する（P-05: 摩擦が発生した時
  だけ足す）

### 4. `meta/verification.md`との関係

`meta/verification.md` 4節は、フロントL1の手段として「単体テスト、lint」を、L4の手段として「E2E
（主要フローのみ）」を既に挙げている。本ADRが決める手段（Vitest、Playwright）はいずれもこの既存の
枠内にある選択であり、`meta/verification.md`自体への変更は不要（`meta/adr/0024`が同種の判断をL5に
ついて行った先例に倣う）。

## 検討した代替案

- 案A: L3（型生成）もADR-0003の通り今回一緒に実装する / 不採用: `meta/adr/0023`のconsumer-driven契約
  と前提が逆転しており、今generateすると「バックエンド契約が真の発生源」という誤った依存の向きを
  CIの機械検証として固定してしまう。formalizeされた後に生成の向きを検討する方が実態に忠実
- 案B: L3の生成方向を逆転させ、フロントの`src/api/`から`reservation-api.yaml`側の断片を生成する
  （逆生成） / 不採用: 今回のスコープを大きく超える。consumer-driven契約自体がまだ運用の途上（PR
  ベースでの越境authorizeを前提としており、機械的な自動生成にはまだ早い）であり、過剰な先回り
  （P-05）。formalize後の再検討候補として記録するに留める
- 案C: Playwright E2Eの導入を見送り、当面`meta/adr/0024`の決定C（orchestratorによる人間手動の走破）
  のみで済ませる / 不採用: 人間確定（完全スコープでの実装）により再検討対象外。加えて`meta/adr/0024`
  自身がCの実効性の限界（ブラウザ操作ツールの不安定さ）を認めており、自動化されたE2Eで安定した回帰
  保証を持つことが望ましい
- 案D: L2の境界ルール強化（eslint-plugin-boundariesへの移行）も同時に行う / 不採用: `meta/adr/0024`
  のコスト方針（過剰にしない）を踏襲する。現状の`no-restricted-imports`で今回は足り、構造的な強化は
  必要になった時点で別途提案する

## 帰結

- **フロントCIジョブが新設される**（実コマンド・YAMLの詳細はdeveloperの実装領分。`meta/adr/0014`により
  CIワークフロー（`.github/workflows/`）の編集自体はorchestratorが行うが、**本ADRが決めるのは
  「何を検査するか」というゲートの内容**であり、これは人間承認事項である）。既存のVitest 42件・lintが
  緑ゲートとして機能するようになり、Playwright E2E（Chromium・実ブラウザ）がCIで実行される
- **CIゲートの追加は`meta/permissions.md`が定める人間承認事項**（「CIワークフロー: ゲート（必須
  チェック）の変更時のみ承認」）にあたる。本ADRの承認が、その承認を兼ねる
- **`reservation-frontend/adr/0003`は編集しない**。L3に関する前提の食い違いは本ADR側にのみ記録し、
  同ADRの`status`・`supersedes`/`superseded_by`はいずれも変更しない
- **L3（型生成）は次スライス以降の再検討候補として持ち越す**。再検討条件はconsumer-driven契約の
  emerging contract（`src/api/`）が`reservation-api.yaml`側にformalizeされた後
- **friction-logへの新規起票はしない**。本ADRは事故・矛盾の発見ではなく、既に判明していた前提の
  ずれ（ADR-0003のL3前提とADR-0023のconsumer-driven契約）を実装フェーズに入る前に整理したものであり、
  P-05（摩擦が発生した時だけ足す）に照らし予防的な記録は追加しない。将来L3をめぐる実際の摩擦
  （例: formalize後の生成方向を誤った等）が起きたら、その時点でFR化する
- **design.md / ARCHITECTURE.mdへの変更なし**。両ファイルはreservation-frontendにまだ存在しない
  （活動記録上、design.md・ARCHITECTURE.mdの新規作成は別途「進行中/次にやること」項目として残っている）。
  本ADRは検証・CIインフラの運用化であり、モジュール構成・境界そのものを変えるものではないため、
  仮に両ファイルが存在していたとしても更新対象にはならない

---
> **（上記「帰結」のL3関連2行はADR-0008により内容として上書きされた。本文はP-06により編集しないため
> そのまま残すが、L3の再検討条件・結論は`reservation-frontend/adr/0008`を正とする。**
