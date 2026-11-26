# B462: the BAe 146-200

Measured from an enthusiast's dimensioned schematic: Wikimedia Commons
[File:BAe 146 v1.0.png](https://commons.wikimedia.org/wiki/File:BAe_146_v1.0.png) by Julien.scavini (CC BY-SA 3.0,
own work). Only its figures are taken, not the drawing. No BAe 146 airport-planning document is openly available.
BAE Systems' APM 146.1 is on its customer portal. No public-domain government three-view was found either. So the
shape's confidence is low. It's checked against EASA's type certificate data sheet (TCDS EASA.A.182, Issue 3.0) and
against Commons photos of PSA's 146s (the shape's `sources`).

The schematic is a 1355 x 830 px picture of about 21 px a meter. Its side and plan are drawn 9.3% long lengthwise
against their own span, height, width and 10 m scale bar. They're evened out with EASA's 28.55 m length and 26.34 m span
(`layers.py --xscale 0.9148`), so one scale serves every view (85.04 raster px a meter). Those two figures set the scale,
so their rows show only the tracing. The rest are independent checks.

| Printed                          | Source            | Shape             |
| -------------------------------- | ----------------- | ----------------- |
| overall length                   | 28.55 m (EASA)    | 28.575 m (+0.1%)  |
| wingspan                         | 26.34 m (EASA)    | 26.282 m (−0.2%)  |
| height, ground to the fin's top  | 8.61 m (EASA)     | 8.596 m (−0.2%)   |
| fuselage width                   | 3.50 m (drawing)  | 3.54 m (+1.1%)    |
| wheelbase (the drawn gear)       | 11.20 m (EASA)    | 11.33 m (+1.2%)   |
| main gear track (the drawn gear) | 4.72 m (EASA)     | 4.50 m (−4.7%)    |
| scale bar, 10 m                  | 212 px (drawing)  | 212.6 px (+0.3%)  |

The schematic prints 28.60 m and 26.21 m, the Avro RJ85's published figures. Its lines match the 146-200's. The gear
isn't part of the shape. A side-on photo of N356PS (1986) lands on the outline within about 0.25 m along the fuselage.
The fin's leading edge and top come out up to 0.3-0.5 m ahead of and above the photo's. That fit is a flat one, so the
fin is the least certain part.

Rebuild (W a work folder, the PNG flattened onto white and saved at 72 dpi, 1 pt a pixel):

```sh
T=tools/trace
python -I $T/layers.py flat.png 0 4 $W/side.png  --mode image --threshold 170 --clip 15,5,710,200 --xscale 0.9148
python -I $T/layers.py flat.png 0 4 $W/plan.png  --mode image --threshold 170 --clip 15,240,710,815 --xscale 0.9148
python -I $T/layers.py flat.png 0 4 $W/front.png --mode image --threshold 170 --clip 765,5,1345,200
for v in side plan front; do python -I $T/snap.py $W/$v.png $T/b462/$v.anchors.json $W/$v.snap.json; done
python -I $T/features.py $W/side.png $W/side.snap.json $W/features.json
python -I $T/build.py $T/b462/recipe.json $W
python -I $T/smooth.py shapes/B462.json
python -I $T/b462/straighten.py shapes/B462.json   # the cabin flat, nose and tail eased, the gear checks
python -I $T/windshield.py shapes/B462.json
```
