This app is designed for a color e-ink tablet with a Kaleido 3 display.

It should take design inspiration from printed matter, with an emphasis on typography, white space, and the occasional rule.

Make sure that the minimum font size is 18px, minimum border size is 2px.

Buttons should be solid black with white text.

Do not use hover styles. E-ink tablets do not support hover — use only focus and active states for interactivity feedback.

CSS color tokens for the Kaleido 3 display are defined in `src/client/styles/eink.css` as `--color-*` variables. These colors may be used for solid fills on icons or button backgrounds. Do NOT use them for text or borders — those must remain black (#000) or white (#fff).

We keep the source of relevant projects/dependencies cloned in references/ for quick reference. this folder is gitignored, so anything can be cloned there and it won't clutter the repo.
