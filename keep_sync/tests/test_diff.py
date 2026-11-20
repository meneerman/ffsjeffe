from keep_sync.diff import Changes, Item, next_state, plan_changes

W = "2026-W48"
V = "2026-W49"


def own(**regels):
    return {i: {"week": w, "tekst": t} for i, (w, t) in regels.items()}


def test_empty_state_adds_everything():
    ch = plan_changes([(W, "Melk"), (W, "Ui 2")], {}, [Item("x", "Brood", False)])
    assert ch.add == [(W, "Melk"), (W, "Ui 2")] and ch.delete_ids == []


def test_own_unchecked_line_still_wanted_is_kept_not_readded():
    ch = plan_changes([(W, "Melk")], own(a=(W, "Melk")), [Item("a", "Melk", False)])
    assert ch.add == [] and ch.delete_ids == [] and ch.keep_ids == ["a"]


def test_own_unchecked_line_no_longer_wanted_is_deleted():
    ch = plan_changes([], own(a=(W, "Melk")), [Item("a", "Melk", False)])
    assert ch.delete_ids == ["a"] and ch.keep_ids == []


def test_own_checked_line_is_never_deleted_and_never_readded():
    ch = plan_changes([(W, "Melk")], own(a=(W, "Melk")), [Item("a", "Melk", True)])
    assert ch.delete_ids == [] and ch.add == [] and ch.keep_ids == ["a"]


def test_own_checked_line_no_longer_wanted_is_left_alone():
    ch = plan_changes([], own(a=(W, "Melk")), [Item("a", "Melk", True)])
    assert ch.delete_ids == [] and ch.keep_ids == []


def test_other_peoples_lines_are_never_touched_even_with_same_text():
    ch = plan_changes([], {}, [Item("b", "Melk", False)])
    assert ch.delete_ids == [] and ch.add == []


def test_own_line_removed_by_someone_is_not_readded():
    ch = plan_changes([(W, "Melk")], own(a=(W, "Melk")), [])
    assert ch.add == [] and ch.delete_ids == [] and ch.keep_ids == ["a"]


def test_own_line_edited_by_someone_is_left_alone_and_not_readded():
    ch = plan_changes([(W, "Melk")], own(a=(W, "Melk")), [Item("a", "Melk halfvol", False)])
    assert ch.delete_ids == [] and ch.add == []


def test_own_line_edited_and_no_longer_wanted_is_not_deleted():
    ch = plan_changes([], own(a=(W, "Melk")), [Item("a", "Melk halfvol", False)])
    assert ch.delete_ids == []


def test_duplicate_lines_within_a_week_added_once():
    assert plan_changes([(W, "Melk"), (W, "Melk")], {}, []).add == [(W, "Melk")]


def test_same_line_in_two_weeks_is_added_twice():
    assert plan_changes([(W, "Ui 2"), (V, "Ui 2")], {}, []).add == [(W, "Ui 2"), (V, "Ui 2")]


def test_bought_line_of_this_week_does_not_satisfy_next_week():
    ch = plan_changes([(W, "Melk"), (V, "Melk")], own(a=(W, "Melk")), [Item("a", "Melk", True)])
    assert ch.add == [(V, "Melk")]


def test_two_live_own_lines_for_same_wish_keeps_one_deletes_other():
    ch = plan_changes([(W, "Melk")], own(a=(W, "Melk"), b=(W, "Melk")), [Item("a", "Melk", False), Item("b", "Melk", False)])
    assert ch.keep_ids == ["a"] and ch.delete_ids == ["b"]


def test_next_state_keeps_wanted_markers_and_adds_new():
    o = own(a=(W, "Melk"), b=(W, "Ui"), c=(W, "Kaas"))
    ch = Changes(add=[(W, "Peper")], delete_ids=["c"], keep_ids=["a", "b"])
    assert next_state(o, ch, {"n": (W, "Peper")}) == own(a=(W, "Melk"), b=(W, "Ui"), n=(W, "Peper"))
