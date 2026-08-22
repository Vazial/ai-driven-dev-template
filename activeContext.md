# activeContext.md（ルート） — テンプレ管理・全プロジェクト・クロスプロジェクト

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 役割（meta/adr/0033）: テンプレ自身の方法論の現在／全プロジェクトの一覧・状態／プロジェクト間の協調状態を持つ。
> **クロスプロジェクトの状態はこのファイルが唯一の所有者**。プロジェクト内部の状態は各 `projects/<p>/activeContext.md` が持つ（跨り事実は複製せずここを参照する）。
## テンプレ管理の現在

AI駆動開発のメタテンプレート。正しさを機械検証（L0〜L5）に置き、人間承認を4点（契約／設計骨格／step実装／規程変更）に集約する。ClaudeとCodexが同一リポジトリを並行開発する（meta/adr/0036、`meta/agent-runtime-mapping.md`）。

**ブランチ運用（meta/adr/0028、承認済み）**: `main`＝リリース可能。`project/<project>`＝各プロジェクトの長期統合ブランチ。スライスは `project/<project>` から `<type>/<project>-<slice>` を切りPRで戻す。`project/<project>` の作成＋保護rulesetは**AIが `gh` の admin権限で自動作成**する（人間はchatでauthorize＋結果確認）。`meta/**` の共有ガバナンス変更は例外的に base=main（ADR-0026直列化）。

**確定したメタ判断（ADR。詳細は各ADR本体。ここでは1行に留める）**:
- 0022 コミット/マージを骨格合意と実装合意の2断面に分ける ／ 0023 クロスプロジェクトはconsumer-driven契約で協調する ／ 0024 control surfaceを契約に明示し断面②に走破を加える ／ 0025 契約のSSoTは提供側の1ファイル ／ 0026 複数プロジェクトの並行開発（CI分割・ブランチ命名・IDプレフィックス台帳・`meta/**`直列化） ／ 0027 緑CI以外の独立した根拠なしにagent成果物を通さない ／ 0030 CodexはPR前にチャットでスコープ合意する（Codex）
- 0031 結合CIの置き場 `ci-integration.yml` ／ 0032 配線・結合は機械検証し走破は探索と意味理解に限る ／ 0033 activeContext 2階層 ／ 0034 activeContext更新をマージゲートに載せaccretionを禁じる
- 0035 ADRの承認記録をPR1本で閉じる（方式(i)/(ii)＋提案中の棚卸しREPORT） ／ 0036 `.claude/agents` を役割定義のSSoT（Codex） ／ 0037 CodexのホストCLI確認手順（Codex） ／ 0038 シナリオID検査の3欠陥（ASCII境界・定義形式・全体名前空間）
- 0039 orchestratorと役割の境界（検証の申告／技法を指定しない／reviewerは緑後） ／ 0040 機密ガードレールの守備範囲（Write対称化・gitignore・`env.example`） ／ 0041 PR種別ごとの承認事項 ／ 0042 デプロイは当面着手しない
- 0043 契約の承認記録もPR1本で閉じる ／ 0044 Codexの検証を弱めず冗長作業を減らす（Codex） ／ 0045 契約だけを先にmainへ載せられるようにする（`@pending-implementation`） ／ 0046 検証ツール（govlint・build.gradle）をゲートとして施錠し、開錠は人間・施錠の確認は機械 ／ 0047 メタADRの起草はorchestratorの領分（architectはプロジェクトscopeのADR）
- 0048 Codexはdeveloper/testerをLunaへ割り当て、architect/reviewerはTerra、designerはSolを維持する
- 0051 人間に判断を仰ぐときは「決めること・選択肢・トレードオフ・推奨」を揃えて出す（`meta/permissions.md` §2。エスカレーション§3はその特殊例。意図の聞き取り・事実の確認・AIが決めてよいことは適用外）

**未対応の宿題（open のものだけ。完了した判断は上に畳んだ）**:

