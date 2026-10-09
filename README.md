# ماخولا

The site is one WebGL2 scene: a fogged window on a rainy night. The forest outside is footage from the «نمی‌کاهم» teaser.

- The Ghalamdar emblem stays clear while the glass fogs, so the name emerges from the condensation.
- «نمی‌کاهم», the lines of Nima's poem and the hints are Nastaliq masks in `assets/data/glass/`. In each PNG, R is the glyph coverage and G is when the reed reaches that pixel, so the text is revealed in writing order.
- Moving the pointer wipes the glass. Holding it (or scrolling) breathes on the glass and brings out hidden writing.
- ▶ plays the teaser outside the window, and «صدا» turns on generated rain and thunder.

Code: `index.html`, `assets/js/window.js`, `assets/css/window.css`. Without WebGL2 the page shows a still of the window.
