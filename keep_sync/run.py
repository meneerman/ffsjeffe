"""Zet de boodschappen van vastgezette weekplannen op de Keep-lijst. Draait in GitHub Actions.

Gebruik: python -m keep_sync.run <data_dir>   (env: KEEP_EMAIL, KEEP_MASTER_TOKEN, KEEP_DEVICE_ID, optioneel KEEP_LIST_TITLE)
"""

import json
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Protocol
from zoneinfo import ZoneInfo

from keep_sync.diff import Item, Wens, next_state, plan_changes

TZ = ZoneInfo("Europe/Amsterdam")


class KeepList(Protocol):
    id: str

    def items(self) -> list[Item]: ...
    def add(self, text: str) -> str: ...
    def delete(self, item_id: str) -> None: ...
    def save(self) -> None: ...


def isoweek(d: date) -> str:
    year, week, _ = d.isocalendar()
    return f"{year}-W{week:02d}"


def teplannen_week(today: date) -> str:
    """Zelfde regel als de app: zaterdag en zondag horen bij de volgende week."""
    return isoweek(today + timedelta(days=2) if today.weekday() >= 5 else today)


def desired_lines(plans_dir: Path, today: date) -> tuple[list[Wens], list[str]]:
    current = teplannen_week(today)
    lines: list[Wens] = []
    weeks: list[str] = []
    if not plans_dir.is_dir():
        return [], []
    for path in sorted(plans_dir.glob("*.json")):
        plan = json.loads(path.read_text(encoding="utf-8"))
        if plan.get("status") != "vastgezet" or plan.get("week", "") < current:
            continue
        weeks.append(plan["week"])
        lines.extend((plan["week"], tekst) for tekst in plan.get("boodschappen", []))
    return list(dict.fromkeys(lines)), weeks


def _write(data_dir: Path, name: str, content: dict) -> None:
    path = data_dir / "weekmenu" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sync(data_dir: Path, keep: KeepList, today: date, now: datetime) -> dict:
    state_path = data_dir / "weekmenu" / "keep-state.json"
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
    own: dict[str, dict] = state.get("regels", {}) if state.get("lijst_id") == keep.id else {}
    own = {i: r for i, r in own.items() if isinstance(r, dict)}  # oud formaat telt niet

    lines, weeks = desired_lines(data_dir / "weekmenu" / "plannen", today)
    items = keep.items()
    changes = plan_changes(lines, own, items)
    for item_id in changes.delete_ids:
        keep.delete(item_id)
    added = {keep.add(tekst): (week, tekst) for week, tekst in changes.add}
    keep.save()
    if added:
        print(f"toegevoegd: {json.dumps(added, ensure_ascii=False)}")  # vangnet als de state-commit faalt

    _write(data_dir, "keep-state.json", {"lijst_id": keep.id, "regels": next_state(own, changes, added)})
    status = {"tijd": now.isoformat(), "ok": True, "melding": "", "weken": weeks}
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
        status = sync(data_dir, keep, now.date(), now)
        print(f"Keep bijgewerkt voor {', '.join(status['weken']) or 'geen weken'}")
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
