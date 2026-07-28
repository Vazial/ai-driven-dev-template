# activeContext.md — 会議室予約フロントエンド

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 更新タイミング: スライスの区切り、エスカレーション発生時（permissions.md）
> 最終更新: 2026-07-28

## 今どこにいるか

**（最新・2026-07-28）フロントが初めて実バックエンドに接続した**（ADR-0009「承認済み」、PR #26・
**マージ待ち**）。`meta/adr/0023`が図示した「2つ目の交点＝E2E結合」の初適用として、`GET /rooms`
（RSV-L）**1本だけ**を実接続した。方式: モックを既定に残し`VITE_USE_REAL_ROOMS_API`でopt-in切替、
Vite dev serverのproxyで`/rooms`→`localhost:8080`（**バックエンドは無変更＝CORSを足さない＝越境しない**）、
E2E（Playwright 4件）はモック構成のまま据え置き、CIにPostgreSQL/Springは足さない。

**走破（ADR-0009決定5）は成功した**: 実DBに投入した会議室（`実DB会議室オリオン`・`実DB会議室ペガサス`）
が画面に表示され、モック由来の名前（`会議室A`/`会議室B`）は画面に現れなかった。proxy・生成型・name昇順・
fetch配線が実地で機能することを確認した。

**同時に、走破でしか分からない重要な帰結が判明した（FR-007）**: `GET /rooms`だけ実APIにすると、
**画面は実質的に機能しない**。実DBのroomIdはサーバ採番のUUIDである一方、
`GET /rooms/{roomId}/availability`はモックのまま`MOCK_ROOMS`（`room-a`/`room-b`）を探すため、必ず
`ROOM_NOT_FOUND`となり全会議室に「会議室が存在しません」と表示される。これはバグではなく**部分的な
実接続が識別子の名前空間を分断することの必然**であり、モックのみで完結するL1/L4は原理的に検出できない。
→ **実用するには`availability`の同時接続が必要**（ADR-0009決定6の条件(b)が想定より早く到来）。

---

**（前段・2026-07-27）developerが、フロントの契約型をSSoT（バックエンドyaml）から生成する方式への切替を完了した**
（2026-07-27、ADR-0008「承認済み」・人間が決定5＝生成(`openapi-typescript`)を選択、PR#20マージ後）。
RSV-L（`GET /rooms`）の断面①がbackend側で人間承認され（`reservation-system/contracts/
reservation-api.yaml`、承認済み: 2026-07-27）、`design/reconciliation/
rsv-l-room-list-ssot-reconciliation.md`が示していたドリフト（`RoomListResponse`型の不在）を、
生成方式への切替そのもので解消した。実施内容:
- `openapi-typescript`をdevDependencyに追加、`npm run gen:api`で`../reservation-system/
  contracts/reservation-api.yaml`（SSoT）から`src/api/schema.d.ts`（生成物、コミット対象）を生成
- `src/api/types.ts`を「手書きの写し」から「生成物からの再エクスポート」に切替。契約型
  （`RoomSummary`・`RoomListResponse`（新規）・`AvailabilityResponse`・`AvailableTimeSlot`・
  `ProblemResponse`・`ReservationResponse`）は`components["schemas"][...]`から導出。名前差
  （yamlの`CreateReservationRequest` ↔ フロントの`CreateReservationInput`）はエイリアスで吸収。
  `ApiResult<T>`はフロント固有のエルゴノミクス型として手書きのまま維持（生成対象外）
- `src/api/rooms.ts`の`listRooms()`を、`RoomListResponse`（`{ rooms: [...] }`）を受け取り
  `.rooms`を剥離するアダプタに変更。公開シグネチャ`Promise<RoomSummary[]>`・name昇順ソートは無変更
- `eslint.config.js`に`src/api/schema.d.ts`（生成物、手編集禁止）をlint対象外として追記
- 検証: Vitest 42件緑・ESLint緑・`tsc -b && vite build`緑・Playwright e2e 4件緑（全て維持、
  RoomListResponse以外の想定外ドリフトは無し）
- 副次対応: `npm install`が`typescript@~6.0.2`と`openapi-typescript`のpeer要求(`^5.x`)で
  ERESOLVEになったため`--legacy-peer-deps`で導入。この結果`@testing-library/dom`（peer依存、
  従来はnpmの自動peerインストールで暗黙に入っていた）がnode_modulesから外れ42件全滅する副作用が
  出たため、`@testing-library/dom`を明示devDependencyとして追加して復旧した

**フロント実装（developer/testerの着手）は保留し、designerの作りこみを優先している。**

ADR-0001（シンプルCRUDパック）・ADR-0002（独立プロジェクト）・ADR-0003（TS+React+Vite）は人間承認済み。
ADR-0004（画面モック承認プロセス）・ADR-0005（shadcn/ui採用）はいずれも人間承認前。

designer役はmeta/adr/0017で新設された後、内部AIによるUI/UX発案が2回にわたり実用水準に届かず（FR-001）、
外部AI（Gemini）による発案が実用水準に到達したことから「design integrator（外部設計の統合役）」へ
再定義された（meta/adr/0018）。続けて、外部AI実行の自動化を検証したところ、**ADR-0019が規定した伝送
方式（Gemini CLIのヘッドレス実行）が誤りだった**ことが判明した（FR-003）: Gemini CLIはエージェント型の
コーディングCLIであり、ブリーフを渡すと設計でなく実装計画を返した。**正しい伝送はGenerative Language
APIの`generateContent`を直接呼ぶこと**で、これに切り替えたところ実用水準の設計が返った（meta/adr/0020、
ADR-0019をsupersede）。

