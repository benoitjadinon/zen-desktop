# AGENTS.md

Notes for agents adding features to this Zen fork and building it locally.
Workspace-wide rules (fork-first, feature branches, no PR without a go-ahead)
live in `~/Apps/AGENTS.md`. The Firefox side has its own `engine/AGENTS.md`.

## Layout

- `src/` is Zen's own code and the patches applied on top of the Firefox
  checkout in `engine/`. `engine/` is a build input, not tracked here.
- Files under `engine/zen/` and `engine/browser/**/zen-*` are symlinks back
  into `src/`. A brand-new directory under `src/zen/` needs a symlink too,
  or `mach` fails with "referenced a path that does not exist":
  `ln -s /home/ben/Apps/zen/src/zen/<dir> engine/zen/<dir>` (`surfer import`
  does this properly).
- Engine files are changed as patches: edit the file in `engine/`, then from
  the **repo root** run `npx surfer export <path relative to engine>`, for
  example `npx surfer export browser/modules/BrowserDOMWindow.sys.mjs`.
  `npm run export` alone fails (it needs a file). Run it from `engine/` and it
  also fails.
- Prefs live in `prefs/zen/*.yaml`. `npm run ffprefs` regenerates
  `engine/browser/app/profile/zen.js` from them.
- Locale files are copied, not linked: add them to
  `locales/en-US/browser/browser/` and copy to
  `engine/browser/locales/en-US/browser/`.

## Wiring a new feature (checklist)

1. `src/zen/<feature>/moz.build` (`EXTRA_JS_MODULES.zen.<name>`) and add the
   directory to `DIRS` in `src/zen/moz.build`.
2. `jar.inc.mn` for chrome files, and `#include` it from
   `src/browser/base/content/zen-assets.jar.inc.mn`.
3. Stylesheet: `<link>` in `src/browser/base/content/zen-assets.inc.xhtml`.
4. Localization: `<link rel="localization">` in `zen-locales.inc.xhtml`.
5. Per-window code: extend `ZenUIComponent` and register it with a
   `category browser-window-delayed-startup` line in a `*.manifest` that is
   `#include`d from `src/zen/ZenComponents.manifest`. Look at
   `src/zen/space-routing/` for a small example.
6. Window flags go through `extraOptions` (nsIPropertyBag2, `window.arguments[1]`)
   and are turned into root attributes in `engine/browser/base/content/browser-init.js`.

## Build and run

- Front-end only changes (JS, CSS, XHTML, prefs, ftl): `cd engine && ./mach build faster`
  (about 30 s). No full engine rebuild. Redirect output to a file.
- Run it: `npm start` (throwaway profile, `--noprofile`). Modules load at
  startup, so restart Zen after every build. A module with a syntax error
  fails silently in the UI; check the console log.
- Gotcha: private `#methods` are a syntax error inside object literals
  (`export const X = { ... }`). Use a normal name.
- `npx prettier --write` uses a different style from some existing files;
  don't reformat files you aren't changing.

## Testing without touching the real profile

- Never test against the real profile. Copy it to the scratchpad and pass
  `--profile <copy> --no-remote`.
- `MOZ_HEADLESS=1` works for crash/startup checks and session-file checks.
  Real windows need a real display; `hyprctl clients -j | jq` lists them
  (class, geometry, floating).
- Session files are mozlz4 (12-byte header, then an lz4 block). Python has no
  `lz4` module here; a small pure-Python block decoder is enough to check tabs.
- `pkill -f '<pattern>'` also matches your own shell if the pattern is in its
  command line. Check with `pgrep -fa ... | grep -v contentproc` instead.
- To see what launches Zen (for example from another app), log
  `ps -eo pid,ppid,args` and `hyprctl clients` in a background loop that
  appends to a file; do not buffer through `awk` or a pipe.

## Behaviour worth knowing

- Windows without `window.toolbar.visible` (popups) are skipped by workspaces
  and window sync. Session restore goes to the first window that opens, so a
  non-regular first window must be excluded in `SessionStore` (see the
  `zen-little-arc` check next to `zen-unsynced-window`).
- External links arrive at `BrowserDOMWindow.#getContentWindowOrOpenURI`
  (browser already running, `OPEN_EXTERNAL` flag) or at
  `nsBrowserContentHandler.handle` (cold start). Hook both.
- The glance content actor (`ZenGlance`) is the existing place for link
  click handling and is gated by `zen.glance.enabled`.
- `adoptTab` moves a tab between windows without a reload and keeps page
  state.

## Deploying locally

- `~/.local/bin/zen-custom` is a small script that runs
  `engine/obj-x86_64-pc-linux-gnu/dist/bin/zen`, so `./mach build faster` is
  the whole deploy. Zen also writes its own `userapp-Zen-*.desktop` pointing
  at that binary when it sets itself as the default browser.
- The `apps` CLI only checks that `~/.local/bin/zen` exists
  (a symlink to `zen-custom` here). Don't run `apps build zen`; it doesn't
  know this build.
- Hyprland (Lua config in `~/.config/hypr/`): window rules go in
  `custom/rules.lua`, for example `hl.window_rule({ match = { class = "..." }, ... })`.
  The little-arc window has class `zen-little-arc`. Back the config up first.

## Staying current with upstream

- `dev` is our **main line**: upstream plus every finished feature of ours.
  `apps-autoupdate` (daily timer) merges `zen-browser/desktop` `dev` into it
  (`apps.mainCarriesFeatures`) and into any other `feat/...` branch. Conflicts
  go to `claude -p`, then `pi -p`; agent-resolved merges stay local until
  reviewed. Our `.patch` files conflict easily: after a resolved merge run
  `npx surfer export` and rebuild.
- After a merge or pull, new files under `src/zen/tests/` need symlinks in
  `engine/zen/tests/`, or `mach` fails with "lists test that does not exist".
- A change to `surfer.json` means Firefox moved: `npm run sync`, `npm run import`,
  and a full engine rebuild; `./mach build faster` is not enough.
- `~/Tools/scripts/zen-install` copies the build to `~/.local/lib/zen-custom`
  and rewrites the `zen-custom` launcher; `zen-release` makes a release build.
  Both replace the wrapper described above, so don't run them casually.

## Git

- Develop on a short-lived `feat/...` branch and push it to `origin` (the
  fork). When it is finished, merge it into `dev`, push `dev`, and delete the
  branch (local and remote); don't leave finished work only on a feature
  branch. Open a PR only when asked. End commit messages with the Co-Authored-By trailer from the
  session.
