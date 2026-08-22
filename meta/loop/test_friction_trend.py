# -*- coding: utf-8 -*-
"""friction_trend の単体テスト（meta/adr/0049）。

守りたいのは2つ。
1. **uuidでの重複排除**。セッションはフォーク・再開で分岐し、同じレコードが複数ファイルに
   入る（実測: 全レコードの21.7%）。潰さないと分岐の多い週だけ分母が膨らみ、偽のトレンドが出る
2. **判定できないときに判定しないこと**。件数が足りないのに差を読むのが、この種の指標で
   最もありがちな誤りである
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import friction_trend as ft  # noqa: E402


# ---------------------------------------------------------------- 重複排除


def make_session(tmp_path, name, records):
    path = tmp_path / name
    path.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in records), encoding="utf-8")
    return path


def prompt_record(uuid, text, stamp="2026-08-01T00:00:00Z"):
    return {"type": "user", "uuid": uuid, "timestamp": stamp,
            "message": {"role": "user", "content": text}}


def test_同じuuidは複数ファイルにあっても1件だけ数える(monkeypatch, tmp_path):
    shared = [prompt_record("u1", "違う"), prompt_record("u2", "続けて")]
    make_session(tmp_path, "a.jsonl", shared)
    # フォークしたセッション: 同じレコードを引き継ぎ、続きを持つ
    make_session(tmp_path, "b.jsonl", shared + [prompt_record("u3", "ありがとう")])
    monkeypatch.setattr(ft, "transcript_dirs", lambda _: [str(tmp_path)])

    prompts = ft.collect("(未使用)")
    assert len(prompts) == 3  # 2 + 1。重複した2件は数えない
    assert sum(1 for p in prompts if p["kinds"]) == 1


def test_uuidもtimestampも無いレコードは数えない(monkeypatch, tmp_path):
    make_session(tmp_path, "a.jsonl", [
        {"type": "user", "message": {"role": "user", "content": "違う"}},              # uuid無し
        {"type": "user", "uuid": "u1", "message": {"role": "user", "content": "違う"}},  # timestamp無し
    ])
    monkeypatch.setattr(ft, "transcript_dirs", lambda _: [str(tmp_path)])
    assert ft.collect("(未使用)") == []


def test_人間の発話でないものは数えない(monkeypatch, tmp_path):
    make_session(tmp_path, "a.jsonl", [
        prompt_record("u1", "<task-notification>違う</task-notification>"),
        prompt_record("u2", "本当に違う"),
    ])
    monkeypatch.setattr(ft, "transcript_dirs", lambda _: [str(tmp_path)])
    prompts = ft.collect("(未使用)")
    assert len(prompts) == 1


# ---------------------------------------------------------------- 統計


def test_同じ比率ならp値は1に近い():
    assert ft.two_proportion_p(10, 100, 10, 100) == 1.0


def test_はっきり違えばp値は小さい():
    assert ft.two_proportion_p(5, 500, 100, 500) < 0.001


def test_分母がゼロでも落ちない():
    assert ft.two_proportion_p(0, 0, 3, 100) == 1.0
    assert ft.two_proportion_p(0, 100, 0, 0) == 1.0


def test_必要件数は差が小さいほど増える():
    p = 0.038
    assert ft.required_per_arm(p, p * 3) < ft.required_per_arm(p, p * 2) < ft.required_per_arm(p, p * 1.5)


def test_必要件数が既知の値と合う():
    # 3.8% → 1.9%（半減）を両側5%・検出力80%で検出するには片側およそ1200件
    assert 1100 < ft.required_per_arm(0.0379, 0.0379 / 2) < 1300


def test_差がゼロなら必要件数は無限():
    assert ft.required_per_arm(0.04, 0.04) == math.inf


def test_件数が増えるほど小さな悪化を検出できる():
    p = 0.038
    assert ft.min_detectable_ratio(p, 2000) < ft.min_detectable_ratio(p, 500) < ft.min_detectable_ratio(p, 100)


def test_件数が無いときは何も検出できない():
    assert ft.min_detectable_ratio(0.038, 0) == math.inf
    assert ft.min_detectable_ratio(0.0, 1000) == math.inf


def test_実測の件数では2倍の悪化すら検出できない():
    """このリポジトリの実測（片側150件・摩擦率3.3%）が警報の閾値に届いていないこと。

    届いてしまったらこのテストは壊れてよい——そのときは判定を出してよい状態になっている。
    """
    assert ft.min_detectable_ratio(10 / 300, 150) > ft.ALARM_RATIO