あわせて、**成果物の形式を「自己完結HTML」から「実プロジェクトの受け皿でTSXとして無改変描画する」形に
変更した**（meta/adr/0020）。理由: 自己完結HTMLは実装時に人間が翻訳する過程でデザインが変容するリスク
があったため（実際、agentが手で静的HTMLに書き直してレビューし「ダサい」と指摘された事例があり、これも
禁止事項として明記した）。**受け皿`projects/reservation-frontend/src/design-preview/`（Vite+React+TS+
Tailwind+shadcn/ui、`@/*`エイリアス、主要13コンポーネント導入済み）は構築が完了し、外部AIの成果物
を無改変配置してdevサーバで描画・レビューする経路を確立、人間承認（「原案としてOKな水準」）まで到達
した**。

**続けて、designerの(b)外部AI実行の実行主体を明確化した**（meta/adr/0021、ドラフト・人間承認待ち）:
meta/agents.md §4・ADR-0020は「(b)はdesignerが行う」と記述していたが、**designerのツールはRead/Grep/
Glob/WriteのみでありBash等の実行手段を持たない**。実際の運用でも外部AI実行はorchestratorが代行して
おり、規定と実態が乖離していた。ADR-0021はこの乖離を「**orchestratorがdesignerの依頼を受けて代行する**」
と明文化した（designerにBashを与える案は、中核制約（実装コードを書かない・読まない、UI/UXを自ら発案
しない）の担保が緩むため不採用）。

**あわせて、外部AI成果物の改修ガバナンスを定めた**（meta/adr/0021）。「人間レビュー後の改修はどのみち
必ず発生する」「1から作り直すと劣化する（作り直し禁止・タタキの調整として改修する）」という前提の下、
**劣化検知の基準線を「レンダリング画像のピクセル比較」ではなく「おおまかなコンポーネント構成（骨格）」
にする**方針に転換した。当初案（人間承認時点のレンダリング画像を機械判定の基準線にし、視覚的差分ゼロ
を求める）は人間の指摘により撤回した——洗練（操作感・細かいUI・architectとの齟齬解消）は必ずピクセルを
動かすため、ピクセル差分を字義通りの赤信号にすると警報が鳴りっぱなしになり機能しない。骨格を凍結すれば、
本当に鳴るべき場所（骨格の作り替え＝劣化・作り直しの兆候）でだけ警報が鳴る。**レンダリング画像は機械
判定の基準線から、人間がbefore/afterを見比べるための記録に格下げした**。「UIの劣化」の最終判定は引き
続き人間の目視で行う。

ブリーフ構成も精緻化した（meta/adr/0020）: 「リッチ＝網羅」ではなく、外部AIにしか出せないもの（画面の
発想）に出力予算を集中させ、architectの領分（契約の精度・エッジケース網羅）はブリーフに載せない。
「現状の不満点」は必須要素から任意要素に格下げした（無くても実用水準の設計に到達した実測があるため）。
雛形`meta/templates/design-brief.md`をこの構成に改訂済み。

**designerフロー(a)ブリーフ作成→(b)外部AI実行→(c)reconciliation→(d)仕上げが、1サイクル一巡した**。
ブリーフ`design/briefs/room-booking-experience-brief.md`から外部AI（Gemini `gemini-3-flash-preview`）
が`src/design-preview/BookingDesign.tsx`を返し、無改変で受け皿に配置、devサーバでの描画・人間承認まで
到達した。続けて(c)reconciliationを実施し、`design/reconciliation/booking-design-reconciliation.md`
として、新規API4件の要否・情報公開範囲の論点・契約シナリオの未表現状態を整理した。

**続けて、architectがreconciliationを拡張・統合した**（2026-07-21）: orchestratorが実機・ソースで
見つけた実装レベルの不整合6件（会議室ごとの営業時間無視・予約検証の欠如・文言矛盾・守れない約束・
キャンセル境界のバグ・認証なしの覗き見リスク）と、architect自身が追加で洗ったシナリオ充足・API仕様・
ADR整合の論点を統合し、**不整合・論点22件の全てに分類タグ**（契約変更が要る／人間判断が要る／設計調整
で足りる／実装時に直す）を付けた。**最大の分岐は認証の要否**（`reserverId`が無認証・自由入力である
現行契約の前提の上に、設計が予約者名の表示・`reserverId`一致による自分の予約閲覧を乗せていたため）
として整理された。

**その最大の分岐について、人間が決定した**（2026-07-21、`projects/reservation-frontend/
adr/0006-adopt-plan-b-no-auth-limited-disclosure.md`）: **案B（無認証を維持しつつ情報公開範囲を絞る）
を当面採用。案C（軽量認証の導入）は将来オプションとして明示的に残す**。具体的な帰結:
- 予約者名は画面に表示しない（タイムラインは「空き/予約済み（不可）」の二値状態表示にとどめる）
- 「自分の予約」はサーバAPIを持たず、端末ローカル（localStorage等）で管理する
- 占有情報を返す新規API（`GET /reservations?date=`・`GET /reservations?reserverId=`）は不採用。
  `reservation-system/adr/0006`（空き枠のみを返す設計）の再検討も不要——`availableSlots`から
  「空き/不可」の二値だけを導出すればよく、占有情報API不採用の判断と整合する
