"""Zet de boodschappen van het vastgezette menu op de Keep-lijst. Draait in GitHub Actions.

Gebruik: python -m keep_sync.run <data_dir>   (env: KEEP_EMAIL, KEEP_MASTER_TOKEN, KEEP_DEVICE_ID, optioneel KEEP_LIST_TITLE)
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Protocol
from zoneinfo import ZoneInfo

from keep_sync.diff import Item, Wens, clear_ids, next_state, plan_changes

TZ = ZoneInfo("Europe/Amsterdam")


class KeepList(Protocol):
    id: str

    def items(self) -> list[Item]: ...
    def add(self, text: str) -> str: ...
    def delete(self, item_id: str) -> None: ...
    def save(self) -> None: ...


def desired_lines(menu: dict | None) -> list[Wens]:
    if not menu:
        return []
    ronde = menu.get("ronde", "")
    return list(dict.fromkeys((ronde, tekst) for tekst in menu.get("boodschappen", [])))


def _read(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
    except json.JSONDecodeError:
        return None


def _write(data_dir: Path, name: str, content: dict) -> None:
    path = data_dir / "weekmenu" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sync(data_dir: Path, keep: KeepList, now: datetime) -> dict:
    state = _read(data_dir / "weekmenu" / "keep-state.json") or {}
    menu_pad = data_dir / "weekmenu" / "menu.json"
    menu = _read(menu_pad)
    if menu_pad.exists() and (menu is None or menu.get("versie") != 2):
        # Nooit op een onleesbaar menu handelen: dat zou alle open app-regels weghalen.
        status = {"tijd": now.isoformat(), "ok": False, "melding": "menu.json is onleesbaar of heeft een oud formaat; Keep is niet aangepast.", "weken": []}
        _write(data_dir, "keep-status.json", status)
        return status
    same_list = state.get("lijst_id") == keep.id
    own: dict[str, dict] = state.get("regels", {}) if same_list else {}
    own = {i: r for i, r in own.items() if isinstance(r, dict) and "ronde" in r}  # oud formaat telt niet
    leeggemaakt = state.get("leeggemaakt") if same_list else None

    items = keep.items()
    leegmaken_op = (menu or {}).get("leegmakenOp")
    if leegmaken_op and (leeggemaakt is None or leegmaken_op > leeggemaakt):
        weg = clear_ids(own, items)
        for item_id in weg:
            keep.delete(item_id)
        print(f"leeggemaakt: {len(weg)} regels")
        own, leeggemaakt = {}, leegmaken_op
        items = [i for i in items if i.id not in set(weg)]

    changes = plan_changes(desired_lines(menu), own, items)
    for item_id in changes.delete_ids:
        keep.delete(item_id)
    added = {keep.add(tekst): (ronde, tekst) for ronde, tekst in changes.add}
    keep.save()
    if added:
        print(f"toegevoegd: {json.dumps(added, ensure_ascii=False)}")  # vangnet als de state-commit faalt

    _write(data_dir, "keep-state.json", {"lijst_id": keep.id, "leeggemaakt": leeggemaakt, "regels": next_state(own, changes, added)})
    status = {"tijd": now.isoformat(), "ok": True, "melding": "", "weken": []}
    _write(data_dir, "keep-status.json", status)
    return status


class GkeepList:
    """Echte Keep-lijst via gkeepapi. Alleen de niet-gearchiveerde, niet-verwijderde lijst met de titel."""

    def __init__(self, email: str, master_token: str, device_id: str | None, title: str):
        import gkeepapi

        self._keep = gkeepapi.Keep()
        self._keep.authenticate(email, master_token, device_id=device_id)
        hits = [
            n for n in self._keep.all()
            if isinstance(n, gkeepapi.node.List) and n.title.strip().lower() == title.lower() and not n.trashed and not n.archived
        ]
        if len(hits) != 1:
            raise RuntimeError(f"verwacht precies 1 lijst '{title}', gevonden: {len(hits)}")
        self._list = hits[0]
        self.id = self._list.id

    def items(self) -> list[Item]:
        return [Item(i.id, i.text, i.checked) for i in self._list.items]

    def add(self, text: str) -> str:
        return self._list.add(text, False).id

    def delete(self, item_id: str) -> None:
        for i in self._list.items:
            if i.id == item_id:
                i.delete()

    def save(self) -> None:
        self._keep.sync()


def main() -> int:
    data_dir = Path(sys.argv[1])
    now = datetime.now(TZ)
    try:
        keep = GkeepList(
            os.environ["KEEP_EMAIL"],
            os.environ["KEEP_MASTER_TOKEN"],
            os.environ.get("KEEP_DEVICE_ID") or None,
            os.environ.get("KEEP_LIST_TITLE", "boodschappenlijst"),
        )
        status = sync(data_dir, keep, now)
        if not status["ok"]:
            print(f"Keep niet bijgewerkt: {status['melding']}", file=sys.stderr)
            return 1
        print("Keep bijgewerkt")
        return 0
    except Exception as e:  # elke fout zichtbaar maken, zonder geheimen
        melding = f"{type(e).__name__}: {e}"
        for secret in (os.environ.get("KEEP_MASTER_TOKEN"), os.environ.get("KEEP_EMAIL")):
            if secret:
                melding = melding.replace(secret, "***")
        _write(data_dir, "keep-status.json", {"tijd": now.isoformat(), "ok": False, "melding": melding, "weken": []})
        print(f"Keep bijwerken mislukt: {melding}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
