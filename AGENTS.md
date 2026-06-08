# Repository Guidelines

## Project Structure & Module Organization

This repository is a Chrome Manifest V3 new-tab extension. Root files define the extension shell: `manifest.json`, `background.js`, `new_tab.html`, and `new_tab.css`. Application logic lives in `js/`, split by responsibility: `main.js` wires startup and events, `state.js` owns persisted data, `ui.js` renders views, `handlers.js` contains interaction flows, `syncLogic.js` handles WebDAV sync, and `WebDAVClient.js` wraps WebDAV calls. Static extension icons are in `icons/`. Third-party offline dependencies are vendored in `lib/`; keep minified Bootstrap, SortableJS, and pinyin files there rather than replacing them with CDN references.

## Build, Test, and Development Commands

There is no package manager or build step for the current project. Load the repository directly as an unpacked extension:

- Open `chrome://extensions`.
- Enable Developer mode.
- Choose Load unpacked and select this repository root.
- After edits, click Reload on the extension card and open a new tab.

For formatting, use Prettier if available:

```bash
npx prettier --write "js/**/*.js" "*.html" "*.css" "*.json" "*.md"
```

`.prettierignore` excludes vendored minified assets.

## Coding Style & Naming Conventions

Use ES modules, `const`/`let`, arrow functions where they improve clarity, and two-space indentation. Keep module boundaries clear: DOM lookups in `dom.js`, state persistence in `state.js`, rendering in `ui.js`, and user actions in `handlers.js`. Name functions with descriptive camelCase verbs, such as `performSearch` or `saveSyncSettings`. Preserve existing data keys used by Chrome storage, especially `smartNavData` and `sync_settings`, unless a migration is included.

## Testing Guidelines

No automated test suite is currently present. Validate changes manually in Chrome or a Chromium browser. At minimum, test new-tab loading, adding/editing/deleting icons, tab management, import/export, search engine selection, and WebDAV sync settings when affected. For storage changes, test both a fresh install and an existing profile with saved data.

## Commit & Pull Request Guidelines

Recent history uses concise subjects with conventional prefixes, especially `feat:` and `fix:`; follow that pattern, for example `feat: add sync status toast` or `fix: normalize imported URLs`. Pull requests should describe the user-facing change, list manual validation performed, link related issues when available, and include screenshots or short screen recordings for UI changes.

## Security & Configuration Tips

Do not commit personal WebDAV credentials, exported user data, or browser profile artifacts. Keep host permissions in `manifest.json` as narrow as possible and explain any new permission in the PR description.
