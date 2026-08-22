# -*- coding: utf-8 -*-
"""harvest_friction の単体テスト（meta/adr/0049）。

守りたいのは主に **人間の発話の判別**。`role: user` に混ざる非発話
（task-notification・slash展開・引き継ぎサマリ）を落とし損ねると、候補の中身が
ほぼ全部それになる——プロトタイプで実際にそうなった。
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import harvest_friction as hf  # noqa: E402


def user(content, **extra):
    return {"type": "user", "message": {"role": "user", "content": content}, **extra}


# ---------------------------------------------------------------- 人間の発話の判別


def test_人間がタイプした発話は拾う():
    assert hf.human_prompt(user("なんで勝手に消したの？")) == "なんで勝手に消したの？"


def test_task_notificationは人間の発話ではない():
    # promptSource が付いていても発話ではない（実測。判別に使えない）
    rec = user("<task-notification>\n<task-id>abc</task-id>\n</task-notification>",
               promptSource="user", origin="external")
    assert hf.human_prompt(rec) is None


def test_slashコマンドの展開は人間の発話ではない():
    assert hf.human_prompt(user("<command-name>/design</command-name>")) is None


def test_引き継ぎサマリは人間の発話ではない():
    assert hf.human_prompt(user("This session is being continued from a previous conversation.")) is None


def test_画像添付は人間の発話ではない():
    assert hf.human_prompt(user("[Image: original 1440x2004, displayed at 1437x2000.]")) is None


def test_長すぎる本文は人間の発話ではない():
    assert hf.human_prompt(user("あ" * (hf.MAX_PROMPT_CHARS + 1))) is None


def test_末尾のsystem_reminderは剥がしてから判定する():
    rec = user("直して\n<system-reminder>\nこれは違う\n</system-reminder>")
    assert hf.human_prompt(rec) == "直して"


def test_サブエージェントの発話は拾わない():
    assert hf.human_prompt(user("違う", isSidechain=True)) is None


def test_tool_resultは人間の発話ではない():
    rec = user([{"type": "tool_result", "content": "違う", "is_error": False}])
    assert hf.human_prompt(rec) is None


# ---------------------------------------------------------------- 走査とスコア


def write_session(tmp_path, records):
    path = tmp_path / "session.jsonl"
    path.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in records), encoding="utf-8")
    return str(path)


def test_摩擦のないセッションはスコアが立たない(tmp_path):
    path = write_session(tmp_path, [
        user("READMEのtypoを直して", timestamp="2026-08-01T00:00:00Z"),
        {"type": "assistant", "message": {"role": "assistant",
         "content": [{"type": "text", "text": "直しました。"}]}, "timestamp": "2026-08-01T00:01:00Z"},
    ])
    assert hf.scan_session(path, None)["score"] == 0


def test_人間の訂正はスコアになる(tmp_path):
    path = write_session(tmp_path, [
        user("違う。勝手に契約を書き換えないで", timestamp="2026-08-01T00:00:00Z"),
    ])
    found = hf.scan_session(path, None)
    assert found["score"] == 10  # denial(5) + unauthorized(5)
    assert found["hits"][0][1] == "human:denial+unauthorized"


def test_割り込みはスコアになる(tmp_path):
    path = write_session(tmp_path, [
        user([{"type": "tool_result", "is_error": True,
               "content": "The user doesn't want to proceed with this tool use."}],
             timestamp="2026-08-01T00:00:00Z"),
    ])
    assert hf.scan_session(path, None)["hits"][0][1] == "interrupted"


def test_同一エラーの連発はスコアになる(tmp_path):
    err = user([{"type": "tool_result", "is_error": True, "content": "<tool_use_error>denied"}],
               timestamp="2026-08-01T00:00:00Z")
    path = write_session(tmp_path, [err] * hf.REPEATED_ERROR_MIN)
    kinds = [h[1] for h in hf.scan_session(path, None)["hits"]]
    assert any(k.startswith("repeated-error") for k in kinds)


def test_エラーが閾値未満なら数えない(tmp_path):
    err = user([{"type": "tool_result", "is_error": True, "content": "<tool_use_error>denied"}],
               timestamp="2026-08-01T00:00:00Z")
    path = write_session(tmp_path, [err] * (hf.REPEATED_ERROR_MIN - 1))
    assert hf.scan_session(path, None)["score"] == 0


def test_sinceより前のレコードは見ない(tmp_path):
    path = write_session(tmp_path, [user("違う", timestamp="2026-08-01T00:00:00Z")])
    assert hf.scan_session(path, "2026-08-02T00:00:00Z") is None


def test_壊れた行があっても走査は続く(tmp_path):
    path = tmp_path / "session.jsonl"
    path.write_text('{"broken\n' + json.dumps(user("違う", timestamp="2026-08-01T00:00:00Z"),
                                              ensure_ascii=False), encoding="utf-8")
    assert hf.scan_session(str(path), None)["score"] > 0


# ---------------------------------------------------------------- ログの置き場


def test_リポジトリのパスからログのディレクトリ名を導ける(monkeypatch, tmp_path):
    base = tmp_path / ".claude" / "projects"
    slug = "E--AWS-Claude-Workspace-ai-driven-dev-template"
    (base / slug).mkdir(parents=True)
    (base / (slug + "--claude-worktrees-abc123")).mkdir()
    (base / "E--AWS-Claude-Workspace-other-project").mkdir()
    monkeypatch.setattr(os.path, "expanduser", lambda _: str(tmp_path))

    found = [os.path.basename(d) for d in hf.transcript_dirs(r"E:\AWS\Claude_Workspace\ai-driven-dev-template")]
    assert found == [slug, slug + "--claude-worktrees-abc123"]


# ---------------------------------------------------------------- トリガの検証
#
# hook の `if` フィルタは、バッククォートで囲まれた文字列をコマンド置換として
# 解析して一致させる（クォート付き heredoc の中でも同じ。実測）。誤発火で
# 収穫位置が進むと蓄積が黙って消えるので、呼ばれた側でも確かめる。


def test_本物のマージコマンドを認める():
    assert hf.is_merge_command("gh pr merge 121 --squash")
    assert hf.is_merge_command('cd "/repo" && gh pr merge 121 --squash --delete-branch')


def test_コミットメッセージ内のバッククォートでは発火しない():
    command = "git commit -F- <<'MSG'\n- PostToolUse hook（`gh pr merge` 時）で自動実行\nMSG"
    assert not hf.is_merge_command(command)


def test_無関係なコマンドでは発火しない():
    assert not hf.is_merge_command("git status --short")
    assert not hf.is_merge_command("echo 'gh pr merge と書いただけ'")


def test_コマンドが空でも落ちない():
    assert not hf.is_merge_command("")
    assert not hf.is_merge_command(None)
