# Logos

A livery's logos are part of what makes it recognizable, so each one is described: which mark (`mark`, an
id like `BAW/speedmarque` shared by every scheme that carries it), where it sits, how big, in which
colors, what it looks like in words, and a `reference` to see it (the airline's brand page, or a
Wikimedia Commons file).
Prefer a Commons file marked public domain for being only lettering or simple shapes (PD-textlogo, PD-shape): it's
the best reference an app has for drawing its own version. Non-free logos (Wikipedia's fair-use uploads) are never
a reference.

The artwork itself isn't in the dataset. It belongs to the airline: copyright in anything more than simple
shapes and lettering, and trademark in all of it. A CC0 dataset can't give away what isn't ours. An app
that draws logos on the real airline's real plane, to show which plane it is, gets the artwork itself and
makes its own call; most flight-tracking apps show airline logos on that basis.

What the dataset can carry later, if it proves useful: a simplified outline for marks that are only simple
geometry (a stripe, a triangle), clearly marked as an approximation.

Where artwork covers the aircraft (a formline salmon nose to tail), the scheme's areas still carry its major colour
fields, at the scale of the big masses (about half a meter and up), so the aircraft reads right in its colours;
the artwork's linework and detail stay the logo's.

## Wordmarks

A title is text, set in the nearest typeface a renderer has (`type.similar`). A few wordmarks no typeface comes
close to (easyJet's, Frontier's) also name a `mark`, as a logo does: a renderer that has a shape for it draws it in
the title's box (baseline at `at`, cap height `height`, stretched to `length`, its slant its own), and one that
doesn't sets the `text` as before. As with logos, the shape isn't in the dataset; the title says which mark it is.

## Licensed artwork

Some specials carry artwork the airline paints under licence from someone else: Alaska's Disneyland jets carry
Disney's characters and the Disneyland Resort logo, its Star Wars jet Lucasfilm's Millennium Falcon and TIE
fighters. Such a logo names whose it is in `licensed` (`"licensed": "Disney"`), as the airline's own materials
credit it (Alaska credits the Star Wars jet's design to Lucasfilm). The entry is still described, placed and
colored like any other; the field only says the artwork isn't the airline's either.

It's carried through to both exports (the compact one as `lic` on the logo, the renderer's whole), so an app that
leaves the artwork out can say why, plainly: not missing, someone else's. Sports teams' and universities' marks
and the airlines' own partners' (an alliance, a sponsor) aren't tagged this way: they're trademarks an airline
carries for its partner, and an app may draw its own simplified mark for them.
