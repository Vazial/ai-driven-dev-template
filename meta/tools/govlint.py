#!/usr/bin/env python3
"""govlint — 統治文書（ADR・friction-log・契約）の機械検証（meta/adr/0012）。

検証するもの:
  [ERROR] スキーマ妥当性       … 必須フィールドの有無・値の妥当性
  [ERROR] 参照整合             … supersedes/superseded_by/pushed_to の参照先が実在するか、supersede関係が対称か
  [ERROR] シナリオIDの整合     … .feature内でIDが一意か、API仕様が参照するIDが実在するか
  [REPORT] cause_keyの再出現   … 同一原因の2回目以降＝構造的欠陥のシグナル（人間が判断する。失敗させない）
  [REPORT] 未対応FRの棚卸し
  [REPORT] 提案中ADRの棚卸し   … status: 提案中 のまま滞留しているADR（meta/adr/0035）

終了コード: ERRORが1件でもあれば1、なければ0（REPORTは0のまま）。

依存なし（標準ライブラリのみ）。frontmatter/yamlブロックは本ツールが定める限定サブセットのみ扱う。
"""
from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

ADR_STATUSES = {"提案中", "承認済み", "superseded"}
FR_STATUSES = {"未対応", "対応済み"}
FR_FOUND_AT = {"L1", "L2", "L3", "L4", "L5", "人間", "AI"}

errors: list[str] = []
reports: list[str] = []


# ADR-0036: Role names are structural; model values are owned by the source
# frontmatter (.claude/agents) and the runtime mapping, never by this checker.
ROLE_NAMES = {"architect", "designer", "developer", "tester", "reviewer"}


# ---------------------------------------------------------------- yaml subset
def parse_block(text: str) -> dict:
    """key: value / key: [a, b] / key: null の限定サブセットを読む。"""
    out: dict = {}
    for line in text.split("\n"):
        line = line.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$", line)
        if not m:
            continue
        key, raw = m.group(1), m.group(2).strip()
        if raw in ("null", "~", ""):
            out[key] = None
        elif raw.startswith("[") and raw.endswith("]"):
            inner = raw[1:-1].strip()
            out[key] = [v.strip().strip('"').strip("'") for v in inner.split(",") if v.strip()]
        else:
            out[key] = raw.strip('"').strip("'")
    return out


def read_frontmatter(path: Path) -> dict | None:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---", 4)
    if end == -1:
        return None
    return parse_block(text[4:end])


