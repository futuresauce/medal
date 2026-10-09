"""One-time interactive login for the gift resolver.

Run this on the server (not in CI) as the same user that will run gift_api.py:

    python login.py

It asks for the phone number, the code Telegram sends, and the 2FA password if set,
then writes `gift.session` next to this file. Keep that file private (chmod 600);
anyone holding it is logged in as that account. Use a dedicated Telegram account,
not a personal one, and never commit the session file.
"""
import os
from dotenv import load_dotenv
from telethon import TelegramClient

load_dotenv()
client = TelegramClient(os.environ.get("SESSION", "gift"), int(os.environ["API_ID"]), os.environ["API_HASH"])

with client:
    me = client.get_me()
    print(f"Logged in as {me.first_name} (@{me.username or '—'}). Session saved. You can start gift_api.py now.")