- `reserverName`（表示名）フィールドはバックエンド契約に追加しない

この決定により、**バックエンド契約（reservation-api.yaml）・reservation-system側の既存ADR
（0003・0005・0006）はいずれも無変更**のまま維持される。reconciliationの不整合22件のうち**6件が
解決済みとなり、残る未決は2件**（`GET /rooms`の採否、`PATCH /reservations/{id}`の要否）に絞られた。
architectはreconciliationに「案Bが要求する設計調整（骨格内）」リスト（4項目、今は実装しない）を追記
した——予約者名の除去・自分の予約のlocalstorage化・時間調整案内文の除去・タイムラインの空き/不可
二値表現化。いずれも骨格（ヘッダー／タイムライン・会議室一覧・予約ダイアログ・自分の予約Sheetという
主要ブロックの構成）の作り替えを伴わない（meta/adr/0021の凍結対象を尊重）。

**developer宿題`meta/tools/commission_design_api.py`は実装・テスト・CI接続まで完了した**（meta/adr/0020）。
Generative Language API直叩き、smokeテスト24件（ネットワーク不使用）、`.github/workflows/ci.yml`の
govlintジョブに接続済み。一方、`src/design-preview/`の出荷経路除外の保証（本番ビルド・配信ルートに
含まれないことの技術的保証）は**未着手**——現状`App.tsx`が`DesignPreview`を直接描画しており、本番
エントリと同一経路になっている。加えてmeta/adr/0021により、**骨格（おおまかなコンポーネント構成）の
記述・保存・比較**が新たな developer宿題として発生した（改修ガバナンスの判定機構そのもの、優先度高）。
レンダリング画像の記録（人間向け・スクリーンショット機能の検証を含む）も宿題だが、機械判定を左右しない
ため非ブロッキング。

**続けて、designerフローの再現性検証を実施した**（2026-07-20）。過去の試行の記憶を持たない
designerに、既存ブリーフ・成果物・reconciliationを一切見せず、同じスコープ（空き確認／予約／自分の
予約・キャンセル）のブリーフを独立に書かせ（試行2）、同一モデル（`gemini-3-flash-preview`）
・同一伝送（`commission_design_api.py`によるAPI直叩き）で得た成果物を無改変で受け皿に配置し、
実プロジェクトで描画して試行1と比較した。

**再現したもの**: (a)独立に、承認済みの試行1と**同じ8節構成・同水準の密度**のブリーフが書けた（雛形
と役割定義が機能している）。designerは`package.json`と`src/components/ui/`を実際に確認して使える部品
を具体名で列挙する（幻覚抑制）ことも自発的に行った。(b)`commission_design_api.py`の**初回実地検証に
成功した**（442行・finishReason=STOP・エラーなし）。ADR-0021のPRで「実APIでの動作確認は未実施」と
されていた宿題が解消された。不足API指摘（会議室一覧・自分の予約一覧）は試行1のreconciliationと同じ
2本で一致しており、一貫性があった。

**再現しなかったもの（重要）**: **出力の骨格に分散がある**。試行1（承認済みの正）は「全部屋横断の
タイムライン（帯・一望）・予約者名の表示・開いた瞬間に見える」。試行2は「1部屋ずつのステップフロー
（部屋選択→日付→スロット一覧）・『予約済』のみで誰かは見えない・部屋を選ばないと他室が見えない」——
**人間が嫌っていた「部屋＋日付を指定して見る」構図に退行した**。描画は正常・機能もするが、水準は
試行1より明確に下。**差の要因も特定できた**: 試行1の最終ブリーフには人間由来の不満点4件（検索ゲート
不要・タイムライン可視化・誰が押さえているか・クリック予約）が「解決したい問題」として入っていたが、
独立したdesignerはこれを知り得ないため軽い2点しか書けず、退行した骨格を引いた。過去の実測では不満点
なしのフラットブリーフでもタイムラインに到達した回があり、**不満点が無くても当たりは引きうるが、
あると床が上がる（外れを引きにくくなる）**という関係が確認できた。

**人間の決定: 試行1を正とする**。試行2のブリーフ・成果物の実ファイルは**残さない**（他のFRと同様、
知見は記述で自己完結させる）。受け皿の`index.tsx`は試行1表示に戻してある。この知見はfriction-log
FR-004として記録し、
`meta/templates/design-brief.md`の「解決したい問題」節を「任意のままだが、人間由来の不満点が既にある
なら必ず記入することを推奨」する記述に改訂した。

design.md・ARCHITECTURE.md・実プロジェクトの実装コード（design-preview以外）はまだ無い。既存のRFE-A
モック（旧 design/mocks/rfe-a-availability-view/、静的HTML）は、designer新設・design integrator再定義・
shadcn選定・伝送方式訂正・成果物形式変更のいずれよりも前にarchitectが作成したもの。**現行の方式
（TSX＋src/design-preview/受け皿、meta/adr/0020でsuperseded）とは形式が異なり、かつBookingDesign.tsx
（試行1）がRFE-Aのスコープを包含する**ため、この静的モックのファイルはリポジトリから削除した（最終
成果物にならない暫定物のため。ADR-0004にも改訂ノートで記録）。