# ---------------------------------------------------------------- role-agent SSOT (ADR-0036)
def check_role_agent_ssot() -> None:
    """Ensure role contracts have one Claude/Codex source and preserved models."""
    source_dir = ROOT / ".claude" / "agents"
    legacy_dir = ROOT / "meta" / "agents"
    mapping_path = ROOT / "meta" / "agent-runtime-mapping.md"

    if legacy_dir.is_dir():
        for path in sorted(legacy_dir.glob("*.md")):
            errors.append(
                f"{path.relative_to(ROOT).as_posix()}: ADR-0036で廃止された個別role定義が残っている"
            )

    source_roles = {path.stem for path in source_dir.glob("*.md")} if source_dir.is_dir() else set()
    expected_roles = ROLE_NAMES
    if source_roles != expected_roles:
        errors.append(
            ".claude/agents: role定義一式が不一致 "
            f"(expected={sorted(expected_roles)}, actual={sorted(source_roles)})"
        )

    source_frontmatter: dict[str, dict] = {}
    for role in ROLE_NAMES:
        path = source_dir / f"{role}.md"
        if not path.is_file():
            continue
        frontmatter = read_frontmatter(path)
        if frontmatter is None:
            errors.append(f"{path.relative_to(ROOT).as_posix()}: role定義のfrontmatterが無い")
            continue
        source_frontmatter[role] = frontmatter
        if frontmatter.get("name") != role:
            errors.append(
                f"{path.relative_to(ROOT).as_posix()}: name='{frontmatter.get('name')}' がrole '{role}' と一致しない"
            )
        if not frontmatter.get("model"):
            errors.append(f"{path.relative_to(ROOT).as_posix()}: Claude modelが無い")
        if not frontmatter.get("tools"):
            errors.append(f"{path.relative_to(ROOT).as_posix()}: tools境界が無い")

    if not mapping_path.is_file():
        errors.append("meta/agent-runtime-mapping.md: runtime対応表が無い")
        return
    mapping_rows: dict[str, tuple[str, str, str, str]] = {}
    for line in mapping_path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\|\s*([a-z]+)\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)` \(`([^`]+)`\)\s*\|\s*`([^`]+)`\s*\|$", line)
        if m:
            role, contract_model, path, runtime_model, codex_model = m.groups()
            mapping_rows[role] = (contract_model, path, runtime_model, codex_model)

    if set(mapping_rows) != expected_roles:
        errors.append(
            "meta/agent-runtime-mapping.md: role対応表一式が不一致 "
            f"(expected={sorted(expected_roles)}, actual={sorted(mapping_rows)})"
        )
    for role in ROLE_NAMES:
        row = mapping_rows.get(role)
        expected_path = f".claude/agents/{role}.md"
        frontmatter = source_frontmatter.get(role)
        if not row or not frontmatter:
            continue
        contract_model, path, runtime_model, codex_model = row
        if path != expected_path or contract_model != frontmatter.get("model") or runtime_model != frontmatter.get("model"):
            errors.append(
                f"meta/agent-runtime-mapping.md: {role} のClaude runtime対応がrole定義と一致しない"
            )
        if not codex_model:
            errors.append(f"meta/agent-runtime-mapping.md: {role} のCodex modelが無い")


# ---------------------------------------------------------------- ADR
def adr_dirs() -> list[Path]:
    dirs = [ROOT / "meta" / "adr"]
    dirs += sorted((ROOT / "projects").glob("*/adr"))
    return [d for d in dirs if d.is_dir()]


def check_adrs() -> dict[str, dict]:
    """全ADRを読み、スキーマと参照整合を検証する。キーは 'scope#id'。"""
    adrs: dict[str, dict] = {}
    required = ["id", "scope", "status", "date"]

    for d in adr_dirs():
        for path in sorted(d.glob("*.md")):
            rel = path.relative_to(ROOT).as_posix()
            fm = read_frontmatter(path)
            if fm is None:
                errors.append(f"{rel}: frontmatterが無い（meta/adr/0012の様式に従うこと）")
                continue
            for field in required:
                if not fm.get(field):
                    errors.append(f"{rel}: 必須フィールド '{field}' が無い")
            if fm.get("status") and fm["status"] not in ADR_STATUSES:
                errors.append(f"{rel}: status='{fm['status']}' は不正（許容: {'/'.join(sorted(ADR_STATUSES))}）")
            if fm.get("date") and not re.match(r"^\d{4}-\d{2}-\d{2}$", str(fm["date"])):
                errors.append(f"{rel}: date='{fm['date']}' はYYYY-MM-DD形式でない")
            file_id = path.name.split("-")[0]
            if fm.get("id") and str(fm["id"]) != file_id:
                errors.append(f"{rel}: id='{fm['id']}' がファイル名の採番 '{file_id}' と一致しない")
            if fm.get("scope"):
                key = f"{fm['scope']}#{fm.get('id')}"
                if key in adrs:
                    errors.append(f"{rel}: id が scope 内で重複している（{key}）")
                adrs[key] = {"fm": fm, "path": rel}
    return adrs


def check_adr_links(adrs: dict[str, dict]) -> None:
    """supersedes/superseded_by が実在し、かつ対称であることを検証する。"""
    for key, entry in adrs.items():
        fm, rel = entry["fm"], entry["path"]
        scope = fm["scope"]
        for target in fm.get("supersedes") or []:
            tkey = f"{scope}#{target}"
            if tkey not in adrs:
                errors.append(f"{rel}: supersedes '{target}' が同じscope({scope})に存在しない")
                continue
            back = adrs[tkey]["fm"].get("superseded_by")
            if str(back) != str(fm["id"]):
                errors.append(
                    f"{rel}: supersedes '{target}' だが、{adrs[tkey]['path']} の superseded_by が "
                    f"'{back}'（'{fm['id']}' であるべき）。supersede関係が非対称"
                )
            if adrs[tkey]["fm"].get("status") != "superseded":
                errors.append(
                    f"{adrs[tkey]['path']}: ADR-{fm['id']} に置き換えられているが status が 'superseded' でない"
                )
        sb = fm.get("superseded_by")
        if sb and f"{scope}#{sb}" not in adrs:
            errors.append(f"{rel}: superseded_by '{sb}' が同じscope({scope})に存在しない")
        if sb and fm.get("status") != "superseded":
            errors.append(f"{rel}: superseded_by が設定されているが status が 'superseded' でない")


def report_pending_adrs(adrs: dict[str, dict], today: date | None = None) -> None:
    """status: 提案中 のまま滞留しているADRを、経過日数の降順で棚卸しする（meta/adr/0035）。

    ERRORにしない: 「このADRは承認されるべきか」「保留は妥当か」は意味判定であり機械が確定できない。
    日数の閾値でCIを赤にすると、正当な保留（判断材料は残すが決定はまだ、という意図的な状態）が罰され、
    回避のために内容を伴わない承認が押される。機械は「見えていないものを見せる」までを担う（P-04）。
    """
    today = today or date.today()
    pending: list[tuple[int, str, str]] = []
    for entry in adrs.values():
        fm, rel = entry["fm"], entry["path"]
        if fm.get("status") != "提案中":
            continue
        try:
            drafted = date.fromisoformat(str(fm.get("date")))
        except (TypeError, ValueError):
            # dateの形式不正は check_adrs が既にERRORとして報告済み。ここでは日数を出さない
            pending.append((-1, rel, str(fm.get("date"))))
            continue
        pending.append(((today - drafted).days, rel, str(fm.get("date"))))

    if not pending:
        return
    pending.sort(key=lambda row: (-row[0], row[1]))
    reports.append(
        f"提案中のまま滞留しているADR {len(pending)}本（承認するか、意図した保留かを判断すること。"
        f"meta/adr/0035）"
    )
    for age, rel, drafted in pending:
        age_text = f"{age}日経過" if age >= 0 else "経過日数不明（dateが不正）"
        reports.append(f"  提案中: {rel}（起草 {drafted} / {age_text}）")


# ---------------------------------------------------------------- friction-log
FR_BLOCK_RE = re.compile(r"^## (FR-\d+):.*?\n+```yaml\n(.*?)\n```", re.S | re.M)


def check_friction_logs() -> None:
    required = ["id", "date", "found_at", "cause_category", "cause_key", "status"]
    for path in sorted((ROOT / "projects").glob("*/friction-log.md")):
        rel = path.relative_to(ROOT).as_posix()
        text = path.read_text(encoding="utf-8")

        headings = re.findall(r"^## (FR-\d+):", text, re.M)
        blocks = FR_BLOCK_RE.findall(text)
        if len(headings) != len(blocks):
            found = {b[0] for b in blocks}
            for h in headings:
                if h not in found:
                    errors.append(f"{rel}: {h} に機械可読メタデータ（```yamlブロック）が無い")

        by_cause: dict[str, list[str]] = {}
        seen_ids: set[str] = set()
        for fr_id, raw in blocks:
            fm = parse_block(raw)
            for field in required:
                if not fm.get(field):
                    errors.append(f"{rel} {fr_id}: 必須フィールド '{field}' が無い")
            if fm.get("id") != fr_id:
                errors.append(f"{rel} {fr_id}: メタデータの id='{fm.get('id')}' が見出しと一致しない")
            if fr_id in seen_ids:
                errors.append(f"{rel}: {fr_id} が重複している")
            seen_ids.add(fr_id)
            if fm.get("status") and fm["status"] not in FR_STATUSES:
                errors.append(f"{rel} {fr_id}: status='{fm['status']}' は不正（許容: {'/'.join(sorted(FR_STATUSES))}）")
            if fm.get("found_at") and fm["found_at"] not in FR_FOUND_AT:
                errors.append(f"{rel} {fr_id}: found_at='{fm['found_at']}' は不正（許容: {'/'.join(sorted(FR_FOUND_AT))}）")
            for target in fm.get("pushed_to") or []:
                if not (ROOT / target).exists():
                    errors.append(f"{rel} {fr_id}: pushed_to '{target}' が存在しない")
            if fm.get("cause_key"):
                by_cause.setdefault(fm["cause_key"], []).append(fr_id)
            if fm.get("status") == "未対応":
                reports.append(f"{rel} {fr_id}: 未対応のまま（棚卸し対象）")

        for cause_key, ids in sorted(by_cause.items()):
            if len(ids) >= 2:
                reports.append(
                    f"{rel}: cause_key '{cause_key}' が {len(ids)}回 出現 → 構造的欠陥のシグナル "
                    f"（{', '.join(ids)}）。個別対処でなく一般ルール化を検討すること"
                )