*人間の判断待ち*
- ~~FR-022: orchestratorが検証インフラを自分で直す違反が4回目~~ **対応済み（2026-08-03、ADR-0046）**。`meta/tools/**`・`build.gradle*` を deny で施錠し、開錠は人間のコミット、**施錠されていることを govlint が ERROR で検証**する（開錠したままマージできない）。あわせて `meta/permissions.md` の段差（検証ツール本体をゲートでなく実装として扱っていた行）を正した。**再発可能性は消えていない**——決定5の限界（`Bash` の抜け道／deny は Claude Code のみで Codex には届かない）を承知のうえで「うっかりだけ止まれば足りる」と判断している
- **RFE-A・RFE-B の契約が未承認のまま実装が載っている**。RFE-B は契約と実装が同一コミット（`f1dac2a`）だが、これは規律違反ではなく**当時は機械的に契約先行が不可能だった**（ADR-0045で解消）。ADR-0043 は遡って承認せず govlint のREPORTで可視化し続ける方針。**未承認の契約に対する実装を止める機械的な仕組みは無い**（PRテンプレのチェックは自己申告）
- **RSV-L の監査が未実施**（`reviews/audit-rsv-l.md` が存在しない）。RSV-Tの監査でreviewerが独立に再発見した。`activeContext` に記録済みの規程違反（4承認点の1つを飛ばした）と一致
- ~~提案中ADRの滞留~~ **解消（2026-08-03）**。meta 7本（0022〜0027・0030）を個別判断のうえ承認した。承認の根拠は「読んで納得した」ではなく**6スライスの実運用で決定どおりに回りきったこと**（ADR-0035決定3が禁じる「読まずに一括承認」との違いはここ）。残る提案中は `reservation-frontend/adr/0004`・`0005`・`dining-radar/adr/0018`（cache・永続provider IDの採用可否。provider規約の再確認と人間の意思決定が要る）の3本のみで、**いずれも意図した保留**——つまり `提案中` という状態が「まだ決めていない」の意味を取り戻した（ADR-0035が狙った状態）
- **`toyama-dining-radar` の改名（2026-08-20、`projects/dining-radar/adr/0026`）は、公開リポジトリから地域の露出を消しきっていない**。改名時に人間が「TDR側の地名だけ落とす」と範囲を選んだため、残っているのは次の3つ——(a) `toyama-weekend-radar`（Codex担当・休止。名前が `activeContext`・`meta/adr/0033`・`meta/guardrails.md` に、`meta/scenario-id-prefixes.md` の `TWR` 行には「**富山市近郊**の週末イベント提案」と平文で残る）、(b) `projects/connpass-session-radar/contracts/daily-digest-contract.yaml` の例示「富山県内の勉強会」（契約なので変更は人間の承認点）、(c) 過去コミットと、据え置いたブランチ名 `project/toyama-dining-radar`・ruleset名 `protect project/toyama-dining-radar`（いずれもADR-0026で意図的に残した）。**(a)は別プロジェクトの改名、(b)は別プロジェクトの契約変更**であり、どちらも人間の判断が要る

*機械で塞げていない穴*
- **`Bash` の deny が prefix 一致で回避できる**: `Bash(git reset --hard*)` は `git reset -q --hard` を止められない（実測）。ADR-0040 は `Read`/`Edit`/`Write` のみ扱い、`Bash` は引数の組み合わせが爆発するため別途設計が要る
- **meta層のfrictionを書く場所が無い**（2026-08-22、ADR-0051で再確認）: `friction-log.md` は `projects/<p>/` にしか存在せず、テンプレート自身の運用のブレ（今回は「人間に判断を仰ぐときの形がブレる」）はどのプロジェクトにも属さない。行き場のない摩擦はADR本文が肩代わりしている。P-05に従い、実際に困るまで置き場を作らない
- **govlint の cause_key 再出現検出が friction-log ファイル単位**: プロジェクトを跨いだ再出現を検出できない。`orchestrator-as-substantive-source` は実質4回だが機械はファイルごとにしか数えない
- **採番衝突が4回**（FR-023）: 1回目（ADR-0037）は規程を守っても防げない競合、2回目（ADR-0044）は**ADR-0026を守らなかった**（0045へ振り直して解消）、3回目は `meta/designer-adopts-design-skill` の 0048 が main の別セッションの 0048 とぶつかった（0050へ振り直し）、4回目は**その振り直し先の 0050 を別セッションがさらに取った**（2026-08-22、ask-humans側を0051へ振り直して解消）。FRの採番にはADR-0026相当の規定がそもそも無い。**govlintが昇格前に捕まえたのは1〜3回目まで**——4回目は衝突する2本が**どちらも未マージのブランチ**だったため、govlintは各ブランチ単体では緑を返し、セッション開始時に人が読んで気づいた。つまり検出は「片方がmainに載っていること」に依存しており、並行ブランチ同士の衝突はマージ順に賭けている——強制する仕組みを足すか検出で足りると割り切るかは費用対効果の判断