**続けて、パイプラインのコミット/マージ境界が2断面として正式化された**（meta/adr/0022、ドラフト・
人間承認待ち）。「断面①・骨格合意」（契約の形＋UIを持つプロジェクトでは画面デザインにも人間が合意した
時点。既存の「設計骨格」承認点に相乗り）と「断面②・実装合意」（動く・テスト済みの機能に人間が合意した
時点）にmainへのコミット/マージを揃える、という原則である。この境界は、受け入れシナリオ（`.feature`）
だけがCI上で実装と強く結びついている（govlintのL0が参照シナリオIDの定義を要求し、L4が定義済みシナリオ
の実装を要求する。projects/reservation-system/friction-log.md FR-014）という構造から導かれた。
**本プロジェクトへの適用として、断面①（契約形状・ADR・reconciliation・画面モック・design-preview受け
皿）の成果物は出揃った**——契約形状・ADR（0001〜0006）・reconciliationに加え、画面モック
（`BookingDesign.tsx`）とdesign-preview受け皿も、**design-preview隔離（出荷経路除外）を実装した上で
2026-07-23にmainへ載った（PR #9マージ）**。残るのは各project ADR（0001〜0006）の**正式承認（設計骨格
承認点。現状`status: 提案中`）**である。また、design-preview隔離の原則（受け皿≠本実装、本番ビルド・
配信ルートに含めない）が、meta/adr/0021の宿題扱いからADR-0022で正式な原則へ格上げされ、
**その初適用として#9で実装された**（別Viteエントリ・tsconfig除外・import境界lint。BookingDesign.tsxは無改変）。

**続けて、クロスプロジェクトの協調（consumer-driven契約・縦順序・越境の実行主体）が正式化された**
（meta/adr/0023、ドラフト・人間承認待ち）。`GET /rooms`（`reservation-system/adr/0007`）の起草は、
reservation-frontendの設計が初めてバックエンド契約を実際に駆動した実例（consumer-driven contract）
であり、この初の実連動から得られた学びを制度化するものである。要点: (1)UIの設計がバックエンド契約の
形を駆動してよい、(2)フロントは契約に対して作り・バック実装は独立トラックとする（プロジェクトを
またいでPRを交互に出さない）、(3)**旧「フロントが必要とする能力がバックエンド契約に無い場合の運用」
ルール（人間が転記）を更新**——AIは人間の決定なしに自動で越境編集しないというガードは維持しつつ、
人間が「バックに持ち込む」と決定（authorize）したらarchitectが直接バックエンド契約を起草してよい。
`GET /rooms`の起草自体が、この新しい経路の初適用である。**現状の正確な位置**: backend側は
`reservation-system/adr/0007`・API形状ドラフトがmain上にあるが人間承認は未完了、受け入れシナリオ・
実装は次スライス（独立トラック）として未着手。frontend側は自身の断面①（画面モック・design-preview
受け皿）がまだ未完のまま（上記の通り）。「フロント断面①がmainに載った」と言えるのは、consumer-driven
の交わり（契約の形の確定）の意味に限られ、frontend自身の断面①完成とは別である（meta/adr/0023の
「確認事項」参照）。

## 確定した主要な判断

- 設計パックはシンプルCRUDパック（フロントエンド向け翻訳）（ADR-0001、承認済み）
- `projects/reservation-frontend/` を独立プロジェクトとして新設する。`reservation-system` とは統合しない
  （ADR-0002、承認済み。統合の是非を人間が再検討した上での維持決定）
- **フロントが必要とする能力がバックエンド契約に無い場合の運用**（統合しない代わりの軽い調整ルール、
  meta/adr/0023で更新）: フロントエンド側でこのactiveContext.mdの「未解決の論点」に記録する。**AIは
  人間の決定なしに自動で越境編集しない**というガードは維持しつつ、人間が「バックに持ち込む」と決定
  （authorize）したら、**architectが直接バックエンド契約（API仕様・ADR）を起草してよい**（人間が
  物理的に転記する作業を担う必要はない）。`GET /rooms`（`reservation-system/adr/0007`）がこの経路の
  初適用（旧: backend側activeContextへの転記・優先度判断を人間が行う、というルールを精緻化した）
- 実装スタックはTypeScript + React + Vite（ADR-0003、承認済み）
- 画面モックは「設計骨格」承認点に相乗りする（ADR-0004、承認前。§1・§2の条文改訂は未着手）
- **設計フローは並行モデル**（meta/adr/0017）: architect（契約）とdesigner（design integrator）は、
  ユースケース整理後に並行して起こす。designerは契約のドラフト（承認前）も読んでよい。食い違いは
  突き合わせ（reconciliation）で契約凍結前に表面化させ、人間が裁定する。人間は契約とモックをまとめて
  承認する
- **視覚の土台としてshadcn/ui（Radix UI + Tailwind CSS）を採用**（ADR-0005、承認前）
- **designer役は「design integrator」**（meta/adr/0018）: UI/UXを自ら発案せず、(a)デザインブリーフ
  作成 → (b)外部AI実行 → (c)reconciliation → (d)仕上げ、を担う。model: opusは維持（architectの判断）
- **(a)ブリーフは的を絞る（「リッチ＝網羅」ではない）**（meta/adr/0020）: 目的・対象ユースケース・
  ドメインルール（最小限）・現在のバックエンドAPI列挙（無いAPIは指摘してよい）・解決したい問題（任意）
  ・制約からの解放・技術前提・成果物の指定。エッジケース網羅・詳細API設計はarchitectの領分でありブリーフ
  に載せない
