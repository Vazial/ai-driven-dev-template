#!/usr/bin/env python3
"""govlint — 統治文書（ADR・friction-log・契約）の機械検証（meta/adr/0012）。

検証するもの:
  [ERROR] スキーマ妥当性       … 必須フィールドの有無・値の妥当性
  [ERROR] 参照整合             … supersedes/superseded_by/pushed_to の参照先が実在するか、supersede関係が対称か
  [ERROR] シナリオIDの整合     … .feature内でIDが一意か、API仕様が参照するIDが実在するか
  [REPORT] cause_keyの再出現   … 同一原因の2回目以降＝構造的欠陥のシグナル（人間が判断する。失敗させない）
  [REPORT] 未対応FRの棚卸し

終了コード: ERRORが1件でもあれば1、なければ0（REPORTは0のまま）。

依存なし（標準ライブラリのみ）。frontmatter/yamlブロックは本ツールが定める限定サブセットのみ扱う。
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

ADR_STATUSES = {"提案中", "承認済み", "superseded"}
FR_STATUSES = {"未対応", "対応済み"}
FR_FOUND_AT = {"L1", "L2", "L3", "L4", "L5", "人間", "AI"}

errors: list[str] = []
reports: list[str] = []


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
SCENARIO_ID_RE = re.compile(rf"\b({SCENARIO_ID})\b")
# 定義: シナリオIDで始まるコメント行（`# RSV-A-01` / `# RSV-A-03: 説明`）か、Examples表の第1セル（`| RSV-C-05 |`）
DEFINE_COMMENT_RE = re.compile(rf"^\s*#\s*({SCENARIO_ID})\b", re.M)
DEFINE_TABLE_RE = re.compile(rf"^\s*\|\s*({SCENARIO_ID})\s*\|", re.M)
# 欠番: 削除されたが番号を再利用しないID（`RSV-C-11は欠番`）。参照は許すが定義ではない
RETIRED_RE = re.compile(rf"({SCENARIO_ID})\s*は欠番")


def _definitions(text: str) -> set[str]:
    return set(DEFINE_COMMENT_RE.findall(text)) | set(DEFINE_TABLE_RE.findall(text))


def check_scenario_ids() -> None:
    """シナリオIDの定義が一意か、参照（.feature内・API仕様内）が実在の定義に解決するかを検証する。

    定義と参照を区別する: 定義はIDで始まるコメント行かExamples表の第1セル。
    prose中の言及（例:「最小予約時間(30分、RSV-C-05)との相互作用」）は参照であって定義ではない。
    """
    for contracts in sorted((ROOT / "projects").glob("*/contracts")):
        defined: dict[str, str] = {}
        retired: set[str] = set()
        texts: dict[str, str] = {}

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
        if not defined:
            continue

        for sid in sorted(retired & defined.keys()):
            errors.append(f"{defined[sid]}: {sid} は欠番と宣言されているのに定義もされている（番号の再利用は禁止）")

        for spec in sorted(contracts.glob("*.yaml")):
            texts[spec.relative_to(ROOT).as_posix()] = spec.read_text(encoding="utf-8")

        for rel, text in texts.items():
            for sid in sorted(set(SCENARIO_ID_RE.findall(text))):
                if sid not in defined and sid not in retired:
                    errors.append(f"{rel}: 参照しているシナリオID {sid} が どの.featureにも定義されていない")


# ---------------------------------------------------------------- main
def main() -> int:
    adrs = check_adrs()
    check_adr_links(adrs)
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
