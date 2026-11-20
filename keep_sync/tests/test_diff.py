from keep_sync.diff import Changes, Item, clear_ids, next_state, plan_changes

R = "2026-11-21T10:00:00.000Z"
R2 = "2026-11-28T10:00:00.000Z"


def own(**regels):
    return {i: {"ronde": r, "tekst": t} for i, (r, t) in regels.items()}


def test_new_wishes_are_added():
    ch = plan_changes([(R, "Melk"), (R, "Ui 2")], {}, [Item("x", "Brood", False)])
    assert ch.add == [(R, "Melk"), (R, "Ui 2")] and ch.delete_ids == [] and ch.state_ids == []


def test_own_open_line_still_wanted_is_kept():
    ch = plan_changes([(R, "Melk")], own(a=(R, "Melk")), [Item("a", "Melk", False)])
    assert ch.add == [] and ch.delete_ids == [] and ch.state_ids == ["a"]


def test_checked_line_same_round_is_not_readded_and_stays_in_state():
    ch = plan_changes([(R, "Melk")], own(a=(R, "Melk")), [Item("a", "Melk", True)])
    assert ch.add == [] and ch.delete_ids == [] and ch.state_ids == ["a"]


def test_checked_line_old_round_does_not_satisfy_new_round():
    ch = plan_changes([(R2, "Melk")], own(a=(R, "Melk")), [Item("a", "Melk", True)])
    assert ch.add == [(R2, "Melk")] and ch.delete_ids == [] and ch.state_ids == ["a"]


def test_unwanted_open_line_is_deleted_and_forgotten():
    ch = plan_changes([], own(a=(R, "Melk")), [Item("a", "Melk", False)])
    assert ch.delete_ids == ["a"] and ch.state_ids == []


def test_unwanted_checked_line_stays_in_keep_and_state():
    ch = plan_changes([], own(a=(R, "Melk")), [Item("a", "Melk", True)])
    assert ch.delete_ids == [] and ch.state_ids == ["a"]


def test_unwanted_edited_line_stays_in_keep_but_leaves_state():
    ch = plan_changes([], own(a=(R, "Melk")), [Item("a", "Melk halfvol", False)])
    assert ch.delete_ids == [] and ch.state_ids == []


def test_missing_own_line_satisfies_wish_while_wanted_and_is_forgotten_after():
    wanted = plan_changes([(R, "Melk")], own(a=(R, "Melk")), [])
    assert wanted.add == [] and wanted.state_ids == ["a"]
    unwanted = plan_changes([], own(a=(R, "Melk")), [])
    assert unwanted.delete_ids == [] and unwanted.state_ids == []


def test_other_peoples_lines_never_touched():
    ch = plan_changes([], {}, [Item("b", "Melk", False)])
    assert ch.delete_ids == [] and ch.add == []


def test_duplicate_own_lines_keep_first_delete_other_open():
    ch = plan_changes([(R, "Melk")], own(a=(R, "Melk"), b=(R, "Melk")), [Item("a", "Melk", False), Item("b", "Melk", False)])
    assert ch.state_ids == ["a"] and ch.delete_ids == ["b"]


def test_duplicate_wishes_added_once():
    assert plan_changes([(R, "Melk"), (R, "Melk")], {}, []).add == [(R, "Melk")]


def test_clear_ids_removes_open_and_checked_not_edited_not_missing():
    o = own(a=(R, "Melk"), b=(R, "Kaas"), c=(R, "Ui"), d=(R, "Brood"))
    items = [Item("a", "Melk", False), Item("b", "Kaas", True), Item("c", "Ui rood", False)]
    assert clear_ids(o, items) == ["a", "b"]


def test_next_state_keeps_state_ids_and_adds_new():
    o = own(a=(R, "Melk"), b=(R, "Ui"))
    ch = Changes(add=[(R, "Peper")], delete_ids=["b"], state_ids=["a"])
    assert next_state(o, ch, {"n": (R, "Peper")}) == own(a=(R, "Melk"), n=(R, "Peper"))
