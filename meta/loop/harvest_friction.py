#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""harvest_friction — 摩擦の候補をセッションログから拾い直す（meta/adr/0049）。

開発中に起きた引っかかりは friction と呼び、各プロジェクトの `friction-log.md` に1件ずつ
記録する運用になっている。書くのはその場で、が原則だが、実際には書き損ねる。この道具は
書き損ねた分をログから拾い直す。

読むのは生のログではなく、`index_sessions.py` が正規化したインデックスである（決定8）。
生のログは重複し、役割agentの記録が別ファイルに分かれ、`role: user` が人間とは限らない。
畳むのは正規化の層の仕事で、ここでは畳み終わったものだけを見る。

**この道具は合否を判定しない。** 何も失敗させず、閾値を超えた「読むべき瞬間」を候補として
並べるだけである。台帳に1件書くかどうかは人間が決める（決定3）。したがって検証ツールの
施錠（ADR-0046）の対象ではない。

使い方:
  python meta/loop/harvest_friction.py                 # 前回の収穫以降を拾う
  python meta/loop/harvest_friction.py --all           # 溜まっている全期間
  python meta/loop/harvest_friction.py --hook          # PostToolUse hook から呼ばれる形
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
from collections import defaultdict
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import index_sessions as ix  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STATE_PATH = os.path.join(HERE, ".claude", "harvest-state.json")

# ---------------------------------------------------------------- シグナル
#
# 「AIが迷った・誤った・曖昧な指示で事故った瞬間」に機械的に対応づけられるものだけを置く。
# 重みが表すのは「人間が読む価値がありそうか」であって、摩擦の重さではない（決定2）。

# 人間が打ち直した否定・訂正。人間が手で止めた＝AIが外れた、という最も強い証拠
HUMAN_CORRECTION = [
    (r"違う|ちがう|そうじゃな|そうではな", "denial", 5),
    (r"勝手に|聞いてな|言ってな|指示してな|頼んでな", "unauthorized", 5),
    (r"戻して|やり直|元に戻|revert", "rollback", 4),
    (r"違反|規程|PRINCIPLES|P-\d\d|ADR-\d{4}を読", "governance", 5),
    (r"止めて|やめて|一旦止|ストップ", "halt", 4),
    (r"だめ|ダメ|駄目|よくない|まずい", "reject", 3),
    (r"間違|ミス|誤り|おかしい|バグって", "error", 3),
    (r"できてな|なってな|反映されてな|直ってな", "not-done", 3),
    (r"なんで|なぜ|どうして", "why", 2),
    (r"確認して|検証して|本当に|ほんとに", "unverified", 2),
]

# AI自身の自己訂正。直前に何かを誤っている
SELF_CORRECTION = re.compile(r"失礼しました|間違えました|訂正します|誤りでした|見落として|勘違い")

# ツール実行の拒否・割り込み。人間が手で止めた瞬間
INTERRUPT = re.compile(
    r"user doesn't want to (proceed|take)|Request interrupted|user denied|"
    r"rejected the tool|\[Request interrupted by user"
)

# orchestrator が実行中のagentに「あなたの成果物が落ちている」と差し戻したもの。
# **狭く取る。** 途中連絡の多くは正常な調整であって摩擦ではない——人間の判断の伝達、
# 前セッションからの再開、reviewerの差し戻し（設計どおりに機能している流れ）。
# ゲートやテストが落ちたことを告げているものだけを拾う。
AGENT_REWORK = re.compile(r"落ちて|失敗しました|件失敗|緑にならな|通らな|欠陥が1件|不具合")

REPEATED_ERROR_MIN = 4   # 同一エラーが何回出たら「詰まっていた」とみなすか
EDIT_CHURN_MIN = 8       # 同一ファイルへの書き込みが何回で「往復していた」とみなすか
MAX_EXCERPT = 400


def ensure_index(repo_root: str, db_path: str | None, rebuild: bool = True) -> str:
    """インデックスを最新にして、そのパスを返す。全再構築で約2秒なので増分は持たない。"""
    db = db_path or ix.default_db(repo_root)
    if rebuild or not os.path.exists(db):
        ix.build(repo_root, db, verbose=False)
    return db


# ---------------------------------------------------------------- 走査

_JOIN = ("FROM event e LEFT JOIN agent_run a ON e.agent_run_id = a.agent_run_id")


