# The ERJ-140's work directory from the EMB-145's (docs/SHAPES.md; e140/recipe.json's _about): its snapped lines and
# features moved by the two plugs the ERJ-140's planning manual gives (0.91 m at 9.0 m, 0.51 m at 18.0 m).
# Usage: derive.py E145_WORKDIR OUT_WORKDIR   then build.py e140/recipe.json OUT_WORKDIR; smooth.py
import json, shutil, subprocess, sys
from pathlib import Path

src, out = Path(sys.argv[1]), Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
here = Path(__file__).resolve().parent.parent
PPM, PLUGS = 212.17, ['9.0:-0.91', '18.0:-0.51']
for view, nose in (('side', 129), ('plan', 110)):
    subprocess.run([sys.executable, '-I', str(here / 'plug.py'), str(src / f'{view}.snap.json'), str(out / f'{view}.snap.json'),
                    '--ppm', str(PPM), '--nose', str(nose), *sum((['--plug', p] for p in PLUGS), [])], check=True)
shutil.copy(src / 'front.snap.json', out / 'front.snap.json')
plugs = [(129 + float(p.split(':')[0]) * PPM, float(p.split(':')[1]) * PPM) for p in PLUGS]
def moved(x):
    d = 0.0
    for at, n in plugs:
        if at <= x < at - n: return None
        if x >= at - n: d += n
    return d
f = json.load(open(src / 'features.json')); res = {'pieces': [], 'faces': []}
for p in f['pieces']:
    d = moved((p[0] + p[2]) / 2)
    if d is not None: res['pieces'].append([round(p[0] + d), p[1], round(p[2] + d), p[3]])
for fc in f['faces']:
    b = fc['box']; d = moved((b[0] + b[2]) / 2)
    if d is not None: res['faces'].append({'box': [round(b[0] + d), b[1], round(b[2] + d), b[3]], 'area': fc['area']})
json.dump(res, open(out / 'features.json', 'w'))
