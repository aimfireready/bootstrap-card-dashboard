# Bootstrap Card Dashboard

A config-driven bookmark dashboard built with Bootstrap 5. Define your sections and cards in `config.json` — no code changes needed.

## Features

- **Config-driven** — all sections, cards, links, and icons defined in `config.json`
- **Department filter** — dropdown to show only the sections relevant to a team or role
- **Drag-and-drop** — reorder cards across sections; layout is saved to `localStorage`
- **Hide/show cards** — enter Edit mode to hide individual cards; restore them any time
- **Collapsible sections** — collapse any section to reduce clutter
- **Dark mode** — toggles between light and dark themes, respects system preference
- **Export / Import / Reset** — share your layout as a JSON file or reset to defaults

## Setup

Serve the files from any web server (required for `fetch` to load `config.json`):

```bash
npx serve .
# or
python3 -m http.server
```

Then open `http://localhost:PORT` in your browser.

## Configuration

Edit `config.json`:

```json
{
  "departments": {
    "Finance": ["finance"]
  },
  "sections": [
    {
      "id": "finance",
      "title": "Finance",
      "cards": [
        { "id": "bank", "title": "Bank", "desc": "Online banking.", "img": "https://...", "url": "https://..." }
      ]
    }
  ]
}
```

## License

MIT
