// Loading the dataset. The site is static and can't list folders, so it reads index.json (tools/index.py)
// first, then each scheme's JSON when it's needed. Paths are from the repository root.
/** The repository root, relative to examples/svg-viewer/. */
const ROOT = '../../';
async function fetchJson(path) {
    const response = await fetch(ROOT + path);
    if (!response.ok)
        throw new Error(`${path}: HTTP ${response.status}`);
    return (await response.json());
}
/** The index and lookups over it. */
export class Dataset {
    index;
    schemesById;
    liveries = new Map();
    shapes = new Map();
    airframes;
    constructor(index) {
        this.index = index;
        this.schemesById = new Map(index.schemes.map((s) => [s.id, s]));
    }
    static async load() {
        return new Dataset(await fetchJson('index.json'));
    }
    summary(id) {
        return this.schemesById.get(id);
    }
    /** The airline's default scheme (docs/COORDINATES.md › The airline's default scheme). */
    defaultScheme(airline) {
        return this.index.schemes.find((s) => s.airline === airline && s.default);
    }
    /** The airline's name from airlines.json; failing that, its default scheme's title, e.g. "American". */
    airlineName(airline) {
        return this.index.airlines[airline]?.name ?? this.defaultScheme(airline)?.title ?? '';
    }
    /** How many airlines have schemes. */
    get airlineCount() {
        return new Set(this.index.schemes.map((s) => s.airline)).size;
    }
    /** The measured shape (shapes/) for the type a scheme was measured on, if there is one: its id and name. */
    measuredFor(scheme) {
        const type = scheme.drawnOn;
        if (!type)
            return undefined;
        // The shape whose id is the designator first (B763, the 767-300F, before B763-passenger), then any serving it.
        return this.index.shapes.find((s) => s.id === type) ?? this.index.shapes.find((s) => s.types.includes(type));
    }
    /** A measured shape's JSON, fetched once. */
    shape(id) {
        let shape = this.shapes.get(id);
        if (!shape) {
            shape = fetchJson(`shapes/${id}.json`);
            this.shapes.set(id, shape);
        }
        return shape;
    }
    /** A scheme's full JSON, fetched once. */
    livery(id) {
        let livery = this.liveries.get(id);
        if (!livery) {
            livery = fetchJson(`liveries/${id}.json`);
            this.liveries.set(id, livery);
        }
        return livery;
    }
    /**
     * The scheme and what to draw for it: itself, or, when it's described in words only (no fuselage), its
     * airline's default. A scheme with only a fin is drawn as it is; `drawn` is undefined when there's nothing.
     */
    async drawable(id) {
        const livery = await this.livery(id);
        if (livery.fuselage)
            return { livery, drawn: livery };
        const fallback = this.defaultScheme(livery.airline);
        if (fallback && fallback.id !== id) {
            const drawn = await this.livery(fallback.id);
            if (drawn.fuselage)
                return { livery, drawn, fallbackId: fallback.id };
        }
        return livery.fin ? { livery, drawn: livery } : { livery };
    }
    /** Every listed airframe, keyed by the scheme it wears. All the files load on first use. */
    airframesByScheme() {
        this.airframes ??= Promise.all(this.index.airframeFiles.map((code) => fetchJson(`airframes/${code}.json`).catch(() => undefined))).then(groupAirframes);
        return this.airframes;
    }
}
function groupAirframes(files) {
    const bySchemeId = new Map();
    for (const file of files) {
        if (!file)
            continue;
        for (const airframe of file.airframes) {
            // "id" is the file's own airline's scheme; "ICAO/id" another airline's.
            const id = airframe.livery.includes('/') ? airframe.livery : `${file.airline}/${airframe.livery}`;
            const list = bySchemeId.get(id) ?? [];
            list.push({ ...airframe, listedBy: file.airline });
            bySchemeId.set(id, list);
        }
    }
    return bySchemeId;
}
