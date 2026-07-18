#!/usr/bin/env python3
"""govlint.py の単体テスト（meta/adr/0014の宿題）。

方針:
  - 標準ライブラリの unittest のみを使う。govlint.py 自身が「依存なし
    （標準ライブラリのみ）」を掲げているため、テストも同じ制約に合わせ、
    CIにpipインストール手順を追加せずに走らせられるようにする。
  - govlint.ROOT を一時ディレクトリに差し替え、合成フィクスチャで検証する
    （実リポジトリのADR/friction-log/契約は増減し続けるため、それに結合した
    アサーションは書かない＝壊れやすいテストを避ける）。
  - govlint.errors / govlint.reports はモジュールグローバルな蓄積リストの
    ため、各テストの前後でクリアする（相互汚染を防ぐ）。

実行方法:
    python -m unittest meta.tools.test_govlint -v
  または（このディレクトリから）:
    python -m unittest test_govlint -v
  または（pytestが利用可能な環境では、そのまま収集・実行できる）:
    pytest meta/tools/test_govlint.py -v
"""
from __future__ import annotations

import importlib.util
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

_MODULE_PATH = Path(__file__).resolve().parent / "govlint.py"
_spec = importlib.util.spec_from_file_location("govlint_under_test", _MODULE_PATH)
govlint = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(govlint)


def dedent(text: str) -> str:
    """テスト内の複数行フィクスチャを、行頭0桁に揃えて返す。

    govlintの正規表現（`^## FR-...`・`^```yaml` 等）は行頭一致を要求するため、
    Pythonソース内のインデントをそのまま書くと一致しなくなる。
    """
    return textwrap.dedent(text).lstrip("\n")


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


class GovlintTestCase(unittest.TestCase):
    """govlint.ROOT差し替え・グローバル状態のクリアを行う基底クラス。"""

    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self._tmpdir.name)
        self._orig_root = govlint.ROOT
        govlint.ROOT = self.root
        govlint.errors.clear()
        govlint.reports.clear()

    def tearDown(self) -> None:
        govlint.ROOT = self._orig_root
        govlint.errors.clear()
        govlint.reports.clear()
        self._tmpdir.cleanup()


# ---------------------------------------------------------------- parse_block / read_frontmatter
class TestParseBlock(unittest.TestCase):
    def test_scalar_values(self) -> None:
        out = govlint.parse_block('id: FR-001\nstatus: 対応済み\n')
        self.assertEqual(out, {"id": "FR-001", "status": "対応済み"})

    def test_quoted_scalar_is_unquoted(self) -> None:
        out = govlint.parse_block('approved_by: "本PRのマージをもって承認"\n')
        self.assertEqual(out["approved_by"], "本PRのマージをもって承認")

    def test_null_variants(self) -> None:
        out = govlint.parse_block("a: null\nb: ~\nc:\n")
        self.assertIsNone(out["a"])
        self.assertIsNone(out["b"])
        self.assertIsNone(out["c"])

    def test_list_value(self) -> None:
        out = govlint.parse_block('pushed_to: [meta/adr/0001-x.md, meta/adr/0002-y.md]\n')
        self.assertEqual(out["pushed_to"], ["meta/adr/0001-x.md", "meta/adr/0002-y.md"])

    def test_empty_list(self) -> None:
        out = govlint.parse_block("supersedes: []\n")
        self.assertEqual(out["supersedes"], [])

    def test_comment_and_blank_lines_ignored(self) -> None:
        out = govlint.parse_block("# comment\n\nid: FR-001\n")
        self.assertEqual(out, {"id": "FR-001"})

    def test_non_matching_line_ignored(self) -> None:
        out = govlint.parse_block("not a key value line\nid: FR-001\n")
        self.assertEqual(out, {"id": "FR-001"})