# ---------------------------------------------------------------- 契約
SCENARIO_ID = r"[A-Z]{2,}-[A-Z]-\d{2}"
# 参照の境界はASCIIで定める（meta/adr/0037）。`\b` を使うと、Pythonの `\w` がUnicode文字を含むため
# 日本語の助詞が直後に来る `RSV-C-10が…` で単語境界が成立せず、参照が**検出されない**。統治文書は
# 日本語で書かれるため、これは参照整合の検査に言語依存の穴を開けていた。シナリオIDはASCIIなので、
# 「IDの構成文字が前後に続いていない」ことだけを境界条件にする（`RFE-B-031` のような別IDへの
# 部分一致は防ぎつつ、直後が仮名・漢字・記号でも等しく検出する）。
SCENARIO_ID_RE = re.compile(rf"(?<![A-Za-z0-9-])({SCENARIO_ID})(?![A-Za-z0-9-])")
# 定義: **IDがその行の主語である**コメント行（`# RSV-A-01` / `# RSV-A-03: 説明`）か、
# Examples表の第1セル（`| RSV-C-05 |`）。
# IDに続くのは行末かコロンだけを認める（meta/adr/0037）。`\b` だけだと、説明のために行頭でIDに
# 触れた散文（`# RSV-C-05〜C-07が終了時刻の妥当性を…`）まで「定義」と誤認し、実在しない定義を
# 生んで参照検査を骨抜きにしていた（さらに同一ファイル内の本物の定義と重複衝突しうる）。
DEFINE_COMMENT_RE = re.compile(rf"^\s*#\s*({SCENARIO_ID})\s*(?::|$)", re.M)
DEFINE_TABLE_RE = re.compile(rf"^\s*\|\s*({SCENARIO_ID})\s*\|", re.M)
# 欠番: 削除されたが番号を再利用しないID（`RSV-C-11は欠番`）。参照は許すが定義ではない
RETIRED_RE = re.compile(rf"({SCENARIO_ID})\s*は欠番")