*実装待ち（P-05: 要るようになってから）*
- **結合CI `ci-integration.yml` は未実装**（ADR-0031が置き場だけ定義）。`meta/guardrails.md` §2「CI構成」への反映は実ファイルを作る実装スライスとセットで行う
- **reservation-system の activeContext スリム化**（2階層モデルへ・ADR-0033/0034）: `project/reservation-system` は作成済みなので、次に同プロジェクトを触るときに実施できる

*留意事項（宿題ではないが忘れると事故る）*
- **シナリオIDのプレフィックスはリポジトリ全体で一意**（ADR-0038決定3）。新プロジェクト追加時に重複を避ける。台帳のSSoTは `meta/scenario-id-prefixes.md`。使用中: RFE-A/B/C・RSV-A/C/K/L/R/T・TDR-AUTH/TDR-CS・TWR・**CSR**（connpass-session-radar、PR #100で予約済み）
- **権限機構の性質（ADR-0040・0046で実測・確定）**: deny は allow で上書きできず、除外構文（`!`）も無い。設定変更はセッション中に反映される。**deny はサブエージェントにも継承される**——つまりパスベースの deny で orchestrator と役割agentを区別することはできない（ADR-0046の設計はこの実測結果で組み替わった）。`Read` は deny の対象外。**再検証は不要**
- **`.claude/settings.json` は Claude Code の機構であり、Codex には効かない**。両runtimeに効くのは共有の必須ゲート（L0 govlint）だけである。runtime横断で効かせたい規律は、権限設定ではなく govlint に置くこと

## 全プロジェクトの一覧・状態