- **「解決したい問題」節は、人間由来の不満点が既にある場合は必ず記入することを推奨**（雛形改訂、
  friction-log FR-004、2026-07-20）: 外部AI単発実行には出力骨格の分散が本質的にあり、同水準の
  ブリーフでも骨格が「全体を一望できるタイムライン」から「人間が嫌っていたステップフロー」へ退行し
  うることが再現性検証で実測された。不満点の明記は退行を防ぐ床を上げる（外れを引きにくくする）が、
  必須ではない（不満点が無くても実用水準に到達した実測もある）
- **(b)外部AI実行の伝送方式はGenerative Language APIの直接呼び出し**（meta/adr/0020。旧: Gemini CLI
  ヘッドレス実行=誤りだったため訂正。FR-003）。エージェント型CLIは使わない。人間-in-the-loopは代替として
  残る
- **(b)外部AI実行の実行主体はorchestrator**（meta/adr/0021、ドラフト・人間承認待ち）: designerは実行
  手段（Bash等）を持たないため、実行はorchestratorに依頼する（ブリーフのパス・モデル名・出力先を渡す）。
  orchestratorは`commission_design_api.py`を実行し、成果物を無改変でdesignerに返す
- **(d)成果物の形式は実プロジェクトの受け皿で無改変描画するshadcn/uiベースのTSX**（meta/adr/0020。旧:
  自己完結の静的HTML/CSS）。受け皿: `src/design-preview/`（構築済み）。**agentは成果物を手で静的HTML等
  に書き直してレビューしてはならない**（meta/adr/0020。実際に行い「ダサい」と指摘された事例あり）。
  この無改変原則は**人間レビュー前**に適用される（meta/adr/0021）
- **外部AI成果物の改修ガバナンス（人間レビュー後）**（meta/adr/0021、ドラフト・人間承認待ち）: 改修は
  必ず発生する前提とし、無改変を維持し続けることを目的にしない。改修はタタキ（外部AIが返したTSX）の
  調整として行い、**1から作り直さない**。劣化検知の基準線は**おおまかなコンポーネント構成（骨格）**
  であり、レンダリング画像のピクセル比較ではない。操作感・細かいUI・architectとの齟齬解消は骨格を保つ
  限り自由に洗練してよい。**骨格を変える改修は劣化・作り直しの兆候として人間承認を要する**。レンダリング
  画像は人間がbefore/afterを見比べるための記録に格下げする（機械判定には使わない）。「UIの劣化」の最終
  判定は人間の目視
- **designerフロー(a)(b)は再現性検証済み**（2026-07-20、FR-004）: 過去の記憶を持たないdesignerでも
  同水準のブリーフは独立に書けるが、骨格の分散は避けられない。承認水準への到達は「同じ手順を踏めば
  毎回保証される」ものではなく、「解決したい問題」節の充実度が床を上げる主要な梃子である
- 無料枠の運用規約（meta/adr/0019・0020）: ブリーフに個人情報・機密情報を書かない／実案件は有料枠・
  Vertex AIへ切替／Pro系モデルは無料枠では使えない／gemini-2.5-flashは新規提供終了／gemini-3.5-flash
  は20回/日・ローリング24時間でリセット／**gemini-3.1-flash-liteが日常運用の現実解**
- **escape hatchの読み替え**（meta/adr/0018・0020）: 外部AIの発案が実用水準に届かない場合の第一の代案
  は「(i)ブリーフ改訂／(ii)別の外部ツール・外部AIへの切替」。旧代案（既製UIテンプレート採用・視覚の
  野心を下げる）は最終手段として残る。反復回数N・優先順位は引き続き未定（ADR-0004 §6）
- **認証方針は「案B（無認証・情報を絞る）」を当面採用**（`reservation-frontend/adr/0006`、承認済み・
  2026-07-21）: 予約者名は画面に表示しない・「自分の予約」は端末ローカル管理・占有情報API新設と
  `reservation-system/adr/0006`（空き枠のみ返す設計）の再検討は不要。**案C（軽量認証）は将来オプション
  として残す**（採用時は新しいスライスの契約とADRとして扱う）。`reservation-system`側の既存ADR
  （0003・0005・0006）はいずれも無変更
- **パイプラインのコミット/マージは「断面①骨格合意」「断面②実装合意」の2断面**（meta/adr/0022、
  ドラフト・人間承認待ち）: 断面①（契約の形＋UIプロジェクトでは画面デザイン）は既存の「設計骨格」
  承認点に相乗り、断面②（動く・テスト済み機能）は既存の実装承認点に対応する新しい承認段階ではない。
  本プロジェクトはUIを持つため、断面①には画面モック・design-preview受け皿が伴う（非UIプロジェクトの
  reservation-systemでは伴わない）。design-preview隔離（本番出荷経路から分離）は本ADRで原則に格上げ
  された
- **クロスプロジェクトの協調（consumer-driven契約・縦順序・越境の実行主体）を正式化**（meta/adr/0023、
  ドラフト・人間承認待ち）: `GET /rooms`の実連動から得た学びを制度化。(1)UIの設計がバックエンド契約の
  形を駆動してよい（consumer-driven）、(2)フロントは契約に対して作りバック実装は独立トラック（両者が
  交わるのは契約とE2E結合の2点のみ、プロジェクトをまたいでPRを交互に出さない）、(3)越境は人間の
  authorizeを経てarchitectが直接起草してよい（旧「人間が転記」ルールの更新）、の3点。既存ADR
  （0002非統合・0022の2断面・0017の並行モデル・PRINCIPLES.md P-02の縦切り）とは直交・補完であり
  上書きしない

