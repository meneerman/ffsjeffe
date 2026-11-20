"""Pure logica: welke regels moet ffsjeffe op de Keep-lijst toevoegen of weghalen.

Een *wens* is (ronde, tekst): één boodschappenregel van het huidige menu.
`own` = regels die de app zelf heeft toegevoegd: keep-item-id -> {"ronde", "tekst"}.

- Een wens is afgehandeld als er een eigen regel met dezelfde (ronde, tekst) bestaat, open,
  afgevinkt, bewerkt of verwijderd. Wat in deze ronde al gekocht is, komt dus niet terug.
- Een eigen regel die niet meer gewenst is: open en onbewerkt -> weg uit Keep en state;
  afgevinkt -> blijft in Keep en state (zodat leegmaken hem later vindt);
  bewerkt -> blijft in Keep, uit de state; verdwenen -> uit de state.
- Leegmaken (`clear_ids`): alle eigen regels die nog bestaan en onbewerkt zijn, open of afgevinkt.
- Regels die de app niet zelf heeft toegevoegd, worden nooit aangeraakt.
"""

from dataclasses import dataclass

Wens = tuple[str, str]  # (ronde, tekst)


@dataclass(frozen=True)
class Item:
    id: str
    text: str
    checked: bool


@dataclass(frozen=True)
class Changes:
    add: list[Wens]
    delete_ids: list[str]
    state_ids: list[str]


def _wens(regel: dict) -> Wens:
    return (regel.get("ronde", ""), regel.get("tekst", ""))


def plan_changes(desired: list[Wens], own: dict[str, dict], items: list[Item]) -> Changes:
    wanted = list(dict.fromkeys(desired))
    wanted_set = set(wanted)
    by_id = {i.id: i for i in items}

    state_ids: list[str] = []
    delete_ids: list[str] = []
    afgehandeld: set[Wens] = set()
    for item_id, regel in own.items():
        w = _wens(regel)
        item = by_id.get(item_id)
        if w in wanted_set and w not in afgehandeld:
            state_ids.append(item_id)
            afgehandeld.add(w)
        elif item is None:
            continue  # verdwenen: vergeten
        elif item.text != w[1]:
            continue  # bewerkt: van iemand anders geworden, vergeten
        elif item.checked:
            state_ids.append(item_id)  # gekocht: laten staan, onthouden voor leegmaken
        else:
            delete_ids.append(item_id)

    add = [w for w in wanted if w not in afgehandeld]
    return Changes(add=add, delete_ids=delete_ids, state_ids=state_ids)


def clear_ids(own: dict[str, dict], items: list[Item]) -> list[str]:
    by_id = {i.id: i for i in items}
    return [i for i, regel in own.items() if i in by_id and by_id[i].text == _wens(regel)[1]]


def next_state(own: dict[str, dict], changes: Changes, added: dict[str, Wens]) -> dict[str, dict]:
    state = {i: dict(own[i]) for i in changes.state_ids}
    state.update({i: {"ronde": r, "tekst": t} for i, (r, t) in added.items()})
    return state
