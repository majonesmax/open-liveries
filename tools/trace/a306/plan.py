# The A300-600F's plan (plan.snap.json) from the A300B4's: the A300F4-600 sheet's plan (2.2 page 1) is on graph paper
# and isn't drawn to one scale (33.1 px a meter lengthwise by its tail cone, 34.1 across by its wing tips, the fuselage
# 5.8 m wide), while the two types share the wing and the fuselage's section. So the B4's snapped plan
# (tools/trace/a30b/plan.anchors.json snapped on the B2-B4 sheet's plan, as a30b's recipe says) is taken with a
# 0.47 m plug at 34.4 m, where the B4's cabin's parallel section ends: the -600's longer body is in its aft fuselage
# (its side view puts the fin and the belly's sweep up 0.47 m further aft than the B4's, and its printed 54.08 m
# against the B4's 53.61 m). The fuselage's width moves point by point, the tailplane whole; the wing stays.
# Its refs are the B4's (nose 74, centerline 907). Its tailplane is narrowed to the printed 16.26 m by build.py
# (the recipe's stabilizerSpan).
# Usage: plan.py a30b-workdir/plan.snap.json a306-workdir/plan.snap.json
import json, sys

s = json.load(open(sys.argv[1]))
NOSE, PPM = 74, 38.54
AT, N = NOSE + 34.4 * PPM, 0.47 * PPM
out = {}
for k, v in s.items():
    if not isinstance(v, list): out[k] = v
    elif k.startswith('fuselage.'): out[k] = [[p[0] + (N if p[0] >= AT else 0), p[1]] for p in v]
    elif k.startswith('stabilizer.'): out[k] = [[p[0] + N, p[1]] for p in v]
    else: out[k] = v
json.dump(out, open(sys.argv[2], 'w'))
