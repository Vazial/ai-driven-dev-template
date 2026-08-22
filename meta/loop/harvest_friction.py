#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""harvest_friction — セッションログ(jsonl)からfriction候補を走査する（meta/adr/0049）。

friction-log は「その場で書く」ことを前提に設計されている（P-05）。だが実際には
書き損ねる。このツールは書き損ねた分を**セッションログから拾い直す**。

**このツールはゲートではない**（meta/adr/0046 の施錠対象ではない）。何も失敗させず、
何も判定しない。閾値を超えた「読むべき瞬間」を候補として並べるだけで、FR を起票するか
どうかは人間が決める（meta/adr/0049 決定3）。

使い方:
  python meta/loop/harvest_friction.py                 # 前回の収穫以降を走査して報告
  python meta/loop/harvest_friction.py --all           # 溜まっている全期間を走査
  python meta/loop/harvest_friction.py --hook          # PostToolUse hook から呼ばれる形
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STATE_PATH = os.path.join(HERE, ".claude", "harvest-state.json")

# ---------------------------------------------------------------- シグナル定義
#
# 「AIが迷った・誤った・曖昧な指示で事故った瞬間」（friction-log の定義）に機械的に
# 対応づけられるものだけを置く。意味の判定はしない——重みは「人間が読む価値の見込み」で
# あって、frictionの重さではない。

# S1: 人間が打ち直した否定・訂正。最も強い（人間が手で止めた＝AIが外れた証拠）
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

# S2: AI自身の自己訂正。直前に何かを誤っている
SELF_CORRECTION = re.compile(
    r"失礼しました|間違えました|訂正します|誤りでした|見落として|勘違い"
)

# S3: ツール実行の拒否・割り込み。人間が手で止めた瞬間
INTERRUPT = re.compile(
    r"user doesn't want to (proceed|take)|Request interrupted|user denied|"
    r"rejected the tool|\[Request interrupted by user"
)

REPEATED_ERROR_MIN = 4  # 同一エラーが何回出たら「詰まっていた」とみなすか
EDIT_CHURN_MIN = 8      # 同一ファイルへの書き込みが何回で「往復していた」とみなすか

# ---------------------------------------------------------------- 人間の発話の判別
#
# `role: user` のレコードには、人間がタイプしていないものが大量に混ざる
# （task-notification・slashコマンド展開・引き継ぎサマリ・画像添付）。ここを外さないと
# 候補の中身がほぼ全部それになる（meta/adr/0049 決定2の根拠）。
#
# `promptSource` フィールドは task-notification にも付くため判別に使えない（実測）。

NOT_TYPED_PREFIX = ("<", "[Image:", "Caveat:", "This session is being continued")
EMBEDDED_BLOCK = re.compile(r"<(system-reminder|local-command\w*)>.*?</\1>", re.S)
MAX_PROMPT_CHARS = 3000  # 引き継ぎサマリ級の長文は人間の発話ではない


def human_prompt(rec: dict) -> str | None:
    """人間が実際にタイプした本文だけを返す。それ以外は None。"""
    if rec.get("type") != "user" or rec.get("isSidechain"):
        return None
    message = rec.get("message")
    if not isinstance(message, dict):
        return None
    content = message.get("content")
    if not isinstance(content, str):
        return None
    text = EMBEDDED_BLOCK.sub("", content).strip()
    if not text or text.startswith(NOT_TYPED_PREFIX):
        return None
    if len(text) > MAX_PROMPT_CHARS:
        return None
    return text


def assistant_text(rec: dict) -> str:
    message = rec.get("message")
    if not isinstance(message, dict):
        return ""
    content = message.get("content")
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    return "\n".join(
        b.get("text") or "" for b in content if isinstance(b, dict) and b.get("type") == "text"
    )


def _blocks(rec: dict, kind: str):
    message = rec.get("message")
    if not isinstance(message, dict):
        return
    content = message.get("content")
    if not isinstance(content, list):
        return
    for b in content:
        if isinstance(b, dict) and b.get("type") == kind:
            yield b