## 進行中 / 次にやること

> **（2026-07-28セッション終了時点の最優先事項。上から順に）**
>
> **0-a. PR #26（実API接続・ADR-0009）がマージ待ち**。CI全緑（L0/L1/L4）。マージすれば初のフロント⇄
>   バック結合がmainに載る。
>
> **0-b. 次スライス最有力: `GET /rooms/{roomId}/availability`の実接続**。FR-007が示した通り、これを
>   繋がないと実API経路の画面が機能しない（roomIdの名前空間分断）。バックエンド側は実装済み（RSV-A、
>   L0–L4緑）なので**フロント側の作業のみ**。ADR-0009決定6の条件(b)に該当するため、**結合の回帰ゲートの
>   設計も同時に必要**——`meta/adr/0026`のCI分割（`govlint.yml`＝共有／`ci-<project>.yml`＝自プロジェクト
>   配下のみ）は結合テストの置き場を定義しておらず、両プロジェクトのpathsで起動する第3のワークフロー
>   （例`ci-integration.yml`）が要る。**この穴を埋めるにはmeta層の追補（ADR）が必要**。
>
> **0-c. RFE-C（自分の予約一覧＋キャンセル）が未実装**。承認済みモック`BookingDesign.tsx`はSheetでの
>   一覧＋キャンセル（開始15分前まで）を持ち、バックにも`POST /reservations/{id}/cancel`（RSV-K）が
>   実装済み。**フロントだけが無い**。案B（ADR-0006）により一覧はlocalStorageで持つ設計。
>
> **0-d. step実装の人間承認をRSV-Lスライスで飛ばした（規程違反）**。`meta/permissions.md`の4承認
>   ポイントの1つ「step実装」について、reviewerを起動せず対訳表も作らずマージした（人間の問い
>   「step実装の承認っているんだっけ？」で2026-07-28に発覚）。**承認対象を絞る制度変更は検討したが
>   人間判断で見送り、現行規程のまま運用する**。次スライスからreviewerを回す。RSV-L分の後追い監査の
>   要否は未定。
>
> **0-e. 依存の脆弱性警告**: `npm install`時にmoderate 2件・high 1件。今回の変更で増えたものではない
>   既存分。`npm audit`での棚卸しは未実施。
>
> **0-f. 別エージェントのブランチ`origin/meta/adr-0025-antigravity-integration`を放置中**（人間の
>   指示）。mainの`meta/adr/0025`（SSoT一元化）と**採番が衝突**しており、そのままではgovlint（L0必須）
>   がid重複ERRORで落ちてマージできない。解消するなら後発側を`0028`へ繰り下げる（`meta/adr/0026`
>   決定4の定め。0027まで使用済み）。**本セッションでは触っていない**。

1. meta/adr/0017〜0020（designer役新設・design integrator再定義・伝送方式訂正・成果物形式変更）—
   **メタ承認・マージ済み。対応不要**。meta/adr/0021（(b)実行主体の明確化・改修ガバナンス）・
   meta/adr/0022（コミット/マージの2断面・design-preview隔離原則の格上げ）・meta/adr/0023
   （クロスプロジェクトの協調の正式化）は**ドラフト・人間承認待ち**
2. ADR-0004（画面モックを設計骨格の承認に含める）の人間承認。**§1・§2の正式な条文改訂（静的HTML/CSS
   方式→TSX＋受け皿方式への全面書き換え）が未着手**であり、承認前に片付けるか、承認後の別作業とするか
   は人間判断
3. ADR-0005（視覚の土台としてshadcn/uiを採用）の人間承認
4. **developer宿題（状況更新）**:
   - `meta/tools/commission_design_api.py`（Generative Language API直叩き）は**実装・smokeテスト
     （24件・ネットワーク不使用）・CI接続まで完了済み**。**実APIでの初回実地検証も完了した**
     （2026-07-20、再現性検証の中で442行の成果物を実際に取得・finishReason=STOP・エラーなし。
     ADR-0021のPRが「実APIでの動作確認は未実施」としていた宿題はこれで解消）
   - `src/design-preview/`が本番の配信ルート・ビルドに含まれないことを保証する具体的な仕組み（別entry・
     ビルド設定・import境界lint等）は**未着手**（現状`App.tsx`が`DesignPreview`を直接描画しており、
     本番エントリと同一経路）。**meta/adr/0022により、この除外の完了が「断面①（骨格合意）を完成させ、
     画面モック＋design-preview受け皿をmainに載せる」ための前提条件として明確化された**
   - **（新規・meta/adr/0021）骨格（おおまかなコンポーネント構成）の記述・保存・比較の実現**: 改修
     ガバナンスの判定機構そのもの。優先度高
   - **（新規・非ブロッキング・meta/adr/0021）レンダリング画像の記録（人間向けbefore/after資料）の
     取得・保存**: スクリーンショット機能の実現可能性検証を含む。動作しなくても骨格比較による改修
     ガバナンスは機能する
