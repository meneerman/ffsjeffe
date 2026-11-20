"""Pure logica: welke regels moet ffsjeffe op de Keep-lijst toevoegen of weghalen.

Een *wens* is (week, tekst): één boodschappenregel uit het vastgezette plan van die week.
`own` = de regels die de app zelf heeft toegevoegd: keep-item-id -> {"week", "tekst"}.

Regels:
- Een wens die al een eigen regel heeft, is afgehandeld, ook als die regel inmiddels is afgevinkt,
  bewerkt of weggehaald. Zo komt wat al gekocht is niet terug op de lijst.
- Een eigen regel die niet meer gewenst is, wordt alleen verwijderd als hij nog open staat en
  onbewerkt is. Afgevinkte en bewerkte regels blijven altijd staan.
- Regels die de app niet zelf heeft toegevoegd, worden nooit aangeraakt.
"""

from dataclasses import dataclass

Wens = tuple[str, str]  # (week, tekst)


@dataclass(frozen=True)
class Item:
    id: str
    text: str
    checked: bool


@dataclass(frozen=True)
class Changes:
    add: list[Wens]
    delete_ids: list[str]
    keep_ids: list[str]


def _wens(regel: dict) -> Wens:
    return (regel.get("week", ""), regel.get("tekst", ""))


def plan_changes(desired: list[Wens], own: dict[str, dict], items: list[Item]) -> Changes:
    wanted = list(dict.fromkeys(desired))
    wanted_set = set(wanted)
    by_id = {i.id: i for i in items}

    keep_ids: list[str] = []
    delete_ids: list[str] = []
    afgehandeld: set[Wens] = set()
    for item_id, regel in own.items():
        w = _wens(regel)
        item = by_id.get(item_id)
        open_en_onbewerkt = item is not None and not item.checked and item.text == w[1]
        if w in wanted_set and w not in afgehandeld:
            keep_ids.append(item_id)
            afgehandeld.add(w)
        elif open_en_onbewerkt:
            delete_ids.append(item_id)

    add = [w for w in wanted if w not in afgehandeld]
    return Changes(add=add, delete_ids=delete_ids, keep_ids=keep_ids)


def next_state(own: dict[str, dict], changes: Changes, added: dict[str, Wens]) -> dict[str, dict]:
    state = {i: dict(own[i]) for i in changes.keep_ids}
    state.update({i: {"week": w, "tekst": t} for i, (w, t) in added.items()})
    return state
