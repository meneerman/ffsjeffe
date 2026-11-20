"""Eenmalig: wissel een oauth_token-cookie in voor een Keep master token en zet het in .env.

Gebruik (Menno draait dit zelf; het token komt nooit in git of in de chat):
    .venv/bin/python -I spikes/keep_token.py

1. Open in een privévenster https://accounts.google.com/EmbeddedSetup en log in.
2. Klik "Ik ga akkoord" (de pagina blijft daarna laden/leeg, dat is normaal).
3. Ontwikkelaarstools → Application/Opslag → Cookies → accounts.google.com → kopieer de waarde van `oauth_token` (begint met `oauth2_4/`).
4. Plak hem hieronder als het script erom vraagt (de invoer is onzichtbaar).
"""

import getpass
import pathlib
import secrets

import gpsoauth

ENV = pathlib.Path(__file__).resolve().parent.parent / ".env"

email = input("Google-e-mailadres: ").strip()
oauth_token = getpass.getpass("oauth_token (onzichtbaar): ").strip()
android_id = secrets.token_hex(8)

result = gpsoauth.exchange_token(email, oauth_token, android_id)
token = result.get("Token")
if not token:
    raise SystemExit(f"Mislukt, Google gaf geen token terug. Velden: {sorted(result)} / Error: {result.get('Error')}")

lines = [l for l in (ENV.read_text().splitlines() if ENV.exists() else []) if not l.startswith(("KEEP_EMAIL=", "KEEP_MASTER_TOKEN=", "KEEP_DEVICE_ID="))]
lines += [f"KEEP_EMAIL={email}", f"KEEP_MASTER_TOKEN={token}", f"KEEP_DEVICE_ID={android_id}"]
ENV.write_text("\n".join(lines) + "\n")
ENV.chmod(0o600)
print(f"Gelukt. Token staat in {ENV} (niet in git).")
