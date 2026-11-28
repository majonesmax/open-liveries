"""Release notes from the data: what changed between two commits (or trees) of this repository, as Markdown.
Schemes added, changed and removed (from index.json and liveries/), airframes tagged, untagged and moved per
airline (airframes/), shapes added and changed (shapes/), airlines and operators, and the file format (property
paths added or removed in schema/, the renderer's and the viewer's source files). Every line is counted or listed
from the files themselves: nothing here is written by hand.

  .venv/bin/python -I tools/release_notes.py --version 2026.11.27 --from 2026.11.20 [--to HEAD] [--repo .]

Without --from it's the first release, and everything is new. --to may be a tree (git write-tree), so the notes
can go into the commit they describe. Standard library only.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

#: Past this many registrations in one airline's line, the rest are counted, not listed.
MAX_REGS = 12


class Side:
    """One end of the comparison: a commit, tag or tree in the repository, or nothing (before the first release)."""

    def __init__(self, repo: Path, ref: str | None):
        self.repo = repo
        self.ref = ref
        self.paths: set[str] = set()
        if ref:
            out = self.git("ls-tree", "-r", "--name-only", ref)
            self.paths = set(out.splitlines())

    def git(self, *args: str) -> str:
        return subprocess.run(["git", "-C", str(self.repo), *args], check=True, capture_output=True, text=True).stdout

    def json(self, path: str) -> Any:
        """The file's JSON, or None where it doesn't exist on this side."""
        if path not in self.paths:
            return None
        return json.loads(self.git("cat-file", "blob", f"{self.ref}:{path}"))

    def under(self, folder: str, suffix: str = "") -> set[str]:
        return {p for p in self.paths if p.startswith(folder + "/") and p.endswith(suffix)}


def changed_paths(old: Side, new: Side) -> set[str]:
    """Paths added, removed or modified."""
    if not old.ref:
        return set(new.paths)
    assert new.ref
    out = new.git("diff", "--name-only", "--no-renames", old.ref, new.ref)
    return set(out.splitlines())


def changed_keys(a: dict[str, Any], b: dict[str, Any]) -> list[str]:
    """The top-level keys whose values differ, in the new file's order (then removed ones)."""
    keys = [k for k in b if k != "$schema" and a.get(k) != b[k]]
    return keys + [k for k in a if k not in b and k != "$schema"]


def code(text: str) -> str:
    return f"`{text}`"


def bullets(lines: list[str], indent: str = "") -> list[str]:
    return [f"{indent}- {line}" for line in lines]


def count(n: int, one: str, many: str | None = None) -> str:
    return f"{n} {one if n == 1 else many or one + 's'}"


def reg_list(regs: list[str]) -> str:
    shown = ", ".join(regs[:MAX_REGS])
    return shown if len(regs) <= MAX_REGS else f"{shown} and {len(regs) - MAX_REGS} more"


# Schemes


def schemes_section(old: Side, new: Side, changed: set[str]) -> list[str]:
    old_index = old.json("index.json") or {}
    new_index = new.json("index.json") or {}
    before = {s["id"]: s for s in old_index.get("schemes", [])}
    after = {s["id"]: s for s in new_index.get("schemes", [])}
    added = sorted(after.keys() - before.keys())
    removed = sorted(before.keys() - after.keys())

    modified: list[str] = []
    for path in sorted(changed):
        if not (path.startswith("liveries/") and path.endswith(".json")):
            continue
        scheme_id = path.removeprefix("liveries/").removesuffix(".json")
        if scheme_id not in before or scheme_id not in after:
            continue
        a, b = old.json(path), new.json(path)
        keys = changed_keys(a, b)
        if not keys:
            continue
        note = ", ".join(keys)
        if b and not before[scheme_id].get("drawn") and after[scheme_id].get("drawn"):
            note += " (now drawn)"
        modified.append(f"{code(scheme_id)} {after[scheme_id]['name']}: {note}")

    out: list[str] = []
    if added:
        out.append(f"Adds {count(len(added), 'scheme')}:")
        out += bullets(
            [f"{code(s)} {after[s]['name']}" + ("" if after[s].get("drawn") else " (not drawn yet)") for s in added],
            "  ",
        )
    if modified:
        out.append(f"Changes {count(len(modified), 'scheme')} (the fields that differ):")
        out += bullets(modified, "  ")
    if removed:
        out.append(f"Removes {count(len(removed), 'scheme')}:")
        out += bullets([f"{code(s)} {before[s]['name']}" for s in removed], "  ")
    return _nest(out)


def _nest(lines: list[str]) -> list[str]:
    """Top-level lines become bullets and indented ones stay as they are."""
    return [line if line.startswith("  ") else f"- {line}" for line in lines]


# Airframes