def _definitions(text: str) -> set[str]:
    return set(DEFINE_COMMENT_RE.findall(text)) | set(DEFINE_TABLE_RE.findall(text))


def check_scenario_ids() -> None:
    """シナリオIDの定義が一意か、参照（.feature内・API仕様内）が実在の定義に解決するかを検証する。

    定義と参照を区別する: 定義はIDがその行の主語であるコメント行かExamples表の第1セル。
    prose中の言及（例:「最小予約時間(30分、RSV-C-05)との相互作用」）は参照であって定義ではない。

    **名前空間はリポジトリ全体で1つとする**（meta/adr/0037）。旧実装は `projects/<p>/contracts`
    ディレクトリ単位で閉じていたため、consumer-driven contract（meta/adr/0023）や契約SSoT
    （meta/adr/0025）が正当と認めるクロスプロジェクト参照——たとえばフロントの契約が
    control surfaceの導出根拠としてバックエンドのシナリオを引く——を解決できなかった。
    採番プレフィックスはスライスごとに固有（RFE-A/B/C・RSV-A/C/K/L/R）なので衝突は起きず、
    重複検出もリポジトリ全体に効くようになる（検査は緩まず強くなる）。
    """
    defined: dict[str, str] = {}
    retired: set[str] = set()
    texts: dict[str, str] = {}

    for contracts in sorted((ROOT / "projects").glob("*/contracts")):
        for feature in sorted(contracts.glob("*.feature")):
            rel = feature.relative_to(ROOT).as_posix()
            text = feature.read_text(encoding="utf-8")
            texts[rel] = text
            retired |= set(RETIRED_RE.findall(text))
            for sid in sorted(_definitions(text)):
                if sid in defined:
                    errors.append(f"{rel}: シナリオID {sid} の定義が {defined[sid]} と重複している")
                    continue
                defined[sid] = rel
        for spec in sorted(contracts.glob("*.yaml")):
            texts[spec.relative_to(ROOT).as_posix()] = spec.read_text(encoding="utf-8")

    if not defined:
        return

    for sid in sorted(retired & defined.keys()):
        errors.append(f"{defined[sid]}: {sid} は欠番と宣言されているのに定義もされている（番号の再利用は禁止）")

    for rel, text in sorted(texts.items()):
        for sid in sorted(set(SCENARIO_ID_RE.findall(text))):
            if sid not in defined and sid not in retired:
                errors.append(f"{rel}: 参照しているシナリオID {sid} が どの.featureにも定義されていない")


# ---------------------------------------------------------------- main
def main() -> int:
    check_role_agent_ssot()
    adrs = check_adrs()
    check_adr_links(adrs)
    report_pending_adrs(adrs)
    check_friction_logs()
    check_scenario_ids()

    print(f"govlint: ADR {len(adrs)}本を検証")
    if reports:
        print("\n--- REPORT（判断は人間。ここでは失敗させない） ---")
        for r in reports:
            print(f"  [REPORT] {r}")
    if errors:
        print("\n--- ERROR ---")
        for e in errors:
            print(f"  [ERROR] {e}")
        print(f"\ngovlint: {len(errors)}件のエラー")
        return 1
    print("\ngovlint: エラーなし")
    return 0


if __name__ == "__main__":
    sys.exit(main())
