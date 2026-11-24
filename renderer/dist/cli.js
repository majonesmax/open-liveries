#!/usr/bin/env node
// Renders schemes to SVG files from the command line.
//
//   node renderer/dist/cli.js liveries/SWA/colorado-one.json                  # left side, narrowbody, to stdout
//   node renderer/dist/cli.js liveries/BAW/standard.json --shape widebody --view right > baw.svg
//   node renderer/dist/cli.js liveries/BAW/standard.json --shape my-plane.json --view below
//   node renderer/dist/cli.js liveries/BAW/standard.json --shape shapes/A320.json      # a measured type
//   node renderer/dist/cli.js --all build/render     # every scheme, every shape (and shapes/*.json) and view
//   node renderer/dist/cli.js --print-shape widebody > my-plane.json            # a starting point for your own
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { isMeasuredShape, measuredShapeProblems, renderBelow, renderSide, shapeNamed, shapeProblems, SHAPES, } from './index.js';
const VIEWS = ['left', 'right', 'below'];
function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}
/** A shape by name, or from a JSON file: your own numbers, or a measured type from shapes/. */
function shapeFrom(nameOrPath) {
    const builtIn = shapeNamed(nameOrPath);
    if (builtIn)
        return builtIn;
    if (nameOrPath.endsWith('.json')) {
        const shape = readJson(nameOrPath);
        const problems = isMeasuredShape(shape) ? measuredShapeProblems(shape) : shapeProblems(shape);
        if (problems.length)
            throw new Error(`${nameOrPath}:\n  ${problems.join('\n  ')}`);
        return shape;
    }
    throw new Error(`No shape ${nameOrPath}: use ${Object.keys(SHAPES).join(', ')} or a .json file`);
}
function render(scheme, shape, view) {
    return view === 'below' ? renderBelow(scheme, { shape }) : renderSide(scheme, { shape, side: view });
}
/** Every drawn scheme under liveries/, on every shape from every view; fails on a NaN in the output. */
const USAGE = `usage: cli.js SCHEME.json [--shape NAME|FILE.json] [--view left|right|below]
       cli.js --all OUT_DIR [--root DIR]
       cli.js --print-shape NAME

  SCHEME.json      a scheme from liveries/
  --shape          narrowbody, widebody or regional, or a shape file: your own or a measured type (shapes/A320.json)
  --view           left (default), right or below
  --all OUT_DIR    every drawn scheme on every shape (and shapes/*.json) in every view, as files under OUT_DIR
  --root DIR       the dataset's root for --all (default: .)
  --print-shape    a built-in shape as JSON, to start your own from`;
function renderAll(root, out) {
    let files = 0;
    const broken = [];
    const shapes = Object.entries(SHAPES);
    const measured = join(root, 'shapes');
    if (existsSync(measured)) {
        for (const file of readdirSync(measured)
            .filter((f) => f.endsWith('.json'))
            .sort()) {
            shapes.push([file.replace(/\.json$/, ''), shapeFrom(join(measured, file))]);
        }
    }
    for (const airline of readdirSync(join(root, 'liveries')).sort()) {
        for (const file of readdirSync(join(root, 'liveries', airline)).filter((f) => f.endsWith('.json'))) {
            const scheme = readJson(join(root, 'liveries', airline, file));
            if (!scheme.fuselage && !scheme.fin?.areas)
                continue;
            for (const [name, shape] of shapes) {
                const dir = join(out, name, airline);
                mkdirSync(dir, { recursive: true });
                for (const view of VIEWS) {
                    const svg = render(scheme, shape, view);
                    if (svg.includes('NaN'))
                        broken.push(`${airline}/${scheme.id} ${name} ${view}`);
                    writeFileSync(join(dir, `${scheme.id}-${view}.svg`), svg);
                    files++;
                }
            }
        }
    }
    console.log(`${files} pictures → ${out}`);
    if (broken.length)
        console.error(`NaN in:\n  ${broken.join('\n  ')}`);
    return broken.length ? 1 : 0;
}
function main() {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            shape: { type: 'string', default: 'narrowbody' },
            view: { type: 'string', default: 'left' },
            all: { type: 'string' },
            'print-shape': { type: 'string' },
            root: { type: 'string', default: '.' },
            help: { type: 'boolean', short: 'h' },
        },
    });
    if (values.help) {
        console.log(USAGE);
        return 0;
    }
    if (values.all)
        return renderAll(values.root, values.all);
    if (values['print-shape']) {
        process.stdout.write(JSON.stringify(shapeFrom(values['print-shape']), null, 2) + '\n');
        return 0;
    }
    const [path] = positionals;
    const view = values.view;
    if (!path || !VIEWS.includes(view)) {
        console.error(USAGE);
        return 2;
    }
    process.stdout.write(render(readJson(path), shapeFrom(values.shape), view) + '\n');
    return 0;
}
try {
    process.exitCode = main();
}
catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