5. **reconciliationの残未決（2件のみ。認証方針は決定済みのため縮小した）**（`design/reconciliation/
   booking-design-reconciliation.md`）: (1)`GET /rooms`の採否（→下記13の通り決定・ドラフト済み、
   backend側の人間承認が残る）、(2)`PATCH /reservations/{id}`の要否。他の不整合はいずれも設計調整・
   実装時対応で足りると分類済み
6. **「案Bが要求する設計調整」の実施**（`design/reconciliation/booking-design-reconciliation.md`
   9節、4項目）: 予約者名の除去・自分の予約のlocalstorage化・時間調整案内文の除去・タイムラインの
   空き/不可二値表現化。骨格を変えない範囲の洗練として、次のdesigner洗練サイクルまたはdeveloper実装
   統合時に反映する
7. RFE-A契約（`contracts/availability-view.feature`）の人間承認。reconciliationの内容次第で、スライス
   構成自体の見直し（RFE-A以外の新スライス追加等）が要るかは未定
8. RFE-A（空き状況画面）の扱い: 旧 design/mocks/ の静的モックは削除済み。RFE-Aのスコープは
   BookingDesign.tsxが包含するため、専用の作り直しは不要の見込み。RFE-A契約の承認・
   reconciliation結果を踏まえ、BookingDesign.tsxの洗練で対応するかを上記5の人間判断を経て決める
9. refinementループの反復回数N・escape hatchの優先順位の具体化（ADR-0004 §6、引き続き未定）
10. contracts/availability-view.feature（スライスRFE-A）の人間承認（項目7と同一）
11. Playwright/L4-L5（VRT）の整備方針（提案済み。今回変更なし）に沿って、developer/testerが着手
    （**フロント実装は保留中**、designerの作りこみ優先のため着手時期は未定）
12. 上記が揃い次第、design.md・ARCHITECTURE.mdを新規作成（architect）
13. **（更新・2026-07-27）`GET /rooms`（RSV-L）のAPI形状はbackend側で人間承認済み**
    （`reservation-system/contracts/reservation-api.yaml`、承認済み: 2026-07-27）。フロント側は
    このSSoTからdeveloperが型を生成する形に切替済み（本ファイル冒頭「今どこにいるか」参照。ADR-0008
    決定5＝生成の初適用）。受け入れシナリオ・実バックエンド実装はreservation-system側の独立トラック
    として別途進む（meta/adr/0023）
14. **（新規）meta/adr/0022の人間承認**。承認されれば、断面①（本プロジェクトでは契約形状・ADR・
    reconciliation・画面モック・design-preview受け皿）を完成させてからmainにコミット/マージする、
    という運用を以後のスライスに適用する
15. **（新規）meta/adr/0023の人間承認**。承認されれば、クロスプロジェクトの協調（consumer-driven契約・
    縦順序・越境の実行主体）がテンプレートの正式な運用規約になる。承認前でも、本ADRが記す新ルール
    （人間authorize→architect直接起草）は`GET /rooms`の実例としてすでに機能している

## 未解決の論点

- 利用者像: 想定利用環境（社内PC・共有端末・会議室前のキオスク等）、想定利用者範囲が未確認
- デザイン要件: 既存の社内デザインシステム・ブランドガイドラインの有無が未確認。shadcn/ui採用（ADR-0005）
  は組織側に既存ブランド制約が無いことを前提にしており、制約が判明した場合は再検討が要る
- 想定スタックの制約: 組織として既存のフロントエンド標準スタックの指定が無いことを前提にADR-0003を
  ドラフトした。指定がある場合はADR-0003の再検討が要る
- **（解決済み・2026-07-27）`GET /rooms`（会議室一覧）の採否**: 人間が採用を決定し
  （consumer-driven contract）、`reservation-system/adr/0007`・API形状は人間承認済み
  （`reservation-api.yaml`、承認済み: 2026-07-27）。フロント側もADR-0008決定5（生成方式）に
  沿って型導出を完了した（本ファイル冒頭参照）。この越境の経路自体はmeta/adr/0023として
  正式化された（ドラフト・人間承認待ち）
- **`PATCH /reservations/{id}`（予約時間の変更）の要否**: 設計内でも未実装（案内文のみ先行）。機能
  自体を追加するか、案内文を実態に合わせて修正するかの方針は未定（後者は既に設計調整として実施方針が
  確定している。前者=機能追加の要否のみ未決）
- **（解決済み・2026-07-21）認証の有無**: `reservation-frontend/adr/0006`により、**案B（無認証・情報を
  絞る）を当面採用、案C（軽量認証）は将来オプション**と決定した。これに伴い、reconciliationが挙げて
  いた新規API4件のうち2件（`GET /reservations?date=`・`GET /reservations?reserverId=`）とフィールド
  `reserverName`の契約化は不採用が確定し、`reservation-system/adr/0006`の再検討も不要になった
- **（解決済みに伴い縮小）BookingDesign.tsxのreconciliationで判明した論点**（詳細は
  `design/reconciliation/booking-design-reconciliation.md`）: 22件のうち6件が上記決定で解決済み。
  残る未決は`GET /rooms`・`PATCH /reservations/{id}`の2件のみ（重複するため上記2項目を参照）。他の
  16件（うち14件）は[設計調整で足りる][実装時に直す]に分類済みで、骨格を保った洗練・実装統合の中で
  対応する（一覧はreconciliation本体を参照）
