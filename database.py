"""SQLite persistence for projects and tasks."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from paths import app_dir

DATA_DIR = app_dir() / "data"
DB_PATH = DATA_DIR / "pms.db"

STATUSES = ("todo", "doing", "done")


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


@contextmanager
def get_db() -> Iterator[sqlite3.Connection]:
    ensure_data_dir()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                color TEXT NOT NULL DEFAULT '#0057FF',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'doing', 'done')),
                priority INTEGER NOT NULL DEFAULT 0,
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_tasks_project
                ON tasks(project_id, status, position);
            """
        )


def _row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return dict(row)


def list_projects() -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT p.*,
                   COUNT(t.id) AS task_count,
                   SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done_count
            FROM projects p
            LEFT JOIN tasks t ON t.project_id = p.id
            GROUP BY p.id
            ORDER BY p.updated_at DESC, p.id DESC
            """
        ).fetchall()
        return [dict(r) for r in rows]


def get_project(project_id: int) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        return _row_to_dict(row)


def create_project(name: str, description: str = "", color: str = "#0057FF") -> dict[str, Any]:
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO projects (name, description, color)
            VALUES (?, ?, ?)
            """,
            (name.strip(), description.strip(), color),
        )
        project_id = cur.lastrowid
        row = conn.execute(
            "SELECT * FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        return dict(row)


def update_project(
    project_id: int,
    *,
    name: str | None = None,
    description: str | None = None,
    color: str | None = None,
) -> dict[str, Any] | None:
    project = get_project(project_id)
    if not project:
        return None

    next_name = name.strip() if name is not None else project["name"]
    next_desc = description.strip() if description is not None else project["description"]
    next_color = color if color is not None else project["color"]

    with get_db() as conn:
        conn.execute(
            """
            UPDATE projects
            SET name = ?, description = ?, color = ?,
                updated_at = datetime('now')
            WHERE id = ?
            """,
            (next_name, next_desc, next_color, project_id),
        )
        row = conn.execute(
            "SELECT * FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        return dict(row)


def delete_project(project_id: int) -> bool:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        return cur.rowcount > 0


def list_tasks(
    project_id: int | None = None,
    status: str | None = None,
    q: str | None = None,
    page: int = 1,
    per_page: int = 10,
) -> dict[str, Any]:
    clauses: list[str] = []
    params: list[Any] = []

    if project_id is not None:
        clauses.append("t.project_id = ?")
        params.append(project_id)
    if status and status in STATUSES:
        clauses.append("t.status = ?")
        params.append(status)
    if q:
        clauses.append("(t.title LIKE ? OR t.description LIKE ?)")
        like = f"%{q}%"
        params.extend([like, like])

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    page = max(1, int(page or 1))
    per_page = min(50, max(1, int(per_page or 10)))
    offset = (page - 1) * per_page

    with get_db() as conn:
        total_row = conn.execute(
            f"""
            SELECT COUNT(*) AS total
            FROM tasks t
            JOIN projects p ON p.id = t.project_id
            {where}
            """,
            params,
        ).fetchone()
        total = int(total_row["total"] if total_row else 0)
        pages = max(1, (total + per_page - 1) // per_page) if total else 1
        if page > pages:
            page = pages
            offset = (page - 1) * per_page

        rows = conn.execute(
            f"""
            SELECT t.*, p.name AS project_name, p.color AS project_color
            FROM tasks t
            JOIN projects p ON p.id = t.project_id
            {where}
            ORDER BY
                t.created_at DESC,
                t.id DESC
            LIMIT ? OFFSET ?
            """,
            [*params, per_page, offset],
        ).fetchall()

        return {
            "items": [dict(r) for r in rows],
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": pages,
        }


def get_task(task_id: int) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT t.*, p.name AS project_name, p.color AS project_color
            FROM tasks t
            JOIN projects p ON p.id = t.project_id
            WHERE t.id = ?
            """,
            (task_id,),
        ).fetchone()
        return _row_to_dict(row)


def create_task(
    project_id: int,
    title: str,
    description: str = "",
    status: str = "todo",
    priority: int = 0,
) -> dict[str, Any] | None:
    if not get_project(project_id):
        return None
    if status not in STATUSES:
        status = "todo"

    with get_db() as conn:
        pos_row = conn.execute(
            "SELECT COALESCE(MIN(position), 0) - 1 AS next_pos FROM tasks WHERE project_id = ?",
            (project_id,),
        ).fetchone()
        position = pos_row["next_pos"] if pos_row else 0

        cur = conn.execute(
            """
            INSERT INTO tasks (project_id, title, description, status, priority, position)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                title.strip(),
                description.strip(),
                status,
                int(priority),
                position,
            ),
        )
        task_id = cur.lastrowid
        conn.execute(
            "UPDATE projects SET updated_at = datetime('now') WHERE id = ?",
            (project_id,),
        )

    return get_task(task_id)


def update_task(
    task_id: int,
    *,
    title: str | None = None,
    description: str | None = None,
    status: str | None = None,
    priority: int | None = None,
    project_id: int | None = None,
) -> dict[str, Any] | None:
    task = get_task(task_id)
    if not task:
        return None

    next_title = title.strip() if title is not None else task["title"]
    next_desc = description.strip() if description is not None else task["description"]
    next_status = status if status in STATUSES else task["status"]
    next_priority = int(priority) if priority is not None else task["priority"]
    next_project = project_id if project_id is not None else task["project_id"]

    if project_id is not None and not get_project(project_id):
        return None

    with get_db() as conn:
        conn.execute(
            """
            UPDATE tasks
            SET title = ?, description = ?, status = ?, priority = ?,
                project_id = ?, updated_at = datetime('now')
            WHERE id = ?
            """,
            (
                next_title,
                next_desc,
                next_status,
                next_priority,
                next_project,
                task_id,
            ),
        )
        conn.execute(
            "UPDATE projects SET updated_at = datetime('now') WHERE id = ?",
            (next_project,),
        )

    return get_task(task_id)


def delete_task(task_id: int) -> bool:
    task = get_task(task_id)
    if not task:
        return False
    with get_db() as conn:
        cur = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        if cur.rowcount:
            conn.execute(
                "UPDATE projects SET updated_at = datetime('now') WHERE id = ?",
                (task["project_id"],),
            )
        return cur.rowcount > 0


def _slugify(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in (value or "").strip())
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    cleaned = cleaned.strip("-")
    return cleaned or "project"


PRIORITY_LABEL = {0: "normal", 1: "high", 2: "urgent"}


def project_to_markdown(project: dict[str, Any], tasks: list[dict[str, Any]]) -> str:
    lines = [
        f"# {project['name']}",
        "",
        f"- Color: `{project.get('color') or ''}`",
        f"- Created: `{project.get('created_at') or ''}`",
        f"- Updated: `{project.get('updated_at') or ''}`",
        f"- Tasks: {len(tasks)}",
        "",
    ]
    description = (project.get("description") or "").strip()
    if description:
        lines.extend(["## Description", "", description, ""])

    lines.extend(["## Tasks", ""])
    if not tasks:
        lines.append("_No tasks._")
        lines.append("")
        return "\n".join(lines)

    for status in STATUSES:
        group = [t for t in tasks if t.get("status") == status]
        if not group:
            continue
        lines.append(f"### {status.upper()}")
        lines.append("")
        for task in group:
            priority = PRIORITY_LABEL.get(int(task.get("priority") or 0), "normal")
            lines.append(f"- **{task['title']}** `[{status}]` `[{priority}]`")
            desc = (task.get("description") or "").strip()
            if desc:
                for desc_line in desc.splitlines():
                    lines.append(f"  {desc_line}")
            lines.append(
                f"  - created: `{task.get('created_at') or ''}` · updated: `{task.get('updated_at') or ''}`"
            )
        lines.append("")

    return "\n".join(lines)


def build_export_zip() -> bytes:
    """One Markdown file per project inside a zip archive."""
    import io
    import json
    import zipfile
    from datetime import datetime, timezone

    projects = list_projects()
    buffer = io.BytesIO()
    used_names: set[str] = set()

    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        manifest = {
            "exported_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "project_count": len(projects),
            "format": "markdown-per-project",
            "projects": [],
        }

        for index, project in enumerate(projects, start=1):
            tasks = list_tasks(project_id=project["id"], page=1, per_page=10000)["items"]
            base = f"{index:02d}-{_slugify(project['name'])}"
            filename = f"{base}.md"
            if filename in used_names:
                filename = f"{base}-{project['id']}.md"
            used_names.add(filename)

            zf.writestr(filename, project_to_markdown(project, tasks))
            manifest["projects"].append(
                {
                    "id": project["id"],
                    "name": project["name"],
                    "file": filename,
                    "task_count": len(tasks),
                }
            )

        zf.writestr(
            "manifest.json",
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        )

    return buffer.getvalue()
