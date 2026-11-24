# Logos

A livery's logos are part of what makes it recognizable, so each one is described. That covers which mark it is
(`mark`), where it sits, how big it is, its colors, what it looks like in words and a `reference` to see it. A
`mark` is an id like `BAW/speedmarque` shared by every scheme that carries it. The reference is the airline's brand
page or a Wikimedia Commons file.
Prefer a Commons file marked public domain for being only lettering or simple shapes (PD-textlogo, PD-shape). It's
the best reference an app has for drawing its own version. Non-free logos (Wikipedia's fair-use uploads) are never
a reference.

The artwork itself isn't in the dataset. It belongs to the airline. The airline holds copyright in anything more
than simple shapes and lettering and trademark in all of it. A CC0 dataset can't give away what isn't ours. An app
that draws logos on the real airline's real plane to show which plane it is gets the artwork itself and makes its
own call. Most flight-tracking apps show airline logos on that basis.

If it proves useful, the dataset can carry a simplified outline later for marks that are only simple geometry (a
stripe, a triangle). It would be clearly marked as an approximation.

Sometimes artwork covers the aircraft, like a formline salmon nose to tail. The scheme's areas still carry its major
color fields at the scale of the big masses (about half a meter and up), so the aircraft reads right in its colors.
The artwork's linework and detail stay the logo's.

## Wordmarks

A title is text set in the nearest typeface a renderer has (`type.similar`). No typeface comes close to a few
wordmarks, like easyJet's and Frontier's. Those also name a `mark` the way a logo does. A renderer that has a shape
for it draws it in the title's box (baseline at `at`, cap height `height`, stretched to `length`, with its own
slant). One that doesn't sets the `text` as before. As with logos, the shape isn't in the dataset. The title says
which mark it is.

## Licensed artwork

Some specials carry artwork the airline paints under license from someone else. Alaska's Disneyland jets carry
Disney's characters and the Disneyland Resort logo. Its Star Wars jet carries Lucasfilm's Millennium Falcon and TIE
fighters. Such a logo names whose it is in `licensed` (`"licensed": "Disney"`), as the airline's own materials
credit it. Alaska credits the Star Wars jet's design to Lucasfilm. The entry is still described, placed and colored
like any other. The field only says the artwork isn't the airline's either.

It's carried through to both exports. The compact one has it as `lic` on the logo and the renderer's has it whole.
So an app that leaves the artwork out can say plainly why. It isn't missing. It's someone else's. Sports teams' and
universities' marks and the airlines' own partners' (an alliance, a sponsor) aren't tagged this way. They're
trademarks an airline carries for its partner, and an app may draw its own simplified mark for them.
