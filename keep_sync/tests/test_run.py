import json
from datetime import datetime
from pathlib import Path

from keep_sync import run
from keep_sync.diff import Item

NOW = datetime(2026, 11, 23, 9, 0)
R = "2026-11-21T10:00:00.000Z"
R2 = "2026-11-28T10:00:00.000Z"


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

    def check_all(self):
        self._items = [Item(i.id, i.text, True) for i in self._items]


def write_menu(data: Path, lines, ronde=R, leegmaken_op=None):
    d = data / "weekmenu"
    d.mkdir(parents=True, exist_ok=True)
    menu = {"versie": 2, "ronde": ronde, "gerechten": [], "boodschappen": lines, "vastgezetOp": ronde,
            "door": "test", "leegmakenOp": leegmaken_op, "laatstGegeten": {}}
    (d / "menu.json").write_text(json.dumps(menu))


def read(data: Path, name: str):
    return json.loads((data / "weekmenu" / name).read_text())


def test_desired_lines_from_menu():
    assert run.desired_lines({"ronde": R, "boodschappen": ["Melk", "Ui 2", "Melk"]}) == [(R, "Melk"), (R, "Ui 2")]


def test_desired_lines_none_or_empty():
    assert run.desired_lines(None) == []
    assert run.desired_lines({"ronde": R, "boodschappen": []}) == []


def test_sync_adds_and_records_round(tmp_path):
    write_menu(tmp_path, ["Melk", "Ui 2"])
    keep = FakeKeepList(items=[Item("x", "Brood", False)])
    status = run.sync(tmp_path, keep, NOW)
    assert keep.texts() == ["Brood", "Melk", "Ui 2"]
    state = read(tmp_path, "keep-state.json")
    assert state["regels"] == {"new1": {"ronde": R, "tekst": "Melk"}, "new2": {"ronde": R, "tekst": "Ui 2"}}
    assert state["lijst_id"] == "L1" and state["leeggemaakt"] is None
    assert status["ok"] is True and status == read(tmp_path, "keep-status.json")


def test_sync_without_menu_does_nothing(tmp_path):
    keep = FakeKeepList(items=[Item("x", "Brood", False)])
    run.sync(tmp_path, keep, NOW)
    assert keep.texts() == ["Brood"]


def test_sync_twice_is_idempotent(tmp_path):
    write_menu(tmp_path, ["Melk"])
    keep = FakeKeepList()
    run.sync(tmp_path, keep, NOW)
    run.sync(tmp_path, keep, NOW)
    assert keep.texts() == ["Melk"]


def test_bought_lines_do_not_come_back_on_repin_same_round(tmp_path):
    write_menu(tmp_path, ["Melk", "Kaas"])
    keep = FakeKeepList()
    run.sync(tmp_path, keep, NOW)
    keep.check_all()
    write_menu(tmp_path, ["Melk", "Kaas", "Ui 2"])
    run.sync(tmp_path, keep, NOW)
    assert [i.text for i in keep.items() if not i.checked] == ["Ui 2"]


def test_new_round_readds_line_bought_last_round(tmp_path):
    write_menu(tmp_path, ["Melk"])
    keep = FakeKeepList()
    run.sync(tmp_path, keep, NOW)
    keep.check_all()
    write_menu(tmp_path, ["Melk"], ronde=R2)
    run.sync(tmp_path, keep, NOW)
    assert [i.text for i in keep.items() if not i.checked] == ["Melk"]


def test_clear_removes_all_own_lines_including_checked_then_records_leeggemaakt(tmp_path):
    write_menu(tmp_path, ["Melk", "Kaas"])
    keep = FakeKeepList()
    run.sync(tmp_path, keep, NOW)
    keep._items[0] = Item(keep._items[0].id, "Melk", True)  # melk gekocht
    write_menu(tmp_path, [], leegmaken_op=R2)
    run.sync(tmp_path, keep, NOW)
    assert keep.texts() == []
    state = read(tmp_path, "keep-state.json")
    assert state["regels"] == {} and state["leeggemaakt"] == R2
    keep._items.append(Item("x", "Brood", False))
    run.sync(tmp_path, keep, NOW)  # zelfde leegmakenOp: niets meer
    assert keep.texts() == ["Brood"]


