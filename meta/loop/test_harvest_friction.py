# -*- coding: utf-8 -*-
"""harvest_friction の単体テスト（meta/adr/0049）。

`role: user` の判別など、生のログの癖を畳む部分のテストは `test_index_sessions.py` にある
（正規化の層が持つ責務なので、そちらで1回だけ守る）。ここで守るのは3つ。

1. シグナルが当たること、当たらないものに当たらないこと
2. 閾値に届かないセッションを報告しないこと（軽い修正はここで黙って落ちる）
3. hook の誤発火で収穫位置が進まないこと
"""
import os
import sqlite3
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import harvest_friction as hf  # noqa: E402
import index_sessions as ix  # noqa: E402


# ---------------------------------------------------------------- 器


@pytest.fixture
def db(tmp_path):
    """イベントを直接書き込める、空のインデックス。"""
    path = str(tmp_path / "index.db")
    con = sqlite3.connect(path)
    con.executescript(ix.SCHEMA)
    con.execute("INSERT INTO session VALUES ('s1','2026-08-01T00:00:00Z','2026-08-02T00:00:00Z',"
                "'/repo','[\"main\"]','[\"s1.jsonl\"]',0)")
    con.commit()
    con.close()
    return path


def put(db, kind, text, *, n=1, ts="2026-08-01T00:00:00Z", tool=None, err=None,
        agent=None, agent_type=None):
    con = sqlite3.connect(db)
    if agent:
        con.execute("INSERT OR IGNORE INTO agent_run VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (agent, "s1", agent_type, "説明", "toolu_1", 1, ts, ts, ts, 1,
                     "ブリーフ", "成果", 0, 0, 0))
    for i in range(n):
        con.execute("INSERT INTO event VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (f"e{kind}{i}{text[:5]}{agent or ''}", f"u{i}", "s1", agent, None, ts,
                     kind, "user", "main", tool, err, len(text), text))
    con.commit()
    con.close()


def harvest(db, threshold=8):
    return hf.harvest(db, None, threshold)[0]


# ---------------------------------------------------------------- 1. シグナル


def test_人間の訂正を拾う(db):
    put(db, "human_prompt", "違う。勝手に契約を書き換えないで")
    got = harvest(db, threshold=1)
    assert got[0]["score"] == 10                      # denial(5) + unauthorized(5)
    assert got[0]["hits"][0]["kind"] == "human:denial+unauthorized"


def test_普通の依頼は拾わない(db):
    put(db, "human_prompt", "READMEのtypoを直してください")
    assert harvest(db, threshold=1) == []


def test_役割agent側のブリーフを人間の訂正として数えない(db):
    """agentへの指示が「人間の訂正」として並んだことが実際にあった。"""
    put(db, "agent_brief", "違う。勝手に書き換えないで", agent="agent-a1", agent_type="developer")
    assert harvest(db, threshold=1) == []


def test_割り込みを拾う(db):
    put(db, "tool_result", "The user doesn't want to proceed with this tool use.", err=1)
    assert harvest(db, threshold=1)[0]["hits"][0]["kind"] == "interrupted"


def test_同一エラーの連発を拾う(db):
    put(db, "tool_result", "<tool_use_error>denied", n=hf.REPEATED_ERROR_MIN, err=1)
    assert harvest(db, threshold=1)[0]["hits"][0]["kind"].startswith("repeated-error")


def test_エラーが閾値未満なら数えない(db):
    put(db, "tool_result", "<tool_use_error>denied", n=hf.REPEATED_ERROR_MIN - 1, err=1)
    assert harvest(db, threshold=1) == []


def test_役割agentのエラーも拾い_どの役割か分かる(db):
    put(db, "tool_result", "File does not exist", n=hf.REPEATED_ERROR_MIN, err=1,
        agent="agent-a1", agent_type="architect")
    hit = harvest(db, threshold=1)[0]["hits"][0]
    assert hit["kind"].startswith("repeated-error")
    assert hit["agent"] == "architect"


def test_ゲートが落ちた差し戻しを拾う(db):
    put(db, "coordinator_message", "L1のゲートがあなたの成果物2ファイルで落ちています",
        agent="agent-a1", agent_type="developer")
    hit = harvest(db, threshold=1)[0]["hits"][0]
    assert hit["kind"] == "agent-rework"
    assert hit["agent"] == "developer"


def test_正常な途中連絡は差し戻しとして数えない(db):
    """途中連絡の多くは設計どおりの調整であって摩擦ではない。"""
    put(db, "coordinator_message", "人間の判断が出ました。案B採用です（ADR-0004）",
        agent="agent-a1", agent_type="tester")
    assert harvest(db, threshold=1) == []


def test_自己訂正を拾う(db):
    put(db, "assistant_text", "失礼しました。前の測定は誤りでした")
    assert harvest(db, threshold=1)[0]["hits"][0]["kind"] == "self-correction"


def test_同一ファイルへの書き込みの往復を拾う(db):
    put(db, "tool_use", '{"file_path": "/repo/a.py"}', n=hf.EDIT_CHURN_MIN, tool="Edit")
    assert harvest(db, threshold=1)[0]["hits"][0]["kind"].startswith("edit-churn")


def test_壊れたツール入力でも落ちない(db):
    put(db, "tool_use", "これはJSONではない", n=hf.EDIT_CHURN_MIN, tool="Edit")
    assert harvest(db, threshold=1) == []


# ---------------------------------------------------------------- 2. 閾値


def test_閾値に届かないセッションは報告しない(db):
    put(db, "human_prompt", "なんでこうなってるの？")     # why(2) のみ
    assert harvest(db, threshold=8) == []
    assert harvest(db, threshold=1) != []


def test_sinceより前は見ない(db):
    put(db, "human_prompt", "違う", ts="2026-08-01T00:00:00Z")
    assert hf.harvest(db, "2026-08-02T00:00:00Z", 1)[0] == []


def test_摩擦が無ければ空を返す(db):
    assert harvest(db) == []


# ---------------------------------------------------------------- 3. hookの誤発火
#
# `if` フィルタはバッククォートで囲まれた文字列をコマンド置換として解析して一致させる
# （クォート付き heredoc の中でも同じ。実測）。誤発火で収穫位置が進むと蓄積が消える。


def test_本物のマージコマンドを認める():
    assert hf.is_merge_command("gh pr merge 121 --squash")
    assert hf.is_merge_command('cd "/repo" && gh pr merge 121 --delete-branch')


def test_コミットメッセージ内のバッククォートでは発火しない():
    assert not hf.is_merge_command(
        "git commit -F- <<'MSG'\n- hook（`gh pr merge` 時）で自動実行\nMSG")


def test_無関係なコマンドでは発火しない():
    assert not hf.is_merge_command("git status --short")
    assert not hf.is_merge_command("echo 'gh pr merge と書いただけ'")


def test_コマンドが空でも落ちない():
    assert not hf.is_merge_command("")
    assert not hf.is_merge_command(None)