class TestReadFrontmatter(unittest.TestCase):
    def test_valid_frontmatter(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x.md"
            p.write_text("---\nid: 0001\nscope: meta\n---\n\n# body\n", encoding="utf-8")
            fm = govlint.read_frontmatter(p)
            self.assertEqual(fm, {"id": "0001", "scope": "meta"})

    def test_missing_frontmatter_returns_none(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x.md"
            p.write_text("# no frontmatter here\n", encoding="utf-8")
            self.assertIsNone(govlint.read_frontmatter(p))

    def test_unterminated_frontmatter_returns_none(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x.md"
            p.write_text("---\nid: 0001\n\n# no closing fence\n", encoding="utf-8")
            self.assertIsNone(govlint.read_frontmatter(p))


# ---------------------------------------------------------------- ADR
VALID_ADR = dedent(
    """
    ---
    id: 0001
    scope: meta
    status: 承認済み
    date: 2026-01-01
    approved_by: "test"
    supersedes: []
    superseded_by: null
    relates_to: []
    ---

    # ADR-0001: サンプル

    ## 文脈
    本文。
    """
)


class TestCheckAdrs(GovlintTestCase):
    def test_valid_adr_no_errors(self) -> None:
        write(self.root / "meta" / "adr" / "0001-sample.md", VALID_ADR)
        adrs = govlint.check_adrs()
        self.assertEqual(govlint.errors, [])
        self.assertIn("meta#0001", adrs)

    def test_missing_frontmatter_is_error(self) -> None:
        write(self.root / "meta" / "adr" / "0001-sample.md", "# no frontmatter\n")
        govlint.check_adrs()
        self.assertTrue(any("frontmatterが無い" in e for e in govlint.errors))

    def test_missing_required_field_is_error(self) -> None:
        content = VALID_ADR.replace("date: 2026-01-01\n", "")
        write(self.root / "meta" / "adr" / "0001-sample.md", content)
        govlint.check_adrs()
        self.assertTrue(any("'date' が無い" in e for e in govlint.errors))

    def test_invalid_status_is_error(self) -> None:
        content = VALID_ADR.replace("status: 承認済み", "status: 却下")
        write(self.root / "meta" / "adr" / "0001-sample.md", content)
        govlint.check_adrs()
        self.assertTrue(any("status='却下' は不正" in e for e in govlint.errors))

    def test_invalid_date_format_is_error(self) -> None:
        content = VALID_ADR.replace("date: 2026-01-01", "date: 2026/01/01")
        write(self.root / "meta" / "adr" / "0001-sample.md", content)
        govlint.check_adrs()
        self.assertTrue(any("YYYY-MM-DD形式でない" in e for e in govlint.errors))

    def test_id_mismatch_with_filename_is_error(self) -> None:
        content = VALID_ADR.replace("id: 0001", "id: 0002")
        write(self.root / "meta" / "adr" / "0001-sample.md", content)
        govlint.check_adrs()
        self.assertTrue(any("採番 '0001' と一致しない" in e for e in govlint.errors))

    def test_duplicate_id_in_scope_is_error(self) -> None:
        write(self.root / "meta" / "adr" / "0001-a.md", VALID_ADR)
        write(self.root / "meta" / "adr" / "0001-b.md", VALID_ADR)
        govlint.check_adrs()
        self.assertTrue(any("id が scope 内で重複している" in e for e in govlint.errors))

    def test_project_adr_dir_is_scanned(self) -> None:
        content = VALID_ADR.replace("scope: meta", "scope: reservation-system")
        write(self.root / "projects" / "reservation-system" / "adr" / "0001-sample.md", content)
        adrs = govlint.check_adrs()
        self.assertEqual(govlint.errors, [])
        self.assertIn("reservation-system#0001", adrs)


class TestCheckAdrLinks(GovlintTestCase):
    def test_supersedes_target_missing_is_error(self) -> None:
        content = VALID_ADR.replace("supersedes: []", "supersedes: [9999]")
        write(self.root / "meta" / "adr" / "0001-sample.md", content)
        adrs = govlint.check_adrs()
        govlint.check_adr_links(adrs)
        self.assertTrue(any("supersedes '9999' が同じscope" in e for e in govlint.errors))

    def test_asymmetric_supersede_is_error(self) -> None:
        old_adr = VALID_ADR.replace("status: 承認済み", "status: superseded").replace(
            "superseded_by: null", "superseded_by: 0002"
        )
        new_adr = VALID_ADR.replace("id: 0001", "id: 0002").replace(
            "supersedes: []", "supersedes: [0001]"
        )
        write(self.root / "meta" / "adr" / "0001-old.md", old_adr)
        write(self.root / "meta" / "adr" / "0002-new.md", new_adr)
        adrs = govlint.check_adrs()
        govlint.check_adr_links(adrs)
        # old側のsuperseded_byは0002を指しているので対称。エラー無しの陽性ケース。
        self.assertEqual(govlint.errors, [])

    def test_missing_superseded_by_back_reference_is_error(self) -> None:
        # 0002が0001をsupersedesするが、0001のsuperseded_byが設定されていない(非対称)
        old_adr = VALID_ADR  # superseded_by: null のまま、status: 承認済みのまま
        new_adr = VALID_ADR.replace("id: 0001", "id: 0002").replace(
            "supersedes: []", "supersedes: [0001]"
        )
        write(self.root / "meta" / "adr" / "0001-old.md", old_adr)
        write(self.root / "meta" / "adr" / "0002-new.md", new_adr)
        adrs = govlint.check_adrs()
        govlint.check_adr_links(adrs)
        self.assertTrue(any("supersede関係が非対称" in e for e in govlint.errors))
        self.assertTrue(any("status が 'superseded' でない" in e for e in govlint.errors))

    def test_superseded_by_target_missing_is_error(self) -> None:
        content = VALID_ADR.replace("status: 承認済み", "status: superseded").replace(
            "superseded_by: null", "superseded_by: 9999"
        )
        write(self.root / "meta" / "adr" / "0001-sample.md", content)
        adrs = govlint.check_adrs()
        govlint.check_adr_links(adrs)
        self.assertTrue(any("superseded_by '9999' が同じscope" in e for e in govlint.errors))


# ---------------------------------------------------------------- friction-log
def fr_entry(fr_id: str, *, found_at: str = "人間", status: str = "未対応",
             cause_key: str = "sample-cause", pushed_to: str = "[]") -> str:
    return dedent(
        f"""
        ## {fr_id}: サンプル事象

        ```yaml
        id: {fr_id}
        date: 2026-01-01
        found_at: {found_at}
        cause_category: サンプル
        cause_key: {cause_key}
        pushed_to: {pushed_to}
        status: {status}
        ```

        - 事象: サンプル
        """
    )


class TestCheckFrictionLogs(GovlintTestCase):
    def test_found_at_ai_is_accepted(self) -> None:
        write(
            self.root / "projects" / "reservation-system" / "friction-log.md",
            fr_entry("FR-001", found_at="AI"),
        )
        govlint.check_friction_logs()
        self.assertEqual(govlint.errors, [])

    def test_found_at_invalid_value_is_error(self) -> None:
        write(
            self.root / "projects" / "reservation-system" / "friction-log.md",
            fr_entry("FR-001", found_at="宇宙人"),
        )
        govlint.check_friction_logs()
        self.assertTrue(any("found_at='宇宙人' は不正" in e for e in govlint.errors))

    def test_all_documented_found_at_values_are_accepted(self) -> None:
        for value in ("L1", "L2", "L3", "L4", "L5", "人間", "AI"):
            with self.subTest(found_at=value):
                govlint.errors.clear()
                write(
                    self.root / "projects" / "reservation-system" / "friction-log.md",
                    fr_entry("FR-001", found_at=value),
                )
                govlint.check_friction_logs()
                self.assertEqual(govlint.errors, [], f"found_at={value} が誤って拒否された")

    def test_missing_required_field_is_error(self) -> None:
        content = fr_entry("FR-001").replace("cause_category: サンプル\n", "")
        write(self.root / "projects" / "reservation-system" / "friction-log.md", content)
        govlint.check_friction_logs()
        self.assertTrue(any("'cause_category' が無い" in e for e in govlint.errors))

    def test_invalid_status_is_error(self) -> None:
        write(
            self.root / "projects" / "reservation-system" / "friction-log.md",
            fr_entry("FR-001", status="放置"),
        )
        govlint.check_friction_logs()
        self.assertTrue(any("status='放置' は不正" in e for e in govlint.errors))

    def test_untriaged_status_is_reported_not_errored(self) -> None:
        write(
            self.root / "projects" / "reservation-system" / "friction-log.md",
            fr_entry("FR-001", status="未対応"),
        )
        govlint.check_friction_logs()
        self.assertEqual(govlint.errors, [])
        self.assertTrue(any("未対応のまま" in r for r in govlint.reports))

    def test_duplicate_fr_id_is_error(self) -> None:
        content = fr_entry("FR-001") + "\n---\n\n" + fr_entry("FR-001")
        write(self.root / "projects" / "reservation-system" / "friction-log.md", content)
        govlint.check_friction_logs()
        self.assertTrue(any("FR-001 が重複している" in e for e in govlint.errors))

    def test_heading_without_yaml_block_is_error(self) -> None:
        content = "## FR-001: メタデータ無し\n\n本文のみ。\n"
        write(self.root / "projects" / "reservation-system" / "friction-log.md", content)
        govlint.check_friction_logs()
        self.assertTrue(
            any("FR-001 に機械可読メタデータ" in e for e in govlint.errors)
        )

    def test_pushed_to_missing_target_is_error(self) -> None:
        content = fr_entry("FR-001", pushed_to="[meta/adr/9999-nonexistent.md]")
        write(self.root / "projects" / "reservation-system" / "friction-log.md", content)
        govlint.check_friction_logs()
        self.assertTrue(any("pushed_to 'meta/adr/9999-nonexistent.md' が存在しない" in e for e in govlint.errors))

    def test_pushed_to_existing_target_is_not_error(self) -> None:
        write(self.root / "meta" / "adr" / "0001-target.md", "dummy")
        content = fr_entry("FR-001", pushed_to="[meta/adr/0001-target.md]")
        write(self.root / "projects" / "reservation-system" / "friction-log.md", content)
        govlint.check_friction_logs()
        self.assertEqual(govlint.errors, [])

    def test_cause_key_repeated_twice_is_reported(self) -> None:
        content = (
            fr_entry("FR-001", cause_key="shared-cause")
            + "\n---\n\n"
            + fr_entry("FR-002", cause_key="shared-cause")
        )
        write(self.root / "projects" / "reservation-system" / "friction-log.md", content)
        govlint.check_friction_logs()
        self.assertEqual(govlint.errors, [])
        self.assertTrue(
            any("cause_key 'shared-cause' が 2回 出現" in r for r in govlint.reports)
        )

    def test_cause_key_appearing_once_is_not_reported(self) -> None:
        write(
            self.root / "projects" / "reservation-system" / "friction-log.md",
            fr_entry("FR-001", cause_key="lonely-cause"),
        )
        govlint.check_friction_logs()
        self.assertFalse(any("cause_key" in r for r in govlint.reports))


# ---------------------------------------------------------------- 契約シナリオID
class TestCheckScenarioIds(GovlintTestCase):
    def test_valid_definitions_and_references_no_errors(self) -> None:
        feature = dedent(
            """
            Feature: サンプル

              Scenario Outline: 例
                # RSV-A-01: 基本ケース
                Given 何か
                Examples:
                  | id         | note |
                  | RSV-A-02   | dup  |
            """
        )
        spec = "operationId: RSV-A-01\nx-scenario: RSV-A-02\n"
        write(self.root / "projects" / "reservation-system" / "contracts" / "a.feature", feature)
        write(self.root / "projects" / "reservation-system" / "contracts" / "a.yaml", spec)
        govlint.check_scenario_ids()
        self.assertEqual(govlint.errors, [])

    def test_duplicate_definition_across_features_is_error(self) -> None:
        feature_a = dedent(
            """
            Feature: A
              # RSV-A-01: 定義1
              Given 何か
            """
        )
        feature_b = dedent(
            """
            Feature: B
              # RSV-A-01: 定義2(重複)
              Given 何か
            """
        )
        write(self.root / "projects" / "reservation-system" / "contracts" / "a.feature", feature_a)
        write(self.root / "projects" / "reservation-system" / "contracts" / "b.feature", feature_b)
        govlint.check_scenario_ids()
        self.assertTrue(any("定義が" in e and "重複している" in e for e in govlint.errors))

    def test_retired_id_also_defined_is_error(self) -> None:
        feature = dedent(
            """
            Feature: A
              # RSV-A-99: 復活してはいけないID
              Given 何か

            注記: RSV-A-99は欠番
            """
        )
        write(self.root / "projects" / "reservation-system" / "contracts" / "a.feature", feature)
        govlint.check_scenario_ids()
        self.assertTrue(any("欠番と宣言されているのに定義もされている" in e for e in govlint.errors))

    def test_undefined_reference_is_error(self) -> None:
        feature = dedent(
            """
            Feature: A
              # RSV-A-01: 定義済み
              Given 何か
            """
        )
        spec = "operationId: RSV-A-77\n"
        write(self.root / "projects" / "reservation-system" / "contracts" / "a.feature", feature)
        write(self.root / "projects" / "reservation-system" / "contracts" / "a.yaml", spec)
        govlint.check_scenario_ids()
        self.assertTrue(
            any("参照しているシナリオID RSV-A-77" in e and "定義されていない" in e for e in govlint.errors)
        )

    def test_no_contracts_dir_is_silently_skipped(self) -> None:
        govlint.check_scenario_ids()
        self.assertEqual(govlint.errors, [])


# ---------------------------------------------------------------- main（統合）
class TestMain(GovlintTestCase):
    def test_clean_repo_returns_zero(self) -> None:
        write(self.root / "meta" / "adr" / "0001-sample.md", VALID_ADR)
        write(
            self.root / "projects" / "reservation-system" / "friction-log.md",
            fr_entry("FR-001", found_at="AI"),
        )
        rc = govlint.main()
        self.assertEqual(rc, 0)

    def test_errors_present_returns_one(self) -> None:
        write(
            self.root / "projects" / "reservation-system" / "friction-log.md",
            fr_entry("FR-001", found_at="不正な値"),
        )
        rc = govlint.main()
        self.assertEqual(rc, 1)

    def test_report_only_state_still_returns_zero(self) -> None:
        # cause_keyの2回出現はREPORTのみで、終了コードには影響しない。
        content = (
            fr_entry("FR-001", cause_key="shared-cause")
            + "\n---\n\n"
            + fr_entry("FR-002", cause_key="shared-cause")
        )
        write(self.root / "projects" / "reservation-system" / "friction-log.md", content)
        rc = govlint.main()
        self.assertEqual(rc, 0)
        self.assertTrue(any("shared-cause" in r for r in govlint.reports))


if __name__ == "__main__":
    unittest.main()
