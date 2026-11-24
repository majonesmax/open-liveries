"""The shapes of the dataset's files, as the tools read them (schema/*.schema.json has the full rules).

Only the fields the tools touch are named. Field names follow the data (camelCase); shapes with keys that
aren't Python names ("$schema", "from") use the functional TypedDict form.
"""

from typing import Any, NotRequired, TypedDict

Point = list[float]  # [x, y] in its part's space, or [x, y, 1] for a sharp corner (docs/COORDINATES.md)


class Source(TypedDict):
    url: str
    title: NotRequired[str]
    accessed: NotRequired[str]
    note: NotRequired[str]


class PaletteColor(TypedDict):
    hex: str
    name: NotRequired[str]
    official: NotRequired[bool]


class Area(TypedDict):
    """A colored area: `points`, or a `below`/`above` line (docs/COORDINATES.md)."""

    color: str
    name: NotRequired[str]
    points: NotRequired[list[Point]]
    below: NotRequired[list[Point]]
    above: NotRequired[list[Point]]
    side: NotRequired[str]
    smooth: NotRequired[bool]


class Radome(TypedDict):
    color: str
    to: NotRequired[float]


class CockpitWindows(TypedDict, total=False):
    mask: str


class Fuselage(TypedDict):
    base: str
    areas: NotRequired[list[Area]]
    radome: NotRequired[Radome]
    cockpitWindows: NotRequired[CockpitWindows]
    windows: NotRequired[str]


class Fin(TypedDict, total=False):
    base: str
    rudder: str
    fillet: str
    areas: list[Area]


class Surface(TypedDict, total=False):
    """Wings and the stabilizer."""

    top: str
    under: str
    areas: list[Area]


class Winglets(TypedDict, total=False):
    outer: str
    inner: str


class Engines(TypedDict, total=False):
    cowling: str
    inletLip: str
    areas: list[Area]


class TitleType(TypedDict, total=False):
    """The lettering: typefaces that come close, weight and slant."""

    similar: list[str]
    weight: int
    slantDeg: float
    xHeight: float


class TitlePart(TypedDict):
    text: str
    color: str


class Title(TypedDict):
    text: str
    place: str
    at: Point
    height: float
    color: str
    parts: NotRequired[list[TitlePart]]
    side: NotRequired[str]
    length: NotRequired[float]
    type: NotRequired[TitleType]
    rotationDeg: NotRequired[float]
    # A wordmark drawn as a mark where a renderer has it (docs/LOGOS.md › Wordmarks).
    mark: NotRequired[str]


class Logo(TypedDict):
    mark: str
    licensed: NotRequired[str]
    place: str
    at: Point
    height: float
    colors: NotRequired[list[str]]
    side: NotRequired[str]


Livery = TypedDict(
    "Livery",
    {
        "$schema": NotRequired[str],
        "id": str,
        "airline": str,
        "name": str,
        "kind": str,
        "confidence": str,
        "from": NotRequired[str],
        "to": NotRequired[str],
        "description": NotRequired[str],
        "sources": list[Source],
        "palette": NotRequired[dict[str, PaletteColor]],
        "fuselage": NotRequired[Fuselage],
        "fin": NotRequired[Fin],
        "stabilizer": NotRequired[Surface],
        "wings": NotRequired[Surface],
        "winglets": NotRequired[Winglets],
        "engines": NotRequired[Engines],
        "logos": NotRequired[list[Logo]],
        "titles": NotRequired[list[Title]],
        "notes": NotRequired[str],
        "history": NotRequired[str],
        "commonest": NotRequired[bool],
        "drawnOn": NotRequired[str],
        # Paint that differs on one type, by shape id: partial parts over the scheme's (common.paint_for).
        "types": NotRequired[dict[str, dict[str, Any]]],
    },
)


class Art(TypedDict):
    """A jet's own artwork within its scheme (Frontier's tail animals)."""

    subject: str
    family: str
    name: NotRequired[str]
    colors: NotRequired[list[str]]


Airframe = TypedDict(
    "Airframe",
    {
        "registration": str,
        "hex": NotRequired[str],
        "hexSource": NotRequired[str],
        "type": NotRequired[str],
        "livery": str,
        "from": NotRequired[str],
        "to": NotRequired[str],
        "lastSeen": NotRequired[str],
        "confidence": str,
        "sources": list[Source],
        "notes": NotRequired[str],
        "status": NotRequired[str],
        "art": NotRequired[Art],
    },
)

AirframeFile = TypedDict("AirframeFile", {"$schema": NotRequired[str], "airline": str, "airframes": list[Airframe]})


class Operator(TypedDict):
    """An operator flying in another airline's paint (operators.json)."""

    wears: str  # "ICAO/id"
    note: NotRequired[str]


class Airline(TypedDict):
    name: str
    country: NotRequired[str]


class AirlinesFile(TypedDict):
    airlines: dict[str, Airline]
