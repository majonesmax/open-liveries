"""A US registration (N-number) → its ICAO 24-bit address. The FAA assigns them in order, so it's a
calculation, not a lookup: A00001 is N1, ADF7C7 is N99999. Used by validate.py to check every N-number's hex.
Usage: .venv/bin/python -I tools/nnumber.py N123AB [...]"""

import argparse

LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"  # no I or O
SUFFIX = 1 + len(LETTERS) * (1 + len(LETTERS))  # 601: none, one letter, or two
# How many addresses each digit position spans, from the last (B4) to the first (B1).
B4 = 1 + len(LETTERS) + 10
B3 = 10 * B4 + SUFFIX
B2 = 10 * B3 + SUFFIX
B1 = 10 * B2 + SUFFIX


def _suffix(letters: str) -> int:
    """The offset of a one- or two-letter suffix ('', 'A', 'AB') after its digits."""
    if not letters:
        return 0
    out = LETTERS.index(letters[0]) * (len(LETTERS) + 1) + 1
    if len(letters) == 2:
        out += LETTERS.index(letters[1]) + 1
    return out


def icao(registration: str) -> str | None:
    """The hex for an N-number ('N123AB'), lowercase; None if it isn't a valid one."""
    n = registration.upper()
    if not n.startswith("N") or not 2 <= len(n) <= 6 or n[1] not in "123456789":
        return None
    n = n[1:]
    try:
        out = 0xA00001 + (int(n[0]) - 1) * B1
        for i, size in ((1, B2), (2, B3), (3, B4)):
            if len(n) == i:
                return f"{out:06x}"
            if n[i] in LETTERS:
                if len(n) - i > 2 or any(c not in LETTERS for c in n[i:]):
                    return None
                return f"{out + _suffix(n[i:]):06x}"
            out += SUFFIX + int(n[i]) * size
        if len(n) == 4:
            return f"{out:06x}"
        if n[4] in LETTERS:
            return f"{out + 1 + LETTERS.index(n[4]):06x}"
        return f"{out + 1 + len(LETTERS) + int(n[4]):06x}"
    except ValueError:
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("registrations", nargs="*", metavar="N-NUMBER")
    for registration in parser.parse_args().registrations:
        print(registration, icao(registration))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
