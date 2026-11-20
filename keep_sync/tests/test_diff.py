from keep_sync.diff import Changes, Item, next_state, plan_changes


def test_empty_state_adds_everything():
    ch = plan_changes(["Melk", "Ui 2 stuk"], {}, [Item("x", "Brood", False)])
    assert ch.add == ["Melk", "Ui 2 stuk"] and ch.delete_ids == []


def test_own_unchecked_line_still_wanted_is_kept_not_readded():
    ch = plan_changes(["Melk"], {"a": "Melk"}, [Item("a", "Melk", False)])
    assert ch.add == [] and ch.delete_ids == [] and ch.keep_ids == ["a"]


def test_own_unchecked_line_no_longer_wanted_is_deleted():
    ch = plan_changes([], {"a": "Melk"}, [Item("a", "Melk", False)])
    assert ch.delete_ids == ["a"]


def test_own_checked_line_is_never_deleted_and_not_counted_as_present():
    ch = plan_changes(["Melk"], {"a": "Melk"}, [Item("a", "Melk", True)])
    assert ch.delete_ids == [] and ch.add == ["Melk"]


def test_other_peoples_lines_are_never_touched_even_with_same_text():
    ch = plan_changes([], {}, [Item("b", "Melk", False)])
    assert ch.delete_ids == [] and ch.add == []


def test_own_line_removed_by_someone_is_ignored():
    ch = plan_changes(["Melk"], {"a": "Melk"}, [])
    assert ch.add == ["Melk"] and ch.delete_ids == []


def test_own_line_edited_by_someone_is_left_alone():
    ch = plan_changes(["Melk"], {"a": "Melk"}, [Item("a", "Melk halfvol", False)])
    assert ch.delete_ids == [] and ch.add == ["Melk"]


def test_duplicate_desired_lines_added_once():
    assert plan_changes(["Melk", "Melk"], {}, []).add == ["Melk"]


def test_next_state_drops_checked_missing_edited_and_adds_new():
    own = {"a": "Melk", "b": "Ui", "c": "Kaas", "d": "Brood"}
    items = [Item("a", "Melk", False), Item("b", "Ui", True), Item("d", "Brood bruin", False)]
    ch = Changes(add=["Peper"], delete_ids=[], keep_ids=["a"])
    assert next_state(own, ch, {"n": "Peper"}, items) == {"a": "Melk", "n": "Peper"}