def collect_hits(con: sqlite3.Connection, since: str | None) -> list[dict]:
    """インデックスを舐めて、シグナルに当たった行を集める。"""
    con.row_factory = sqlite3.Row
    clause = " AND e.ts >= ?" if since else ""
    args = (since,) if since else ()
    hits: list[dict] = []

    def add(score, kind, row, excerpt, agent=None):
        hits.append({"score": score, "kind": kind, "session": row["session_id"],
                     "ts": row["ts"] or "", "agent": agent,
                     "excerpt": " ".join((excerpt or "").split())[:MAX_EXCERPT]})

    def rows(where):
        return con.execute(
            f"SELECT e.session_id, e.ts, e.text, e.tool_name, a.agent_type {_JOIN} "
            f"WHERE {where}{clause}", args)

    # --- 人間の訂正。メインスレッドのみ（役割agentのログに人間は登場しない）
    for row in rows("e.kind='human_prompt' AND e.agent_run_id IS NULL"):
        matched = [(k, w) for pat, k, w in HUMAN_CORRECTION if re.search(pat, row["text"] or "")]
        if matched:
            add(min(sum(w for _, w in matched), 10),
                "human:" + "+".join(k for k, _ in matched), row, row["text"])

    # --- AI自身の自己訂正。両方の層で見る
    for row in rows("e.kind='assistant_text'"):
        if SELF_CORRECTION.search(row["text"] or ""):
            add(2, "self-correction", row, row["text"], row["agent_type"])

    # --- orchestrator が agent に差し戻した
    for row in rows("e.kind='coordinator_message'"):
        if AGENT_REWORK.search(row["text"] or ""):
            add(3, "agent-rework", row, row["text"], row["agent_type"])

    # --- 割り込み・拒否 と 同一エラーの連発
    errs: dict[tuple, int] = defaultdict(int)
    sample: dict[tuple, sqlite3.Row] = {}
    for row in rows("e.kind='tool_result' AND e.is_error=1"):
        text = row["text"] or ""
        if INTERRUPT.search(text):
            add(4, "interrupted", row, text, row["agent_type"])
            continue
        key = (row["session_id"], text.split("\n")[0][:60])
        errs[key] += 1
        sample.setdefault(key, row)
    for key, n in errs.items():
        if n >= REPEATED_ERROR_MIN:
            row = sample[key]
            add(min(n // 2, 4), f"repeated-error x{n}", row, key[1], row["agent_type"])

    # --- 同一ファイルへの書き込みの往復
    writes: dict[tuple, int] = defaultdict(int)
    wsample: dict[tuple, sqlite3.Row] = {}
    for row in rows("e.kind='tool_use' AND e.tool_name IN ('Edit','Write','NotebookEdit')"):
        try:
            target = json.loads(row["text"] or "{}").get("file_path")
        except json.JSONDecodeError:
            target = None
        if not target:
            continue
        key = (row["session_id"], target)
        writes[key] += 1
        wsample.setdefault(key, row)
    for key, n in writes.items():
        if n >= EDIT_CHURN_MIN:
            row = wsample[key]
            add(2, f"edit-churn x{n}", row, key[1], row["agent_type"])

    return hits


def harvest(db: str, since: str | None, threshold: int):
    con = sqlite3.connect(db)
    hits = collect_hits(con, since)
    meta = {k: v for k, v in con.execute("SELECT key, value FROM meta")}

    by_session: dict[str, list] = defaultdict(list)
    for h in hits:
        by_session[h["session"]].append(h)

    sessions = []
    for sid, group in by_session.items():
        score = sum(h["score"] for h in group)
        if score < threshold:
            continue
        row = con.execute(
            "SELECT started_at, ended_at, branches FROM session WHERE session_id=?", (sid,)
        ).fetchone()
        sessions.append({
            "session": sid[:8], "score": score,
            "start": (row["started_at"] if row else "") or "",
            "end": (row["ended_at"] if row else "") or "",
            "branches": json.loads(row["branches"]) if row and row["branches"] else [],
            "hits": sorted(group, key=lambda h: -h["score"]),
        })
    sessions.sort(key=lambda s: -s["score"])
    con.close()
    return sessions, meta


def render(sessions: list[dict], meta: dict, threshold: int, top: int) -> str:
    lines = [
        "# friction収穫候補", "",
        f"インデックス: {meta.get('n_events','?')}イベント / "
        f"{meta.get('n_sessions','?')}セッション / "
        f"{meta.get('n_agent_runs','?')}件の役割agent実行"
        f"（重複{meta.get('n_duplicate_records_dropped','?')}件を排除済み）",
        f"閾値 {threshold} を超えたセッション: {len(sessions)}", "",
        "> 候補であって台帳の1件ではない。読んで、摩擦だと判断したものだけを "
        "`projects/<p>/friction-log.md` に起票する（cause_key は既存を先に見る）。", "",
    ]
    for s in sessions:
        lines.append(f"## [{s['score']}] {s['session']}  {s['start'][:16]} → {s['end'][:16]}")
        if s["branches"]:
            lines.append(f"branch: {', '.join(s['branches'][:5])}")
        lines.append("")
        for h in s["hits"][:top]:
            who = f" ({h['agent']})" if h["agent"] else ""
            lines.append(f"- **[{h['score']}] {h['kind']}**{who} {h['ts'][:16]}")
            lines.append(f"  - {h['excerpt'][:260]}")
        lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------- hookの検証
#
# hook の `if` フィルタだけに頼れない。バッククォートで囲まれた文字列はコマンド置換として
# 解析され `if` に一致する——クォート付き heredoc の中でも同じである（実測: コミット
# メッセージに gh pr merge と書いたら発火した）。誤発火そのものは無害だが、収穫位置が
# 黙って進んで未収穫の蓄積を食う。呼ばれた側でもう一度確かめる。

SEGMENT_SEPARATOR = re.compile(r"&&|\|\||[;\n|]")


def is_merge_command(command: str) -> bool:
    """コマンド文字列に、本当に `gh pr merge` の実行が含まれるか。"""
    return any(
        seg.strip().lstrip("(").strip().startswith("gh pr merge")
        for seg in SEGMENT_SEPARATOR.split(command or "")
    )


def load_since() -> str | None:
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh).get("harvested_through")
    except (OSError, json.JSONDecodeError):
        return None


def save_since(stamp: str) -> None:
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
    with open(STATE_PATH, "w", encoding="utf-8") as fh:
        json.dump({"harvested_through": stamp}, fh, indent=2)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--all", action="store_true", help="前回の収穫位置を無視して全期間を見る")
    ap.add_argument("--since", default=None, help="ISO timestamp。これ以降だけ見る")
    ap.add_argument("--threshold", type=int, default=8, help="このスコア未満のセッションは報告しない")
    ap.add_argument("--top", type=int, default=4, help="1セッションあたりに出す抜粋の数")
    ap.add_argument("--db", default=None, help="インデックスの場所（既定は index_sessions と同じ）")
    ap.add_argument("--no-rebuild", action="store_true", help="インデックスを作り直さない")
    ap.add_argument("--hook", action="store_true", help="PostToolUse hook として動く")
    ap.add_argument("--no-advance", action="store_true", help="収穫位置を進めない（試し撃ち用）")
    args = ap.parse_args(argv)

    if args.hook:
        try:
            payload = json.loads(sys.stdin.read() or "{}")
        except json.JSONDecodeError:
            payload = {}
        if not is_merge_command((payload.get("tool_input") or {}).get("command", "")):
            return 0  # `if` フィルタの誤発火。収穫位置も進めない

    repo = ix.main_worktree(HERE)
    db = ensure_index(repo, args.db, rebuild=not args.no_rebuild)
    since = None if args.all else (args.since or load_since())
    sessions, meta = harvest(db, since, args.threshold)
    report = render(sessions, meta, args.threshold, args.top)
    now = datetime.now(timezone.utc).isoformat()

    if args.hook:
        if sessions:
            print(json.dumps({
                "systemMessage": f"friction収穫候補 {len(sessions)} 件（前回の収穫以降）",
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": report
                        + "\n\n上の候補を読み、摩擦であるものだけを起票の候補として人間に"
                          "提示すること。台帳への追記は人間のGOのあとで行う（ADR-0049 決定3）。",
                },
            }, ensure_ascii=False))
        if not args.no_advance:
            save_since(now)
        return 0

    print(report if sessions else f"収穫候補なし（閾値 {args.threshold}）")
    if not args.no_advance:
        save_since(now)
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
