"""Pure logica: welke regels moet ffsjeffe op de Keep-lijst toevoegen of weghalen.

De app raakt alleen regels aan die hij zelf heeft toegevoegd (`own`: id -> tekst zoals toegevoegd).
Een eigen regel telt alleen als "aanwezig" zolang hij bestaat, niet is afgevinkt en zijn tekst
ongewijzigd is. Afgevinkte of door iemand bewerkte eigen regels worden losgelaten: nooit verwijderd.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Item:
    id: str
    text: str
    checked: bool


@dataclass(frozen=True)
class Changes:
    add: list[str]
    delete_ids: list[str]
    keep_ids: list[str]


def _live_own(own: dict[str, str], items: list[Item]) -> dict[str, str]:
    """Eigen regels die nog bestaan, open zijn en niet bewerkt: id -> tekst."""
    return {i.id: i.text for i in items if i.id in own and not i.checked and i.text == own[i.id]}


def plan_changes(desired: list[str], own: dict[str, str], items: list[Item]) -> Changes:
    wanted = list(dict.fromkeys(desired))
    live = _live_own(own, items)
    keep_ids: list[str] = []
    present: set[str] = set()
    delete_ids: list[str] = []
    for item_id, text in live.items():
        if text in wanted and text not in present:
            keep_ids.append(item_id)
            present.add(text)
        else:
            delete_ids.append(item_id)
    add = [t for t in wanted if t not in present]
    return Changes(add=add, delete_ids=delete_ids, keep_ids=keep_ids)


def next_state(own: dict[str, str], changes: Changes, added: dict[str, str], items: list[Item]) -> dict[str, str]:
    live = _live_own(own, items)
    state = {i: live[i] for i in changes.keep_ids if i in live}
    state.update(added)
    return state