def airframes_section(old: Side, new: Side, changed: set[str], names: dict[str, str]) -> list[str]:
    lines: list[str] = []
    total_tagged = total_untagged = total_moved = total_updated = 0
    for path in sorted(changed):
        if not (path.startswith("airframes/") and path.endswith(".json")):
            continue
        airline = Path(path).stem

        def regs(side: Side, airline: str = airline, path: str = path) -> dict[str, dict[str, Any]]:
            data = side.json(path) or {"airframes": []}
            return {a["registration"]: a for a in data["airframes"]}

        def ref(frame: dict[str, Any], airline: str = airline) -> str:
            livery = str(frame["livery"])
            return livery if "/" in livery else f"{airline}/{livery}"

        a, b = regs(old), regs(new)
        tagged = sorted(b.keys() - a.keys())
        untagged = sorted(a.keys() - b.keys())
        both = sorted(a.keys() & b.keys())
        moved = [r for r in both if ref(a[r]) != ref(b[r])]
        updated = [r for r in both if r not in moved and a[r] != b[r]]
        parts: list[str] = []
        if tagged:
            parts.append(f"tags {count(len(tagged), 'airframe')} ({reg_list(tagged)})")
        if untagged:
            parts.append(f"untags {count(len(untagged), 'airframe')} ({reg_list(untagged)})")
        if moved:
            parts.append(
                f"moves {count(len(moved), 'airframe')} to another scheme ("
                + reg_list([f"{r} to {code(ref(b[r]))}" for r in moved])
                + ")"
            )
        if updated:
            parts.append(f"updates the records of {count(len(updated), 'airframe')}")
        if not parts:
            continue
        total_tagged += len(tagged)
        total_untagged += len(untagged)
        total_moved += len(moved)
        total_updated += len(updated)
        sentences = ". ".join([parts[0], *(p[0].upper() + p[1:] for p in parts[1:])])
        lines.append(f"  - {code(airline)} {names.get(airline, airline)}: {sentences}.")
    if not lines:
        return []
    totals = [
        text
        for n, text in (
            (total_tagged, f"tags {count(total_tagged, 'airframe')}"),
            (total_untagged, f"untags {count(total_untagged, 'airframe')}"),
            (total_moved, f"moves {count(total_moved, 'airframe')} to another scheme"),
            (total_updated, f"updates the records of {count(total_updated, 'airframe')}"),
        )
        if n
    ]
    head = "- " + ". ".join(t[0].upper() + t[1:] for t in totals) + ". By airline:"
    return [head, *lines]


# Shapes


def shapes_section(old: Side, new: Side, changed: set[str]) -> list[str]:
    out: list[str] = []
    for path in sorted(changed):
        if not (path.startswith("shapes/") and path.endswith(".json")):
            continue
        a, b = old.json(path), new.json(path)
        if b and not a:
            out.append(f"Adds {code(b['id'])} {b['name']}.")
        elif a and not b:
            out.append(f"Removes {code(a['id'])} {a['name']}.")
        elif a and b and (keys := changed_keys(a, b)):
            out.append(f"Changes {code(b['id'])} {b['name']}: {', '.join(keys)}.")
    return bullets(out)


# Airlines and operators


def airlines_section(old: Side, new: Side) -> list[str]:
    out: list[str] = []
    a = (old.json("airlines.json") or {}).get("airlines", {})
    b = (new.json("airlines.json") or {}).get("airlines", {})
    if added := sorted(b.keys() - a.keys()):
        out.append(
            f"Adds {count(len(added), 'airline')}: " + ", ".join(f"{code(c)} {b[c]['name']}" for c in added) + "."
        )
    if removed := sorted(a.keys() - b.keys()):
        out.append(
            f"Removes {count(len(removed), 'airline')}: "
            + ", ".join(f"{code(c)} {a[c]['name']}" for c in removed)
            + "."
        )
    if changed := [c for c in sorted(a.keys() & b.keys()) if a[c] != b[c]]:
        out.append(f"Changes {count(len(changed), 'airline')}: " + ", ".join(code(c) for c in changed) + ".")

    oa, ob = old.json("operators.json") or {}, new.json("operators.json") or {}
    if added := sorted(ob.keys() - oa.keys()):
        out.append(
            f"Adds {count(len(added), 'operator')}: "
            + ", ".join(f"{code(c)} wears {code(ob[c]['wears'])}" for c in added)
            + "."
        )
    if removed := sorted(oa.keys() - ob.keys()):
        out.append(f"Removes {count(len(removed), 'operator')}: " + ", ".join(code(c) for c in removed) + ".")
    if moved := [c for c in sorted(oa.keys() & ob.keys()) if oa[c].get("wears") != ob[c].get("wears")]:
        out.append(
            f"Moves {count(len(moved), 'operator')} to another scheme: "
            + ", ".join(f"{code(c)} to {code(ob[c]['wears'])}" for c in moved)
            + "."
        )
    return bullets(out)


# The format


