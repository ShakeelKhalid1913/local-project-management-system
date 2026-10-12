"""PMS — local multi-project task manager (Flask + SQLite)."""

from __future__ import annotations

import io
from datetime import datetime, timezone

from flask import Flask, jsonify, render_template, request, send_file

import database as db
from paths import resource_dir

_ROOT = resource_dir()
app = Flask(
    __name__,
    template_folder=str(_ROOT / "templates"),
    static_folder=str(_ROOT / "static"),
)
db.init_db()


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/projects")
def api_list_projects():
    return jsonify(db.list_projects())


@app.post("/api/projects")
def api_create_project():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400
    project = db.create_project(
        name=name,
        description=data.get("description") or "",
        color=data.get("color") or "#0057FF",
    )
    return jsonify(project), 201


@app.get("/api/projects/<int:project_id>")
def api_get_project(project_id: int):
    project = db.get_project(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    return jsonify(project)


@app.patch("/api/projects/<int:project_id>")
def api_update_project(project_id: int):
    data = request.get_json(silent=True) or {}
    project = db.update_project(
        project_id,
        name=data.get("name"),
        description=data.get("description"),
        color=data.get("color"),
    )
    if not project:
        return jsonify({"error": "Project not found"}), 404
    return jsonify(project)


@app.delete("/api/projects/<int:project_id>")
def api_delete_project(project_id: int):
    if not db.delete_project(project_id):
        return jsonify({"error": "Project not found"}), 404
    return "", 204


@app.get("/api/tasks")
def api_list_tasks():
    project_id = request.args.get("project_id", type=int)
    status = request.args.get("status")
    q = request.args.get("q")
    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=10, type=int)
    return jsonify(
        db.list_tasks(
            project_id=project_id,
            status=status,
            q=q,
            page=page,
            per_page=per_page,
        )
    )


@app.post("/api/tasks")
def api_create_task():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    project_id = data.get("project_id")
    if not title:
        return jsonify({"error": "Title is required"}), 400
    if not project_id:
        return jsonify({"error": "Project is required"}), 400
    task = db.create_task(
        project_id=int(project_id),
        title=title,
        description=data.get("description") or "",
        status=data.get("status") or "todo",
        priority=int(data.get("priority") or 0),
    )
    if not task:
        return jsonify({"error": "Project not found"}), 404
    return jsonify(task), 201


@app.get("/api/tasks/<int:task_id>")
def api_get_task(task_id: int):
    task = db.get_task(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task)


@app.patch("/api/tasks/<int:task_id>")
def api_update_task(task_id: int):
    data = request.get_json(silent=True) or {}
    kwargs = {}
    for key in ("title", "description", "status", "priority", "project_id"):
        if key in data:
            kwargs[key] = data[key]
    task = db.update_task(task_id, **kwargs)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task)


@app.delete("/api/tasks/<int:task_id>")
def api_delete_task(task_id: int):
    if not db.delete_task(task_id):
        return jsonify({"error": "Task not found"}), 404
    return "", 204


@app.get("/api/export")
def api_export():
    projects = db.list_projects()
    if not projects:
        return jsonify({"error": "Nothing to export"}), 400

    payload = db.build_export_zip()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return send_file(
        io.BytesIO(payload),
        mimetype="application/zip",
        as_attachment=True,
        download_name=f"pms-export-{stamp}.zip",
    )


def run_server(host: str = "127.0.0.1", port: int = 5000, debug: bool = False) -> None:
    db.init_db()
    app.run(host=host, port=port, debug=debug, use_reloader=False)


if __name__ == "__main__":
    run_server(debug=True)