| プロジェクト | 担当 | 状態 | 詳細 |
|---|---|---|---|
| reservation-system（会議室予約バックエンド） | Claude | 垂直スライス**6本**（RSV-C/K/A/R/L/**T**）完了・main。RSV-Tで `POST /rooms`（会議室登録）を追加し、**通常プロファイルでもループが成立**するようになった。`project/reservation-system` 作成済み。**新規作業なし** | `projects/reservation-system/activeContext.md` |
| reservation-frontend（会議室予約フロント） | Claude | RFE-A/B/C 実装済み。**4本すべて（rooms・availability・予約作成・キャンセル）が実API opt-in**。走破で実バックエンドとの通しの動作を確認済み。**新規作業なし**。宿題: 骨格記録（adr/0021）・ADR-0004/0005承認・**RFE-A/Bの契約が未承認**（下記） | `projects/reservation-frontend/activeContext.md` |
| toyama-weekend-radar | Codex | 休止。foundationは`project/toyama-weekend-radar`に保持し、Dining Radarへ注力する | 同ブランチ上のactiveContext |
| connpass-session-radar（connpassの毎朝ダイジェスト通知） | **Claude**（2026-08-16にCodexの先行準備を引き継ぎ） | **断面①完了・2026-08-17に人間が契約とADR-0001を承認**（シナリオ `CSR-D-01`〜`10` は全て `@pending-implementation`）。実装は一行も無く、次はdeveloper/testerの並行作業に入れる。**方式(ii)（記録のみ・承認は後日）で起草したため PR #102 のマージは承認ではなく、承認はその後のchatで別途行った**。ユースケースは確定（探す手間をなくす／毎朝「今日の一覧」を配る／**状態を持たない**＝通知済みIDを永続化しない／条件はリポジトリ内のYAML／**UIを持たないためdesignerは登場しない**）。**通知先はLINEかSlackで未定**——難度比較のうえADRで選定する。connpass API v2の一次情報は取得済み（`openapi.json`を直接取得）で、**開催日の範囲指定が無い・除外語NOTが無い・1秒1リクエストでキーは1本**といった制約が契約を縛る。**APIキーは申請中**（2026-08-16時点、審査待ち。実測が要る項目は発行後）。Codexが先行して `project/connpass-session-radar` ブランチと `CSR` プレフィックス予約（PR #100）を用意済み | `projects/connpass-session-radar/activeContext.md` |
| dining-radar | **Claude**（2026-08-04にCodexから引き継ぎ） | **2026-08-20に `toyama-dining-radar` から改名**（`adr/0026`。公開リポジトリから実在の県名を外す。Pythonパッケージ `dining_radar` とシナリオIDプレフィックス `TDR` は据え置き）。TDR-AUTH・TDR-CSから**絞り込みモデルへの組み替え**（ADR-0023。`ConceptKind`を廃し、絞り込み＋固定の近い順＋近傍プールからの無作為抽出へ。product-brief §2の「決定的ルールだけで選ぶ」を人間判断で緩めた再承認点を含む）まで**mainにマージ済み**（PR #92まで）。**ADR-0020でUI検証ハーネスを新設**（描画観測ツール／UI規則の機械化／回帰ゲートの3層。L5をピクセル差分でなくDOM/幾何スナップショット比較として具体化し、meta/adr/0021・0024はsupersedeしない）。**無料公開構成を準備済み**（ADR-0021。Render Free + Neon Free。resourceも公開originも未作成で、外部accountの変更とsecret投入は人間の実施待ち）。L0〜L5全緑。宿題: Hot Pepperのフィールド名仮定が合成データ検証のみ／ADR-0003の受け皿スタック記述と実体の乖離／`project/toyama-dining-radar` ブランチ（**改名後も旧名のまま据え置き**。ruleset `protect project/toyama-dining-radar` も同様）がmainより大きく遅れ（refresh or retireの判断待ち）／**FR-017の押し下げ**（ADR本文の承認宣言とfrontmatterの`status`の照合をgovlintで機械化する案。`meta/tools/**`の開錠が要るため人間の判断待ち） | `projects/dining-radar/activeContext.md` |

## クロスプロジェクトの協調状態

**reservation-frontend ⇄ reservation-system**:
- **consumer-driven契約**（meta/adr/0023）: フロントの設計がバックエンド契約の形を駆動してよい。両者が交わるのは「契約の形」と「E2E結合」の2点のみ。契約のSSoTは `projects/reservation-system/contracts/reservation-api.yaml`（meta/adr/0025）。フロントは型をここから生成する（reservation-frontend/adr/0008）。
- **実バックエンド接続**: `GET /rooms`（reservation-frontend/adr/0009、rooms実接続）と `GET /rooms/{roomId}/availability`（PR #35、2本目=決定6(b)）が接続済み。方式: Vite dev server proxyの `/rooms` ルール（前方一致でavailabilityもカバー）で同一オリジンに見せ、**バックエンドは無変更＝CORSを足さない＝越境なし**。各APIは環境変数で独立にopt-in（`VITE_USE_REAL_ROOMS_API`・`VITE_USE_REAL_AVAILABILITY_API`）、既定はモック。
- **結合の検証ゲート（meta/adr/0032）**: 形の互換性はSSoT yaml経由で両側が別々に機械ゲート済み。配線は軽量単体テスト（`liveWiring.test.ts`）で機械ゲート。走破は安定ゲートにしない。end-to-endの実スタック機械検証が要る時は `ci-integration.yml`（testcontainers、meta/adr/0031の置き場）を足す（未実装、P-05）。