- L5（体験の質）の人間承認が、permissions.mdの「人間の承認ポイント」表（契約／設計骨格／step実装／
  信条規程の4接点）に明記されていない非対称を発見した。小さなA層整備候補として記録するのみで、対応の
  要否・優先度は未定（meta変更のため人間判断）
- **ADR-0004 §1・§2の条文改訂（未着手）**: meta/adr/0020による成果物形式の変更（静的HTML/CSS→
  TSX＋受け皿）を、ADR-0004の条文そのものに正式反映していない（現状は改訂ノートでの読み替えのみ）。
  `src/design-preview/`の出荷経路除外の保証方法（developer宿題）が固まってから着手する想定だが、順序・
  タイミングは人間判断。**meta/adr/0021の骨格記録・記録用画像の置き場所も、この条文改訂で定める必要が
  ある**（本ADRでは決定しない）
- RFE-Aの静的モックの扱い: 旧 design/mocks/rfe-a-availability-view/ の3状態HTMLは、現行の成果物形式
  （TSX＋src/design-preview/受け皿、meta/adr/0020）より前の形式であり、かつBookingDesign.tsxがRFE-A
  スコープを包含するため、リポジトリから削除した。RFE-Aを独立に扱う必要が生じた場合の進め方
  （BookingDesign.tsxの洗練か新規か）は未定
- developer.mdの拘束が未整備: meta/adr/0017・0018の帰結で明記した通り、developer.md（各プロジェクト
  共通のA層役割規程）は「承認済みモックに忠実に実装する」という拘束を明示的には持たない（meta/agents.md
  4節の標準フローには明記した。改修ガバナンス（骨格保持・骨格変更は人間承認）も同節に追記済み）。実務上
  の齟齬が出たらfriction-logを経て提案する
- refinementループの反復回数N・escape hatchの優先順位: meta/adr/0017・0018・0020が原則のみを定め、
  プロジェクト側の具体化（ADR-0004 §6）は未定のまま
- designerのmodel: opus維持はarchitectの判断（meta/adr/0018）。人間が別途モデル選定を確定させたい
  場合は差し戻し可能
- **`src/design-preview/`の出荷経路除外の保証方法**: design-previewが本番の配信ルート・ビルドに含まれ
  ないことを、具体的にどう保証するか（別entry・ビルド設定・import境界lint等）はdeveloper宿題として
  切り出したが、未実装。実装されるまでは運用上の注意（実アプリのルートから参照しない）のみで担保している。
  **meta/adr/0022により、この宿題の完了が断面①（骨格合意）を完成させmainに載せるための前提条件になった**
- **（新規）meta/adr/0021 §2.4の解釈確認**: 「architectが行いうる構造に合わせた調整は、design.mdの
  構造記述の更新・コンポーネント分割方針の指示等、architectの既存の権限内に限る。実際のTSXへの変更が
  要るならdeveloperが行う」という整理はarchitectの判断であり、ADR本文が「人間に確認されたい」と明記
  している。人間の確認待ち
- **（新規）骨格（おおまかなコンポーネント構成）の記述形式**: meta/adr/0021は「コンポーネント名・親子
  関係を列挙したマニフェスト形式」を例示するのみで、具体的な形式・保存場所はdeveloperの実装判断に
  委ねている。BookingDesign.tsxは現状単一ファイル（複数コンポーネントに分割されていない）ため、
  「主要なUIブロック」単位での記述になる見込み
- **（新規）designerフロー(a)(b)の再現性は「手順を踏めば毎回保証される」ものではないことが判明した**
  （2026-07-20、FR-004）。承認水準は「(a)(b)を1回通せば得られる」のではなく、ブリーフの「解決したい
  問題」節の充実度に依存する部分が大きい。今後、人間由来の不満点が乏しい新スライスのブリーフを書く
  局面で、どの程度の反復・人間レビューを挟むか（既存の未定論点「refinementループの反復回数N」と直結）
  の具体化がより重要になる
- **（新規）meta/adr/0022の人間承認待ち**: パイプラインのコミット/マージを断面①（骨格合意）・断面②
  （実装合意）の2断面に正式化するADR。**その初適用として、本プロジェクトの断面①成果物（契約形状・ADR・
  reconciliation・画面モック・design-preview受け皿）が#9マージで出揃った**（design-preview隔離を実装済み。
  2026-07-23）。残るのは各project ADRの正式承認（設計骨格承認点）
- **（新規）meta/adr/0023の人間承認待ち**: クロスプロジェクトの協調（consumer-driven契約・縦順序・
  越境の実行主体）を正式化するADR。`GET /rooms`の実連動が初適用として本ADRの帰結に記録されている。
  承認後は、旧「人間が転記」ルールが正式に「人間authorize→architect直接起草」に置き換わる（本
  activeContextの記述は先行して更新済み）

## 直近のfriction

- FR-001（designerの内部AI発案が2回にわたり実用水準に届かなかった。押し込み先: meta/adr/0018）。
  対応済み
- FR-002（狭いブリーフが凡庸な外部AI設計を生んだ。押し込み先: meta/adr/0019）。対応済み
- FR-003（ADR-0019のCLI伝送方式が誤りで、設計でなく実装計画を返した。押し込み先: meta/adr/0020）。
  対応済み
- FR-004（独立作成した同水準ブリーフでも外部AI単発実行の出力骨格に分散があり、承認水準への到達は
  保証されない。押し込み先: meta/templates/design-brief.md「解決したい問題」節の推奨強化）。対応済み
