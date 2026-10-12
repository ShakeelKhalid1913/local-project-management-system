# PMS — Project Task Manager

Local multi-project task manager. SQLite on disk, keyboard-first UI, Tailwind front end.

## Run (Python)

```bash
pip install -r requirements.txt
python launcher.py
```

Or:

```bash
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000).

Data is stored in `data/pms.db`.

## Build Windows .exe

```bash
build_exe.bat
```

Then double-click:

- `dist\PMS.exe` (or `PMS.exe` in the project folder)
- or `PMS.bat` as a backup launcher

It starts the local server and opens your browser. **Close the console window to stop.**

Needs Python installed once (`pip install -r requirements.txt`). Your database is saved as `data\pms.db` next to the exe.

## Shortcuts

| Action | Keys |
| --- | --- |
| New task | `N` |
| New project | `P` |
| Command menu | `Ctrl+K` |
| Search | `/` |
| Prev / next page | pagination controls |
| Move selection | `J` / `K` |
| Edit selected | `Enter` |
| Status Todo / Doing / Done | `1` / `2` / `3` |
| Delete task | `Delete` |
| Help | `?` |
| Close | `Esc` |

## Features

- Create / edit / delete projects
- Create / edit / delete tasks (title, description, status, priority)
- Filter by project and status
- Search across titles and descriptions
- Pagination (10 tasks per page)
- Export all projects as a ZIP of Markdown files
- Dark mode toggle (saved locally)
- All data stays local in SQLite
