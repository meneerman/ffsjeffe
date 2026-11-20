"""Keep-spike: kan ffsjeffe de bestaande 'boodschappenlijst' lezen en er veilig een eigen regel op zetten en weer afhalen?

Standaard ALLEEN LEZEN. Met --write zet hij één testregel "ffsjeffe test" op de lijst en haalt die direct weer weg.

Env (uit .env of de omgeving): KEEP_EMAIL, KEEP_MASTER_TOKEN, optioneel KEEP_DEVICE_ID, KEEP_LIST_TITLE (standaard 'boodschappenlijst').
Gebruik:
    .venv/bin/python -I spikes/keep_spike.py            # lezen
    .venv/bin/python -I spikes/keep_spike.py --write    # schrijftest
"""

import os
import pathlib
import sys
import time

import gkeepapi

ENV = pathlib.Path(__file__).resolve().parent.parent / ".env"
if ENV.exists():
    for line in ENV.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

TITLE = os.environ.get("KEEP_LIST_TITLE", "boodschappenlijst")
TEST_TEXT = "ffsjeffe test"


def connect() -> gkeepapi.Keep:
    keep = gkeepapi.Keep()
    t = time.time()
    keep.authenticate(os.environ["KEEP_EMAIL"], os.environ["KEEP_MASTER_TOKEN"], device_id=os.environ.get("KEEP_DEVICE_ID"))
    print(f"ingelogd + gesynct in {time.time() - t:.1f}s")
    return keep


def find_list(keep: gkeepapi.Keep):
    hits = [n for n in keep.all() if isinstance(n, gkeepapi.node.List) and n.title.strip().lower() == TITLE.lower() and not n.trashed and not n.archived]
    if len(hits) != 1:
        raise SystemExit(f"verwacht precies 1 lijst '{TITLE}', gevonden: {len(hits)}")
    return hits[0]


def main() -> None:
    write = "--write" in sys.argv
    keep = connect()
    lst = find_list(keep)
    print(f"lijst gevonden: id={lst.id} pinned={lst.pinned} open={len(lst.unchecked)} afgevinkt={len(lst.checked)}")
    for item in lst.unchecked[:5]:
        print(f"  [ ] {'  ' if item.indented else ''}{item.text}")

    if not write:
        print("alleen gelezen (gebruik --write voor de schrijftest)")
        return

    item = lst.add(TEST_TEXT, False)
    keep.sync()
    item_id = item.id
    print(f"testregel toegevoegd: id={item_id} (kijk nu in Keep op je telefoon)")
    time.sleep(15)

    keep.sync()
    lst = find_list(keep)
    mine = [i for i in lst.items if i.id == item_id]
    if not mine:
        raise SystemExit("testregel niet meer terug te vinden op id")
    mine[0].delete()
    keep.sync()
    print("testregel weer verwijderd; andere regels niet aangeraakt")


if __name__ == "__main__":
    main()
