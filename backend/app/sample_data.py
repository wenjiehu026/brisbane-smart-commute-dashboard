from __future__ import annotations

from datetime import datetime, timedelta, timezone


def iso(minutes: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()


ROUTES = [
    ("66", "66", "UQ Lakes - RBWH via CBD", "bus"),
    ("BRCL", "Beenleigh", "Beenleigh line to Central", "train"),
    ("CITYCAT", "CityCat", "UQ St Lucia - Northshore Hamilton", "ferry"),
    ("199", "199", "West End - Teneriffe via City", "bus"),
    ("SPRINT", "Springfield", "Springfield line to Central", "train"),
]

VEHICLES = [
    ("bus-66-1", "66", "66-in-104", -27.497, 153.013, 98, None, iso(-4), 130),
    ("bus-66-2", "66", "66-out-221", -27.469, 153.024, 12, None, iso(-3), 80),
    ("bus-66-3", "66", "66-in-114", -27.444, 153.028, 202, None, iso(-2), 240),
    ("train-beenleigh-1", "BRCL", "bn-208", -27.466, 153.026, 310, None, iso(-5), 46),
    ("train-beenleigh-2", "BRCL", "bn-215", -27.512, 153.033, 300, None, iso(-1), 91),
    ("ferry-citycat-1", "CITYCAT", "cc-19", -27.475, 153.017, 82, None, iso(-2), 20),
    ("ferry-citycat-2", "CITYCAT", "cc-24", -27.452, 153.046, 66, None, iso(-3), 44),
    ("bus-199-1", "199", "199-in-88", -27.481, 153.009, 12, None, iso(-2), 390),
    ("bus-199-2", "199", "199-out-41", -27.456, 153.043, 184, None, iso(-1), 175),
    ("train-springfield-1", "SPRINT", "sp-501", -27.470, 153.018, 260, None, iso(-2), 60),
]

TRIP_UPDATES = [
    ("66", "66-in-104", "UQ-LAKES", "UQ Lakes station", iso(2), iso(3), 60),
    ("66", "66-out-221", "UQ-LAKES", "UQ Lakes station", iso(9), iso(12), 180),
    ("BRCL", "bn-208", "CENTRAL", "Central station", iso(5), iso(6), 60),
    ("CITYCAT", "cc-19", "SOUTHBANK", "South Bank ferry terminal", iso(7), iso(7), 0),
    ("199", "199-in-88", "WESTEND", "Boundary Street at West End", iso(4), iso(10), 360),
]

ALERTS = [
    (
        "roadworks-cbd",
        "warning",
        "Roadworks",
        "CBD roadworks may add 5-10 minutes to selected bus services.",
        "66,199",
        iso(-60),
        iso(300),
    ),
    (
        "platform-change-springfield",
        "info",
        "Platform change",
        "Springfield line services are using an alternate platform at Central.",
        "SPRINT",
        None,
        None,
    ),
]
