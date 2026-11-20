import json
from datetime import date, datetime
from pathlib import Path

import pytest

from keep_sync import run
from keep_sync.diff import Item

TODAY = date(2026, 11, 23)  # maandag, week 2026-W48
NOW = datetime(2026, 11, 23, 9, 0)


class FakeKeepList:
    def __init__(self, list_id="L1", items=None):
        self.id = list_id
        self._items = list(items or [])
        self._n = 0
        self.saved = 0

    def items(self):
        return list(self._items)

    def add(self, text):
        self._n += 1
        item = Item(f"new{self._n}", text, False)
        self._items.append(item)
        return item.id

    def delete(self, item_id):
        self._items = [i for i in self._items if i.id != item_id]

    def save(self):
        self.saved += 1

    def texts(self):
        return [i.text for i in self._items]


def write_plan(data: Path, week: str, lines: list[str], status: str = "vastgezet"):
    d = data / "weekmenu" / "plannen"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{week}.json").write_text(json.dumps({"week": week, "status": status, "slots": [], "boodschappen": lines}))


def read(data: Path, name: str):
    return json.loads((data / "weekmenu" / name).read_text())


def test_isoweek():
    assert run.isoweek(date(2026, 11, 20)) == "2026-W47"
    assert run.isoweek(date(2027, 1, 1)) == "2026-W53"


def test_desired_lines_ignores_past_weeks_and_concepts(tmp_path):
    write_plan(tmp_path, "2026-W47", ["Oud"])
    write_plan(tmp_path, "2026-W48", ["Melk", "Ui 2"])
    write_plan(tmp_path, "2026-W49", ["Melk", "Kaas"])
    write_plan(tmp_path, "2026-W50", ["Concept"], status="concept")
    lines, weeks = run.desired_lines(tmp_path / "weekmenu" / "plannen", TODAY)
    assert lines == ["Melk", "Ui 2", "Kaas"]
    assert weeks == ["2026-W48", "2026-W49"]


def test_desired_lines_without_plans_dir_is_empty(tmp_path):
    assert run.desired_lines(tmp_path / "weekmenu" / "plannen", TODAY) == ([], [])


def test_sync_adds_lines_and_records_state(tmp_path):
    write_plan(tmp_path, "2026-W48", ["Melk", "Ui 2"])
    keep = FakeKeepList(items=[Item("x", "Brood", False)])
    run.sync(tmp_path, keep, TODAY, NOW)
    assert keep.texts() == ["Brood", "Melk", "Ui 2"]
    assert read(tmp_path, "keep-state.json") == {"lijst_id": "L1", "regels": {"new1": "Melk", "new2": "Ui 2"}}
    assert keep.saved >= 1


def test_sync_twice_is_idempotent(tmp_path):
    write_plan(tmp_path, "2026-W48", ["Melk"])
    keep = FakeKeepList()
    run.sync(tmp_path, keep, TODAY, NOW)
    run.sync(tmp_path, keep, TODAY, NOW)
    assert keep.texts() == ["Melk"]
    assert read(tmp_path, "keep-state.json")["regels"] == {"new1": "Melk"}


def test_sync_after_replanning_removes_only_own_open_lines(tmp_path):
    write_plan(tmp_path, "2026-W48", ["Melk", "Kaas"])
    keep = FakeKeepList(items=[Item("x", "Kaas", False)])
    run.sync(tmp_path, keep, TODAY, NOW)
    write_plan(tmp_path, "2026-W48", ["Melk"])
    run.sync(tmp_path, keep, TODAY, NOW)
    assert sorted(keep.texts()) == ["Kaas", "Melk"]  # eigen "Kaas" weg, die van een ander blijft
    assert "x" in [i.id for i in keep.items()]


def test_state_of_another_list_is_ignored(tmp_path):
    (tmp_path / "weekmenu").mkdir()
    (tmp_path / "weekmenu" / "keep-state.json").write_text(json.dumps({"lijst_id": "ANDER", "regels": {"x": "Melk"}}))
    keep = FakeKeepList(items=[Item("x", "Melk", False)])
    run.sync(tmp_path, keep, TODAY, NOW)
    assert keep.texts() == ["Melk"]


def test_status_written_ok(tmp_path):
    write_plan(tmp_path, "2026-W48", ["Melk"])
    status = run.sync(tmp_path, FakeKeepList(), TODAY, NOW)
    assert status == read(tmp_path, "keep-status.json")
    assert status["ok"] is True and status["weken"] == ["2026-W48"] and status["melding"] == ""
    assert status["tijd"].startswith("2026-11-23T09:00")


def test_main_writes_failed_status_on_login_error(tmp_path, monkeypatch):
    monkeypatch.setenv("KEEP_EMAIL", "iemand@example.com")
    monkeypatch.setenv("KEEP_MASTER_TOKEN", "aas_geheim123")

    def boom(*a, **k):
        raise RuntimeError("login mislukt voor token aas_geheim123")

    monkeypatch.setattr(run, "GkeepList", boom)
    monkeypatch.setattr("sys.argv", ["run", str(tmp_path)])
    assert run.main() == 1
    status = read(tmp_path, "keep-status.json")
    assert status["ok"] is False
    assert "login mislukt" in status["melding"]
    assert "aas_geheim123" not in status["melding"]