def test_clear_keeps_edited_and_other_peoples_lines(tmp_path):
    write_menu(tmp_path, ["Melk", "Kaas"])
    keep = FakeKeepList(items=[Item("x", "Brood", False)])
    run.sync(tmp_path, keep, NOW)
    keep._items = [Item(i.id, "Kaas jong" if i.text == "Kaas" else i.text, i.checked) for i in keep._items]
    write_menu(tmp_path, [], leegmaken_op=R2)
    run.sync(tmp_path, keep, NOW)
    assert sorted(keep.texts()) == ["Brood", "Kaas jong"]


def test_old_v1_state_is_ignored(tmp_path):
    (tmp_path / "weekmenu").mkdir()
    (tmp_path / "weekmenu" / "keep-state.json").write_text(json.dumps({"lijst_id": "L1", "regels": {"x": {"week": "2026-W48", "tekst": "Melk"}}}))
    write_menu(tmp_path, [], leegmaken_op=R2)
    keep = FakeKeepList(items=[Item("x", "Melk", False)])
    run.sync(tmp_path, keep, NOW)
    assert keep.texts() == ["Melk"]


def test_state_of_another_list_is_ignored(tmp_path):
    (tmp_path / "weekmenu").mkdir()
    (tmp_path / "weekmenu" / "keep-state.json").write_text(json.dumps({"lijst_id": "ANDER", "leeggemaakt": None, "regels": {"x": {"ronde": R, "tekst": "Melk"}}}))
    write_menu(tmp_path, [])
    keep = FakeKeepList(items=[Item("x", "Melk", False)])
    run.sync(tmp_path, keep, NOW)
    assert keep.texts() == ["Melk"]


def test_main_writes_failed_status_on_login_error(tmp_path, monkeypatch):
    monkeypatch.setenv("KEEP_EMAIL", "iemand@example.com")
    monkeypatch.setenv("KEEP_MASTER_TOKEN", "aas_geheim123")

    def boom(*a, **k):
        raise RuntimeError("login mislukt voor token aas_geheim123")

    monkeypatch.setattr(run, "GkeepList", boom)
    monkeypatch.setattr("sys.argv", ["run", str(tmp_path)])
    assert run.main() == 1
    status = read(tmp_path, "keep-status.json")
    assert status["ok"] is False and "login mislukt" in status["melding"] and "aas_geheim123" not in status["melding"]


def _met_eigen_regel(tmp_path):
    (tmp_path / "weekmenu").mkdir(parents=True, exist_ok=True)
    (tmp_path / "weekmenu" / "keep-state.json").write_text(json.dumps({"lijst_id": "L1", "leeggemaakt": None, "regels": {"a": {"ronde": R, "tekst": "Melk"}}}))
    return FakeKeepList(items=[Item("a", "Melk", False), Item("x", "Brood", False)])


def test_corrupt_menu_touches_nothing_and_reports(tmp_path):
    keep = _met_eigen_regel(tmp_path)
    (tmp_path / "weekmenu" / "menu.json").write_text("{kapot")
    status = run.sync(tmp_path, keep, NOW)
    assert keep.texts() == ["Melk", "Brood"]
    assert read(tmp_path, "keep-state.json")["regels"] == {"a": {"ronde": R, "tekst": "Melk"}}
    assert status["ok"] is False and "menu.json" in status["melding"]


def test_v1_menu_touches_nothing(tmp_path):
    keep = _met_eigen_regel(tmp_path)
    (tmp_path / "weekmenu" / "menu.json").write_text(json.dumps({"week": "2026-W48"}))
    run.sync(tmp_path, keep, NOW)
    assert keep.texts() == ["Melk", "Brood"]