def property_paths(node: Any, prefix: str = "") -> set[str]:
    """Every property a JSON Schema names, as a path: `area/gradient`, `$defs/gradient`, `titles[]/text`."""
    paths: set[str] = set()
    if not isinstance(node, dict):
        return paths
    for name, sub in (node.get("properties") or {}).items():
        path = f"{prefix}/{name}" if prefix else name
        paths.add(path)
        paths |= property_paths(sub, path)
    if "items" in node:
        paths |= property_paths(node["items"], f"{prefix}[]")
    for key in ("oneOf", "anyOf", "allOf"):
        for sub in node.get(key) or []:
            paths |= property_paths(sub, prefix)
    for key in ("then", "else", "additionalProperties"):
        paths |= property_paths(node.get(key), prefix)
    for name, sub in (node.get("$defs") or {}).items():
        paths.add(f"$defs/{name}")
        paths |= property_paths(sub, f"$defs/{name}")
    return paths


def format_section(old: Side, new: Side, changed: set[str]) -> list[str]:
    out: list[str] = []
    for path in sorted(p for p in changed if p.startswith("schema/") and p.endswith(".json")):
        a, b = old.json(path), new.json(path)
        if b is None:
            out.append(f"Removes {code(path)}.")
            continue
        if a is None:
            out.append(f"Adds {code(path)}.")
            continue
        before, after = property_paths(a), property_paths(b)
        added, removed = sorted(after - before), sorted(before - after)
        if added:
            out.append(f"Adds to {code(path)}: " + ", ".join(code(p) for p in added) + ".")
        if removed:
            out.append(f"Removes from {code(path)}: " + ", ".join(code(p) for p in removed) + ".")
        if not added and not removed:
            out.append(f"Revises {code(path)} without adding or removing a field.")

    a_index, b_index = old.json("index.json") or {}, new.json("index.json") or {}
    if a_index and (added := [k for k in b_index if k not in a_index]):
        out.append("Adds to `index.json`: " + ", ".join(code(k) for k in added) + ".")
    if removed := [k for k in a_index if k not in b_index]:
        out.append("Removes from `index.json`: " + ", ".join(code(k) for k in removed) + ".")

    for folder, what in (("renderer/src", "the renderer"), ("examples/svg-viewer/src", "the viewer")):
        files = sorted(p.removeprefix(folder + "/") for p in changed if p.startswith(folder + "/"))
        if files:
            out.append(f"Changes {what} ({code(folder)}): " + ", ".join(code(f) for f in files) + ".")
    return bullets(out)


def other_section(changed: set[str]) -> list[str]:
    """Docs and tools: what the sections above don't cover, by path."""
    covered = ("liveries/", "airframes/", "shapes/", "schema/", "renderer/", "examples/svg-viewer/")
    covered_files = {"index.json", "airlines.json", "operators.json", "CHANGELOG.md", "package-lock.json"}
    rest = sorted(p for p in changed if not p.startswith(covered) and p not in covered_files)
    return bullets(["Changes " + ", ".join(code(p) for p in rest) + "."] if rest else [])


def totals(new: Side) -> str:
    index = new.json("index.json") or {}
    schemes = index.get("schemes", [])
    drawn = sum(1 for s in schemes if s.get("drawn"))
    return (
        f"Totals: {len(schemes)} schemes ({drawn} drawn) from {len(index.get('airlines', {}))} airlines. "
        f"{len(index.get('registrations', {}))} tagged airframes. {len(index.get('shapes', []))} shapes."
    )


def notes(repo: Path, version: str, base: str | None, base_label: str | None, head: str) -> str:
    old, new = Side(repo, base), Side(repo, head)
    changed = changed_paths(old, new)
    index = new.json("index.json") or {}
    names = {c: a["name"] for c, a in index.get("airlines", {}).items()}

    since = f"Compared with {base_label or base}." if base else "The first release."
    lines = [f"## {version}", "", f"{since} {totals(new)}"]
    sections = [
        ("Schemes", schemes_section(old, new, changed)),
        ("Airframes", airframes_section(old, new, changed, names)),
        ("Shapes", shapes_section(old, new, changed)),
        ("Airlines and operators", airlines_section(old, new)),
        ("Format", format_section(old, new, changed)),
        ("Docs and tools", other_section(changed)),
    ]
    for title, body in sections:
        if body:
            lines += ["", f"### {title}", "", *body]
    if not any(body for _, body in sections):
        lines += ["", "No changes to the data or the format."]
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--version", required=True, help="the release's version, YYYY.MM.DD[.N]")
    parser.add_argument("--from", dest="base", help="the previous release (a tag, commit or tree); none: the first")
    parser.add_argument("--from-label", help="how the notes name --from (default: as given)")
    parser.add_argument("--to", default="HEAD", help="this release (a commit or a tree; default HEAD)")
    parser.add_argument("--repo", type=Path, default=Path("."), help="the repository (default: here)")
    args = parser.parse_args()
    sys.stdout.write(notes(args.repo, args.version, args.base, args.from_label, args.to))


if __name__ == "__main__":
    main()