# ---------------------------------------------------------------- 走査


def scan_session(path: str, since: str | None) -> dict | None:
    records = []
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue  # 書きかけの行。落とさず飛ばす

    if since:
        records = [r for r in records if (r.get("timestamp") or "") >= since]
    if not records:
        return None

    hits: list[tuple[int, str, str, str, str]] = []
    errors_by_signature: dict[str, int] = defaultdict(int)
    writes_by_file: dict[str, int] = defaultdict(int)
    last_assistant = ""

    for rec in records:
        typed = human_prompt(rec)
        if typed:
            matched = [(key, w) for pattern, key, w in HUMAN_CORRECTION if re.search(pattern, typed)]
            if matched:
                hits.append((
                    min(sum(w for _, w in matched), 10),
                    "human:" + "+".join(k for k, _ in matched),
                    rec.get("timestamp", ""),
                    typed[:400],
                    last_assistant[:300],
                ))

        if rec.get("type") == "assistant":
            text = assistant_text(rec)
            if text.strip():
                last_assistant = text
            if SELF_CORRECTION.search(text):
                hits.append((2, "self-correction", rec.get("timestamp", ""), text[:400], ""))
            for use in _blocks(rec, "tool_use"):
                if use.get("name") in ("Edit", "Write", "NotebookEdit"):
                    target = (use.get("input") or {}).get("file_path")
                    if target:
                        writes_by_file[target] += 1

        for result in _blocks(rec, "tool_result"):
            if not result.get("is_error"):
                continue
            body = str(result.get("content"))
            if INTERRUPT.search(body):
                hits.append((4, "interrupted", rec.get("timestamp", ""), body[:300], last_assistant[:300]))
            else:
                errors_by_signature[body.split("\n")[0][:60]] += 1

    for signature, count in errors_by_signature.items():
        if count >= REPEATED_ERROR_MIN:
            hits.append((min(count // 2, 4), f"repeated-error x{count}", "", signature, ""))
    for target, count in writes_by_file.items():
        if count >= EDIT_CHURN_MIN:
            hits.append((2, f"edit-churn x{count}", "", target, ""))

    stamps = [r["timestamp"] for r in records if r.get("timestamp")]
    return {
        "session": os.path.basename(path)[:8],
        "start": min(stamps) if stamps else "",
        "end": max(stamps) if stamps else "",
        "branches": sorted({r["gitBranch"] for r in records if r.get("gitBranch")}),
        "turns": sum(1 for r in records if r.get("type") == "assistant"),
        "score": sum(h[0] for h in hits),
        "hits": sorted(hits, key=lambda h: -h[0]),
    }


# ---------------------------------------------------------------- ログの置き場


def main_worktree(start: str) -> str:
    """worktreeから呼ばれても**主リポジトリのルート**を返す。

    ログの置き場はチェックアウト先ごとに分かれる。worktree内でそのまま走らせると
    自分の分しか見えず、本体のログを丸ごと取りこぼす。
    """
    try:
        common = subprocess.run(
            ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
            cwd=start, capture_output=True, text=True, check=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return start
    return os.path.dirname(common) if os.path.basename(common) == ".git" else start


def transcript_dirs(repo_root: str) -> list[str]:
    """このリポジトリのセッションログが置かれたディレクトリ（worktree分を含む）。"""
    slug = re.sub(r"[^A-Za-z0-9-]", "-", os.path.abspath(repo_root))
    base = os.path.join(os.path.expanduser("~"), ".claude", "projects")
    if not os.path.isdir(base):
        return []
    return [
        os.path.join(base, name)
        for name in sorted(os.listdir(base))
        if name == slug or name.startswith(slug + "--claude-worktrees-")
    ]


# ---------------------------------------------------------------- トリガの検証
#
# hook の `if` フィルタ（`Bash(gh pr merge*)`）だけに頼れない。**バッククォートで
# 囲まれた文字列はコマンド置換として解析され、`if` に一致する**——クォート付き
# heredoc の中でも同じである（実測: コミットメッセージに `gh pr merge` と書いたら
# hook が発火した）。誤発火そのものは無害だが、**収穫位置が黙って進んで蓄積を食う**。
# したがって呼ばれた側でもう一度確かめる。

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


# ---------------------------------------------------------------- 出力


def render(hot: list[dict], scanned: int, threshold: int, top: int) -> str:
    lines = [
        "# friction収穫候補",
        "",
        f"走査 {scanned} セッション / 閾値 {threshold} / 該当 {len(hot)}",
        "",
        "> 候補であって FR ではない。読んで、friction であるものだけを "
        "`projects/<p>/friction-log.md` に起票する（cause_key は既存を先に見る）。",
        "",
    ]
    for r in hot:
        lines.append(
            f"## [{r['score']}] {r['session']}  {r['start'][:16]} → {r['end'][:16]}  turns={r['turns']}"
        )
        if r["branches"]:
            lines.append(f"branch: {', '.join(r['branches'][:5])}")
        lines.append("")
        for score, kind, stamp, excerpt, context in r["hits"][:top]:
            lines.append(f"- **[{score}] {kind}** {stamp[:16]}")
            lines.append(f"  - 人間/事象: {' '.join(excerpt.split())[:260]}")
            if context:
                lines.append(f"  - 直前のAI: {' '.join(context.split())[:180]}")
        lines.append("")
    return "\n".join(lines)


def harvest(repo_root: str, since: str | None, threshold: int, top: int):
    results = []
    for directory in transcript_dirs(repo_root):
        for name in sorted(os.listdir(directory)):
            if not name.endswith(".jsonl"):
                continue
            found = scan_session(os.path.join(directory, name), since)
            if found:
                results.append(found)
    hot = sorted((r for r in results if r["score"] >= threshold), key=lambda r: -r["score"])
    return results, hot, render(hot, len(results), threshold, top)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--all", action="store_true", help="前回の収穫位置を無視して全期間を走査する")
    ap.add_argument("--since", default=None, help="ISO timestamp。これ以降のレコードだけ見る")
    ap.add_argument("--threshold", type=int, default=8, help="このスコア未満のセッションは報告しない")
    ap.add_argument("--top", type=int, default=4, help="1セッションあたりに出す抜粋の数")
    ap.add_argument("--hook", action="store_true", help="PostToolUse hook として動く（stdinはhookのJSON）")
    ap.add_argument("--no-advance", action="store_true", help="収穫位置を進めない（試し撃ち用）")
    args = ap.parse_args(argv)

    if args.hook:
        try:
            payload = json.loads(sys.stdin.read() or "{}")
        except json.JSONDecodeError:
            payload = {}
        command = (payload.get("tool_input") or {}).get("command", "")
        if not is_merge_command(command):
            return 0  # `if` フィルタの誤発火。収穫位置も進めない

    since = None if args.all else (args.since or load_since())
    _, hot, report = harvest(main_worktree(HERE), since, args.threshold, args.top)
    now = datetime.now(timezone.utc).isoformat()

    if args.hook:
        if hot:
            print(json.dumps({
                "systemMessage": f"friction収穫候補 {len(hot)} 件（前回の収穫以降）",
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": report
                        + "\n\n上の候補を読み、friction であるものだけを起票の候補として"
                          "人間に提示すること。friction-log への追記は人間の GO のあとで行う"
                          "（meta/adr/0049 決定3）。",
                },
            }, ensure_ascii=False))
        # 候補が無ければ何も言わない。軽量な修正はここで黙って落ちる
        if not args.no_advance:
            save_since(now)
        return 0

    print(report if hot else f"収穫候補なし（閾値 {args.threshold}）")
    if not args.no_advance:
        save_since(now)
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
