"""
Boss Battles - Curated Historical Stress Periods
Each boss represents a legendary market event.
Strategies must survive to earn achievements.
"""

BOSS_BATTLES = {
    "black_monday": {
        "name": "Black Monday",
        "icon": "\U0001F3F4",
        "description": (
            "October 19, 1987 - the single largest one-day percentage "
            "decline in history. The Dow dropped 22.6% in one session."
        ),
        "start_date": "1987-10-01",
        "end_date": "1987-11-30",
        "ticker": "^GSPC",
        "survival_threshold": -25,
        "achievement_id": "boss_black_mon",
        "difficulty": "LEGENDARY",
    },
    "dotcom": {
        "name": "Dot-Com Burst",
        "icon": "\U0001F4BB",
        "description": (
            "March 2000 to October 2002 - the internet bubble burst. "
            "NASDAQ lost 78% of its value over 30 months."
        ),
        "start_date": "2000-03-01",
        "end_date": "2002-10-01",
        "ticker": "^IXIC",
        "survival_threshold": -30,
        "achievement_id": "boss_dotcom",
        "difficulty": "EXTREME",
    },
    "gfc_2008": {
        "name": "Global Financial Crisis",
        "icon": "\U0001F3E6",
        "description": (
            "September 2008 to March 2009 - Lehman Brothers collapsed, "
            "triggering a systemic global meltdown."
        ),
        "start_date": "2008-09-01",
        "end_date": "2009-03-31",
        "ticker": "^GSPC",
        "survival_threshold": -25,
        "achievement_id": "boss_gfc",
        "difficulty": "EXTREME",
    },
    "covid_crash": {
        "name": "COVID Flash Crash",
        "icon": "\U0001F9A0",
        "description": (
            "February to April 2020 - the fastest 30% decline in history, "
            "followed by the fastest recovery."
        ),
        "start_date": "2020-02-19",
        "end_date": "2020-04-30",
        "ticker": "SPY",
        "survival_threshold": -20,
        "achievement_id": "boss_covid",
        "difficulty": "HARD",
    },
    "volmageddon": {
        "name": "Volmageddon",
        "icon": "\U0001F32A",
        "description": (
            "February 5, 2018 - XIV (inverse VIX) lost 93% overnight. "
            "The VIX spiked 116% in a single day."
        ),
        "start_date": "2018-01-26",
        "end_date": "2018-02-28",
        "ticker": "SPY",
        "survival_threshold": -15,
        "achievement_id": "boss_volmaged",
        "difficulty": "HARD",
    },
}


def get_boss_battle(boss_id):
    """Return boss battle config by ID, or None."""
    return BOSS_BATTLES.get(boss_id)


def get_all_bosses():
    """Return all boss battles for menu display."""
    return {
        boss_id: {
            "name": boss["name"],
            "icon": boss["icon"],
            "description": boss["description"],
            "difficulty": boss["difficulty"],
        }
        for boss_id, boss in BOSS_BATTLES.items()
    }
