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
- 0043 契約の承認記録もPR1本で閉じる ／ 0044 Codexの検証を弱めず冗長作業を減らす（Codex） ／ 0045 契約だけを先にmainへ載せられるようにする（`@pending-implementation`）

**未対応の宿題（open のものだけ。完了した判断は上に畳んだ）**:

*人間の判断待ち*
- **FR-022: orchestratorが検証インフラを自分で直す違反が4回目**。`meta/agents.md` §6 が明文で禁じているのに ADR-0038・0043 で govlint を自分で書いた。cause_key `orchestrator-as-substantive-source` は通算4回（FR-006/009/008/022）。**明文の禁止が4回破られた以上、規程への書き足しでは直らない**。構造で止める候補は (a) orchestratorのツール権限から `meta/tools/**`・`build.gradle` の Edit/Write を deny（ADR-0040で権限機構の実効性は実測済み）、(b) PRテンプレの関所に載せる。**設計自体が規程変更なので人間判断が要る**
- **RFE-A・RFE-B の契約が未承認のまま実装が載っている**。RFE-B は契約と実装が同一コミット（`f1dac2a`）だが、これは規律違反ではなく**当時は機械的に契約先行が不可能だった**（ADR-0045で解消）。ADR-0043 は遡って承認せず govlint のREPORTで可視化し続ける方針。**未承認の契約に対する実装を止める機械的な仕組みは無い**（PRテンプレのチェックは自己申告）
- **RSV-L の監査が未実施**（`reviews/audit-rsv-l.md` が存在しない）。RSV-Tの監査でreviewerが独立に再発見した。`activeContext` に記録済みの規程違反（4承認点の1つを飛ばした）と一致
- ~~提案中ADRの滞留~~ **解消（2026-08-03）**。meta 7本（0022〜0027・0030）を個別判断のうえ承認した。承認の根拠は「読んで納得した」ではなく**6スライスの実運用で決定どおりに回りきったこと**（ADR-0035決定3が禁じる「読まずに一括承認」との違いはここ）。残る提案中は `reservation-frontend/adr/0004`・`0005` の2本のみで、**これは意図した保留**——つまり `提案中` という状態が「まだ決めていない」の意味を取り戻した（ADR-0035が狙った状態）

*機械で塞げていない穴*
- **`Bash` の deny が prefix 一致で回避できる**: `Bash(git reset --hard*)` は `git reset -q --hard` を止められない（実測）。ADR-0040 は `Read`/`Edit`/`Write` のみ扱い、`Bash` は引数の組み合わせが爆発するため別途設計が要る
- **govlint の cause_key 再出現検出が friction-log ファイル単位**: プロジェクトを跨いだ再出現を検出できない。`orchestrator-as-substantive-source` は実質4回だが機械はファイルごとにしか数えない
- **採番衝突が2回**（FR-023）: 1回目（ADR-0037）は規程を守っても防げない競合、2回目（ADR-0044）は**ADR-0026を守らなかった**（0045へ振り直して解消）。FRの採番にはADR-0026相当の規定がそもそも無い。**ただしgovlintは2回とも昇格前に捕まえており main は汚れていない**——強制する仕組みを足すか検出で足りると割り切るかは費用対効果の判断

*実装待ち（P-05: 要るようになってから）*
- **結合CI `ci-integration.yml` は未実装**（ADR-0031が置き場だけ定義）。`meta/guardrails.md` §2「CI構成」への反映は実ファイルを作る実装スライスとセットで行う
- **reservation-system の activeContext スリム化**（2階層モデルへ・ADR-0033/0034）: `project/reservation-system` は作成済みなので、次に同プロジェクトを触るときに実施できる

*留意事項（宿題ではないが忘れると事故る）*
- **シナリオIDのプレフィックスはリポジトリ全体で一意**（ADR-0038決定3）。新プロジェクト追加時に重複を避ける。使用中: RFE-A/B/C・RSV-A/C/K/L/R/T・TDR（Codex予約）
- **権限機構の性質（ADR-0040で実測・確定）**: deny は allow で上書きできず、除外構文（`!`）も無い。設定変更はセッション中に反映される。**再検証は不要**

## 全プロジェクトの一覧・状態

| プロジェクト | 担当 | 状態 | 詳細 |
|---|---|---|---|
| reservation-system（会議室予約バックエンド） | Claude | 垂直スライス**6本**（RSV-C/K/A/R/L/**T**）完了・main。RSV-Tで `POST /rooms`（会議室登録）を追加し、**通常プロファイルでもループが成立**するようになった。`project/reservation-system` 作成済み。**新規作業なし** | `projects/reservation-system/activeContext.md` |
| reservation-frontend（会議室予約フロント） | Claude | RFE-A/B/C 実装済み。**4本すべて（rooms・availability・予約作成・キャンセル）が実API opt-in**。走破で実バックエンドとの通しの動作を確認済み。**新規作業なし**。宿題: 骨格記録（adr/0021）・ADR-0004/0005承認・**RFE-A/Bの契約が未承認**（下記） | `projects/reservation-frontend/activeContext.md` |
| toyama-weekend-radar | Codex | 休止。foundationは`project/toyama-weekend-radar`に保持し、Dining Radarへ注力する | 同ブランチ上のactiveContext |
| toyama-dining-radar | Codex | 統合ブランチと保護ruleset作成済み。富山県庁周辺の月例ランチ会向け店舗提案のfoundation開始待ち | foundationスライスで`projects/toyama-dining-radar/activeContext.md`を配置 |

## クロスプロジェクトの協調状態

**reservation-frontend ⇄ reservation-system**:
- **consumer-driven契約**（meta/adr/0023）: フロントの設計がバックエンド契約の形を駆動してよい。両者が交わるのは「契約の形」と「E2E結合」の2点のみ。契約のSSoTは `projects/reservation-system/contracts/reservation-api.yaml`（meta/adr/0025）。フロントは型をここから生成する（reservation-frontend/adr/0008）。
- **実バックエンド接続**: `GET /rooms`（reservation-frontend/adr/0009、rooms実接続）と `GET /rooms/{roomId}/availability`（PR #35、2本目=決定6(b)）が接続済み。方式: Vite dev server proxyの `/rooms` ルール（前方一致でavailabilityもカバー）で同一オリジンに見せ、**バックエンドは無変更＝CORSを足さない＝越境なし**。各APIは環境変数で独立にopt-in（`VITE_USE_REAL_ROOMS_API`・`VITE_USE_REAL_AVAILABILITY_API`）、既定はモック。
- **結合の検証ゲート（meta/adr/0032）**: 形の互換性はSSoT yaml経由で両側が別々に機械ゲート済み。配線は軽量単体テスト（`liveWiring.test.ts`）で機械ゲート。走破は安定ゲートにしない。end-to-endの実スタック機械検証が要る時は `ci-integration.yml`（testcontainers、meta/adr/0031の置き場）を足す（未実装、P-05）。
