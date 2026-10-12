(() => {
  const COLORS = ["#0057FF", "#0A0A0A", "#C2410C", "#166534", "#7C3AED", "#B45309", "#0369A1", "#BE123C"];
  const STATUS_LABEL = { todo: "Todo", doing: "Doing", done: "Done" };

  const state = {
    projects: [],
    tasks: [],
    selectedProjectId: "all",
    statusFilter: "all",
    search: "",
    selectedTaskIndex: -1,
    commandIndex: 0,
    toastTimer: null,
    page: 1,
    perPage: 10,
    total: 0,
    pages: 1,
  };

  const el = {
    search: document.getElementById("search"),
    projectList: document.getElementById("project-list"),
    taskList: document.getElementById("task-list"),
    emptyState: document.getElementById("empty-state"),
    allCount: document.getElementById("all-count"),
    viewTitle: document.getElementById("view-title"),
    viewSubtitle: document.getElementById("view-subtitle"),
    taskDialog: document.getElementById("task-dialog"),
    projectDialog: document.getElementById("project-dialog"),
    commandDialog: document.getElementById("command-dialog"),
    helpDialog: document.getElementById("help-dialog"),
    taskForm: document.getElementById("task-form"),
    projectForm: document.getElementById("project-form"),
    taskId: document.getElementById("task-id"),
    taskTitle: document.getElementById("task-title"),
    taskDescription: document.getElementById("task-description"),
    taskProject: document.getElementById("task-project"),
    taskStatus: document.getElementById("task-status"),
    taskPriority: document.getElementById("task-priority"),
    taskDelete: document.getElementById("task-delete"),
    taskDialogTitle: document.getElementById("task-dialog-title"),
    projectId: document.getElementById("project-id"),
    projectName: document.getElementById("project-name"),
    projectDescription: document.getElementById("project-description"),
    projectColor: document.getElementById("project-color"),
    projectDelete: document.getElementById("project-delete"),
    projectDialogTitle: document.getElementById("project-dialog-title"),
    colorOptions: document.getElementById("color-options"),
    commandInput: document.getElementById("command-input"),
    commandList: document.getElementById("command-list"),
    toast: document.getElementById("toast"),
    pagination: document.getElementById("pagination"),
    paginationMeta: document.getElementById("pagination-meta"),
    pageNumbers: document.getElementById("page-numbers"),
    pagePrev: document.getElementById("page-prev"),
    pageNext: document.getElementById("page-next"),
  };

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.remove("hidden");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 1800);
  }

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
  }

  function anyDialogOpen() {
    return [el.taskDialog, el.projectDialog, el.commandDialog, el.helpDialog]
      .some((d) => !d.classList.contains("hidden"));
  }

  function openDialog(dialog) {
    dialog.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeDialog(dialog) {
    dialog.classList.add("hidden");
    if (!anyDialogOpen()) document.body.style.overflow = "";
  }

  function closeAllDialogs() {
    [el.taskDialog, el.projectDialog, el.commandDialog, el.helpDialog].forEach(closeDialog);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function selectedProject() {
    if (state.selectedProjectId === "all") return null;
    return state.projects.find((p) => p.id === state.selectedProjectId) || null;
  }

  function filteredTasks() {
    return state.tasks;
  }

  function selectedTask() {
    const tasks = filteredTasks();
    if (state.selectedTaskIndex < 0 || state.selectedTaskIndex >= tasks.length) return null;
    return tasks[state.selectedTaskIndex];
  }

  async function loadProjects() {
    state.projects = await api("/api/projects");
    renderProjects();
    fillTaskProjectSelect();
  }

  async function loadTasks() {
    const params = new URLSearchParams();
    if (state.selectedProjectId !== "all") params.set("project_id", state.selectedProjectId);
    if (state.statusFilter !== "all") params.set("status", state.statusFilter);
    if (state.search.trim()) params.set("q", state.search.trim());
    params.set("page", String(state.page));
    params.set("per_page", String(state.perPage));
    const data = await api(`/api/tasks?${params.toString()}`);
    state.tasks = data.items || [];
    state.total = data.total || 0;
    state.page = data.page || 1;
    state.pages = data.pages || 1;
    state.perPage = data.per_page || 10;
    if (!state.tasks.length && state.page > 1 && state.total > 0) {
      state.page -= 1;
      return loadTasks();
    }
    if (state.selectedTaskIndex >= state.tasks.length) {
      state.selectedTaskIndex = state.tasks.length - 1;
    }
    renderTasks();
    renderPagination();
  }

  async function goToPage(page) {
    const next = Math.max(1, Math.min(page, state.pages || 1));
    if (next === state.page && state.tasks.length) {
      renderPagination();
      return;
    }
    state.page = next;
    state.selectedTaskIndex = 0;
    await loadTasks();
  }

  function renderPagination() {
    if (!el.pagination) return;
    if (!state.total) {
      el.pagination.classList.add("hidden");
      return;
    }
    el.pagination.classList.remove("hidden");

    const start = (state.page - 1) * state.perPage + 1;
    const end = Math.min(state.page * state.perPage, state.total);
    el.paginationMeta.textContent = `${start}–${end} of ${state.total}`;

    el.pagePrev.disabled = state.page <= 1;
    el.pageNext.disabled = state.page >= state.pages;

    const pages = [];
    const totalPages = state.pages;
    const current = state.page;
    const windowSize = 5;
    let from = Math.max(1, current - Math.floor(windowSize / 2));
    let to = Math.min(totalPages, from + windowSize - 1);
    from = Math.max(1, to - windowSize + 1);

    if (from > 1) {
      pages.push(1);
      if (from > 2) pages.push("…");
    }
    for (let p = from; p <= to; p += 1) pages.push(p);
    if (to < totalPages) {
      if (to < totalPages - 1) pages.push("…");
      pages.push(totalPages);
    }

    el.pageNumbers.innerHTML = pages
      .map((p) => {
        if (p === "…") {
          return `<span class="px-1 text-xs text-mute">…</span>`;
        }
        const active = p === current;
        return `<button type="button" data-page="${p}"
          class="cursor-pointer h-8 min-w-8 px-2 rounded-lg text-xs font-semibold transition ${
            active
              ? "bg-ink text-panel"
              : "border border-line bg-panel text-mute hover:text-ink"
          }">${p}</button>`;
      })
      .join("");
  }

  async function refresh() {
    await loadProjects();
    await loadTasks();
  }

  function projectIcon(color, size = 24) {
    const safe = escapeHtml(color || "#0057FF");
    const icon = Math.round(size * 0.55);
    return `
      <span class="project-icon shrink-0 inline-grid place-items-center border border-line"
        style="width:${size}px;height:${size}px;background:${safe}14;color:${safe}">
        <svg width="${icon}" height="${icon}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 8.5h18v10.2A1.8 1.8 0 0 1 19.2 20.5H4.8A1.8 1.8 0 0 1 3 18.7V8.5Z" fill="currentColor" opacity="0.9"/>
          <path d="M3 8.2A1.7 1.7 0 0 1 4.7 6.5h3.2c.4 0 .7.2.9.5L9.8 8.2H20.3c.4 0 .7.3.7.7V9.5H3V8.2Z" fill="currentColor"/>
        </svg>
      </span>`;
  }

  function fillTaskProjectSelect(preferredId) {
    const options = state.projects
      .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
      .join("");
    el.taskProject.innerHTML = options || `<option value="">No projects</option>`;
    if (preferredId) el.taskProject.value = String(preferredId);
    else if (state.selectedProjectId !== "all") el.taskProject.value = String(state.selectedProjectId);
  }

  function renderProjects() {
    const totalTasks = state.projects.reduce((sum, p) => sum + (p.task_count || 0), 0);
    el.allCount.textContent = String(totalTasks);

    document.querySelectorAll("[data-project-filter]").forEach((btn) => {
      const id = btn.getAttribute("data-project-filter");
      btn.setAttribute("aria-current", id === String(state.selectedProjectId) ? "true" : "false");
    });

    el.projectList.innerHTML = state.projects
      .map((p) => {
        const current = p.id === state.selectedProjectId;
        return `
          <button type="button" data-project-id="${p.id}"
            class="project-item cursor-pointer w-full text-left px-2 py-1.5 text-sm hover:bg-soft transition flex items-center justify-between gap-2 group"
            aria-current="${current ? "true" : "false"}">
            <span class="flex items-center gap-2 min-w-0">
              ${projectIcon(p.color, 24)}
              <span class="truncate">${escapeHtml(p.name)}</span>
            </span>
            <span class="flex items-center gap-1">
              <span class="font-mono text-[11px] text-mute tabular-nums">${p.done_count || 0}/${p.task_count || 0}</span>
              <span data-edit-project="${p.id}" title="Edit project"
                class="cursor-pointer opacity-0 group-hover:opacity-100 size-6 text-mute hover:text-ink grid place-items-center transition">
                <svg class="size-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </span>
            </span>
          </button>`;
      })
      .join("");

    const project = selectedProject();
    if (project) {
      el.viewTitle.textContent = project.name;
      el.viewSubtitle.textContent = project.description || "Project tasks";
    } else {
      el.viewTitle.textContent = "All projects";
      el.viewSubtitle.textContent = state.projects.length
        ? `${state.projects.length} projects · press N`
        : "Create a project, then press N.";
    }
  }

  function formatDate(value) {
    if (!value) return "";
    // SQLite stores UTC-ish "YYYY-MM-DD HH:MM:SS"
    const raw = String(value).replace(" ", "T");
    const d = new Date(raw.includes("Z") || raw.includes("+") ? raw : `${raw}Z`);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((startToday - startThat) / 86400000);

    if (diffDays === 0) {
      return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) {
      return d.toLocaleDateString(undefined, { weekday: "short" });
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function formatDateTitle(value) {
    if (!value) return "";
    const raw = String(value).replace(" ", "T");
    const d = new Date(raw.includes("Z") || raw.includes("+") ? raw : `${raw}Z`);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function renderTasks() {
    const tasks = filteredTasks();
    if (!tasks.length) {
      el.taskList.innerHTML = "";
      el.emptyState.classList.remove("hidden");
      return;
    }
    el.emptyState.classList.add("hidden");

    el.taskList.innerHTML = tasks
      .map((t, index) => {
        const selected = index === state.selectedTaskIndex;
        const priority =
          t.priority >= 2
            ? '<span class="ml-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-warn">Urgent</span>'
            : t.priority === 1
              ? '<span class="ml-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-warn">High</span>'
              : "";
        const desc = t.description
          ? `<p class="text-xs text-mute truncate mt-0.5">${escapeHtml(t.description)}</p>`
          : "";
        const dateLabel = formatDate(t.created_at);
        const dateTitle = formatDateTitle(t.created_at);
        return `
          <div class="task-row cursor-pointer grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_88px_72px_110px_72px] gap-2 items-center px-3 py-2 hover:bg-soft transition-colors duration-150"
            data-task-index="${index}" data-task-id="${t.id}" aria-selected="${selected ? "true" : "false"}" tabindex="0">
            <div class="min-w-0">
              <div class="flex items-center min-w-0">
                <span class="text-sm font-medium text-ink truncate ${t.status === "done" ? "line-through text-mute" : ""}">${escapeHtml(t.title)}</span>
                ${priority}
              </div>
              ${desc}
              <div class="sm:hidden mt-1 flex items-center gap-2 flex-wrap">
                <span class="font-mono text-[11px] text-mute" title="${escapeHtml(dateTitle)}">${escapeHtml(dateLabel)}</span>
                <span class="status-${t.status} font-mono text-[11px] font-semibold uppercase tracking-wide">${STATUS_LABEL[t.status]}</span>
                <span class="text-[11px] text-mute truncate">${escapeHtml(t.project_name || "")}</span>
              </div>
            </div>
            <div class="hidden sm:block">
              <time class="font-mono text-[11px] text-mute tabular-nums" datetime="${escapeHtml(t.created_at || "")}" title="${escapeHtml(dateTitle)}">${escapeHtml(dateLabel)}</time>
            </div>
            <div class="hidden sm:block">
              <span class="status-${t.status} font-mono text-[11px] font-semibold uppercase tracking-wide">${STATUS_LABEL[t.status]}</span>
            </div>
            <div class="hidden md:block min-w-0">
              <span class="inline-flex items-center gap-2 text-xs text-mute truncate">
                ${projectIcon(t.project_color || "#0057FF", 20)}
                <span class="truncate">${escapeHtml(t.project_name || "")}</span>
              </span>
            </div>
            <div class="flex items-center justify-end gap-0.5">
              <button type="button" data-cycle-status="${t.id}" title="Cycle status"
                class="cursor-pointer size-7 text-mute hover:text-ink hover:bg-soft transition grid place-items-center">
                <svg class="size-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 3v6h-6"/></svg>
              </button>
              <button type="button" data-edit-task="${t.id}" title="Edit"
                class="cursor-pointer size-7 text-mute hover:text-ink hover:bg-soft transition grid place-items-center">
                <svg class="size-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
            </div>
          </div>`;
      })
      .join("");
  }

  function setSelectedTaskIndex(index) {
    const tasks = filteredTasks();
    if (!tasks.length) {
      state.selectedTaskIndex = -1;
      renderTasks();
      return;
    }
    state.selectedTaskIndex = Math.max(0, Math.min(index, tasks.length - 1));
    renderTasks();
    const row = el.taskList.querySelector(`[data-task-index="${state.selectedTaskIndex}"]`);
    if (row) row.scrollIntoView({ block: "nearest" });
  }

  function renderColorOptions(selected) {
    el.colorOptions.innerHTML = COLORS.map((color) => {
      const active = color.toLowerCase() === String(selected || "").toLowerCase();
      return `
        <button type="button" data-color="${color}"
          class="cursor-pointer size-7 border ${active ? "border-ink outline outline-1 outline-ink outline-offset-1" : "border-line"} transition-colors duration-150"
          style="background:${color}" aria-label="Color ${color}"></button>`;
    }).join("");
    el.projectColor.value = selected || COLORS[0];
  }

  function openNewTask() {
    if (!state.projects.length) {
      toast("Create a project first");
      openNewProject();
      return;
    }
    el.taskDialogTitle.textContent = "New task";
    el.taskId.value = "";
    el.taskForm.reset();
    el.taskStatus.value = "todo";
    el.taskPriority.value = "0";
    fillTaskProjectSelect();
    el.taskDelete.classList.add("hidden");
    openDialog(el.taskDialog);
    setTimeout(() => el.taskTitle.focus(), 20);
  }

  function openEditTask(task) {
    el.taskDialogTitle.textContent = "Edit task";
    el.taskId.value = String(task.id);
    el.taskTitle.value = task.title;
    el.taskDescription.value = task.description || "";
    fillTaskProjectSelect(task.project_id);
    el.taskStatus.value = task.status;
    el.taskPriority.value = String(task.priority || 0);
    el.taskDelete.classList.remove("hidden");
    openDialog(el.taskDialog);
    setTimeout(() => el.taskTitle.focus(), 20);
  }

  function openNewProject() {
    el.projectDialogTitle.textContent = "New project";
    el.projectId.value = "";
    el.projectForm.reset();
    renderColorOptions(COLORS[0]);
    el.projectDelete.classList.add("hidden");
    openDialog(el.projectDialog);
    setTimeout(() => el.projectName.focus(), 20);
  }

  function openEditProject(project) {
    el.projectDialogTitle.textContent = "Edit project";
    el.projectId.value = String(project.id);
    el.projectName.value = project.name;
    el.projectDescription.value = project.description || "";
    renderColorOptions(project.color || COLORS[0]);
    el.projectDelete.classList.remove("hidden");
    openDialog(el.projectDialog);
    setTimeout(() => el.projectName.focus(), 20);
  }

  function getCommands() {
    const cmds = [
      { id: "new-task", label: "New task", hint: "N", run: openNewTask },
      { id: "new-project", label: "New project", hint: "P", run: openNewProject },
      { id: "export", label: "Export all projects", hint: "ZIP", run: exportProjects },
      { id: "theme", label: "Toggle dark mode", hint: "", run: toggleTheme },
      { id: "help", label: "Show shortcuts", hint: "?", run: () => openDialog(el.helpDialog) },
      { id: "all", label: "Show all projects", hint: "", run: () => selectProject("all") },
    ];
    state.projects.forEach((p) => {
      cmds.push({
        id: `project-${p.id}`,
        label: `Open project: ${p.name}`,
        hint: "",
        run: () => selectProject(p.id),
      });
    });
    return cmds;
  }

  function renderCommands(query = "") {
    const q = query.trim().toLowerCase();
    const commands = getCommands().filter((c) => !q || c.label.toLowerCase().includes(q));
    if (state.commandIndex >= commands.length) state.commandIndex = 0;
    if (!commands.length) {
      el.commandList.innerHTML = `<div class="px-3 py-6 text-sm text-mute text-center">No matches</div>`;
      return [];
    }
    el.commandList.innerHTML = commands
      .map((c, i) => `
        <button type="button" data-command-index="${i}"
          class="cursor-pointer w-full text-left px-2.5 py-2 text-sm flex items-center justify-between gap-3 ${i === state.commandIndex ? "bg-soft text-ink" : "hover:bg-soft text-mute"} transition-colors duration-150">
          <span class="font-medium text-ink">${escapeHtml(c.label)}</span>
          ${c.hint ? `<span class="font-mono text-[11px] text-mute">${escapeHtml(c.hint)}</span>` : ""}
        </button>`)
      .join("");
    return commands;
  }

  function openCommandPalette() {
    state.commandIndex = 0;
    el.commandInput.value = "";
    renderCommands("");
    openDialog(el.commandDialog);
    setTimeout(() => el.commandInput.focus(), 20);
  }

  async function selectProject(id) {
    state.selectedProjectId = id === "all" ? "all" : Number(id);
    state.selectedTaskIndex = 0;
    state.page = 1;
    closeAllDialogs();
    await loadTasks();
    renderProjects();
  }

  async function setTaskStatus(task, status) {
    await api(`/api/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    toast(`Marked ${STATUS_LABEL[status].toLowerCase()}`);
    await refresh();
  }

  async function cycleTaskStatus(task) {
    const order = ["todo", "doing", "done"];
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    await setTaskStatus(task, next);
  }

  // Events
  document.getElementById("btn-new-task").addEventListener("click", openNewTask);
  document.getElementById("btn-new-project").addEventListener("click", openNewProject);
  document.getElementById("btn-help").addEventListener("click", () => openDialog(el.helpDialog));
  document.getElementById("btn-theme").addEventListener("click", toggleTheme);
  document.getElementById("btn-export").addEventListener("click", exportProjects);

  function toggleTheme() {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("pms-theme", dark ? "dark" : "light");
    } catch (_) {}
    toast(dark ? "Dark mode" : "Light mode");
  }

  async function exportProjects() {
    if (!state.projects.length) {
      toast("Nothing to export");
      return;
    }
    try {
      const res = await fetch("/api/export");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.href = url;
      a.download = `pms-export-${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Export downloaded");
    } catch (err) {
      toast(err.message || "Export failed");
    }
  }

  document.querySelectorAll("[data-close]").forEach((node) => {
    node.addEventListener("click", () => {
      const which = node.getAttribute("data-close");
      if (which === "task") closeDialog(el.taskDialog);
      if (which === "project") closeDialog(el.projectDialog);
      if (which === "command") closeDialog(el.commandDialog);
      if (which === "help") closeDialog(el.helpDialog);
    });
  });

  document.querySelector('[data-project-filter="all"]').addEventListener("click", () => selectProject("all"));

  el.projectList.addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit-project]");
    if (edit) {
      e.stopPropagation();
      const project = state.projects.find((p) => p.id === Number(edit.getAttribute("data-edit-project")));
      if (project) openEditProject(project);
      return;
    }
    const btn = e.target.closest("[data-project-id]");
    if (btn) selectProject(Number(btn.getAttribute("data-project-id")));
  });

  document.querySelectorAll(".status-filter").forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.statusFilter = btn.getAttribute("data-status-filter");
      document.querySelectorAll(".status-filter").forEach((b) => {
        const active = b === btn;
        b.classList.toggle("bg-ink", active);
        b.classList.toggle("text-panel", active);
        b.classList.toggle("text-mute", !active);
      });
      state.selectedTaskIndex = 0;
      state.page = 1;
      await loadTasks();
    });
  });

  let searchTimer;
  el.search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      state.search = el.search.value;
      state.selectedTaskIndex = 0;
      state.page = 1;
      await loadTasks();
    }, 150);
  });

  el.pagePrev.addEventListener("click", () => goToPage(state.page - 1));
  el.pageNext.addEventListener("click", () => goToPage(state.page + 1));
  el.pageNumbers.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-page]");
    if (!btn) return;
    goToPage(Number(btn.getAttribute("data-page")));
  });

  el.taskList.addEventListener("click", async (e) => {
    const cycle = e.target.closest("[data-cycle-status]");
    if (cycle) {
      const task = state.tasks.find((t) => t.id === Number(cycle.getAttribute("data-cycle-status")));
      if (task) await cycleTaskStatus(task);
      return;
    }
    const edit = e.target.closest("[data-edit-task]");
    if (edit) {
      const task = state.tasks.find((t) => t.id === Number(edit.getAttribute("data-edit-task")));
      if (task) openEditTask(task);
      return;
    }
    const row = e.target.closest("[data-task-index]");
    if (row) {
      setSelectedTaskIndex(Number(row.getAttribute("data-task-index")));
      if (e.detail === 2) {
        const task = selectedTask();
        if (task) openEditTask(task);
      }
    }
  });

  el.taskList.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const task = selectedTask();
      if (task) openEditTask(task);
    }
  });

  el.colorOptions.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-color]");
    if (!btn) return;
    renderColorOptions(btn.getAttribute("data-color"));
  });

  el.taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      title: el.taskTitle.value.trim(),
      description: el.taskDescription.value.trim(),
      project_id: Number(el.taskProject.value),
      status: el.taskStatus.value,
      priority: Number(el.taskPriority.value),
    };
    if (!payload.title || !payload.project_id) return;

    try {
      if (el.taskId.value) {
        await api(`/api/tasks/${el.taskId.value}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast("Task updated");
      } else {
        await api("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
        toast("Task created");
        state.selectedTaskIndex = 0;
        state.page = 1;
      }
      closeDialog(el.taskDialog);
      await refresh();
    } catch (err) {
      toast(err.message);
    }
  });

  el.taskDelete.addEventListener("click", async () => {
    if (!el.taskId.value) return;
    if (!confirm("Delete this task?")) return;
    await api(`/api/tasks/${el.taskId.value}`, { method: "DELETE" });
    closeDialog(el.taskDialog);
    toast("Task deleted");
    await refresh();
  });

  el.projectForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: el.projectName.value.trim(),
      description: el.projectDescription.value.trim(),
      color: el.projectColor.value,
    };
    if (!payload.name) return;

    try {
      if (el.projectId.value) {
        await api(`/api/projects/${el.projectId.value}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast("Project updated");
      } else {
        const created = await api("/api/projects", { method: "POST", body: JSON.stringify(payload) });
        state.selectedProjectId = created.id;
        toast("Project created");
      }
      closeDialog(el.projectDialog);
      await refresh();
    } catch (err) {
      toast(err.message);
    }
  });

  el.projectDelete.addEventListener("click", async () => {
    if (!el.projectId.value) return;
    if (!confirm("Delete this project and all its tasks?")) return;
    const id = Number(el.projectId.value);
    await api(`/api/projects/${id}`, { method: "DELETE" });
    if (state.selectedProjectId === id) state.selectedProjectId = "all";
    closeDialog(el.projectDialog);
    toast("Project deleted");
    await refresh();
  });

  el.commandInput.addEventListener("input", () => {
    state.commandIndex = 0;
    renderCommands(el.commandInput.value);
  });

  el.commandList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-command-index]");
    if (!btn) return;
    const commands = renderCommands(el.commandInput.value);
    const cmd = commands[Number(btn.getAttribute("data-command-index"))];
    if (cmd) {
      closeDialog(el.commandDialog);
      cmd.run();
    }
  });

  el.commandInput.addEventListener("keydown", (e) => {
    const commands = getCommands().filter((c) => {
      const q = el.commandInput.value.trim().toLowerCase();
      return !q || c.label.toLowerCase().includes(q);
    });
    if (e.key === "ArrowDown") {
      e.preventDefault();
      state.commandIndex = (state.commandIndex + 1) % Math.max(commands.length, 1);
      renderCommands(el.commandInput.value);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      state.commandIndex = (state.commandIndex - 1 + Math.max(commands.length, 1)) % Math.max(commands.length, 1);
      renderCommands(el.commandInput.value);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = commands[state.commandIndex];
      if (cmd) {
        closeDialog(el.commandDialog);
        cmd.run();
      }
    }
  });

  window.addEventListener("keydown", async (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const typing = isTypingTarget(e.target);

    if (e.key === "Escape") {
      if (anyDialogOpen()) {
        e.preventDefault();
        closeAllDialogs();
      }
      return;
    }

    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openCommandPalette();
      return;
    }

    if (anyDialogOpen()) return;
    if (typing && e.key !== "/") return;

    if (!typing && !mod && e.key.toLowerCase() === "n") {
      e.preventDefault();
      openNewTask();
      return;
    }

    if (!typing && !mod && e.key.toLowerCase() === "p") {
      e.preventDefault();
      openNewProject();
      return;
    }

    if (e.key === "/" && !typing) {
      e.preventDefault();
      el.search.focus();
      el.search.select();
      return;
    }

    if (e.key === "?" && !typing) {
      e.preventDefault();
      openDialog(el.helpDialog);
      return;
    }

    if ((e.key === "j" || e.key === "ArrowDown") && !typing) {
      e.preventDefault();
      if (state.selectedTaskIndex >= state.tasks.length - 1 && state.page < state.pages) {
        await goToPage(state.page + 1);
        setSelectedTaskIndex(0);
        return;
      }
      setSelectedTaskIndex(state.selectedTaskIndex < 0 ? 0 : state.selectedTaskIndex + 1);
      return;
    }

    if ((e.key === "k" || e.key === "ArrowUp") && !typing) {
      e.preventDefault();
      if (state.selectedTaskIndex <= 0 && state.page > 1) {
        await goToPage(state.page - 1);
        setSelectedTaskIndex(state.tasks.length - 1);
        return;
      }
      setSelectedTaskIndex(state.selectedTaskIndex < 0 ? 0 : state.selectedTaskIndex - 1);
      return;
    }

    if (e.key === "Enter" && !typing) {
      const task = selectedTask();
      if (task) {
        e.preventDefault();
        openEditTask(task);
      }
      return;
    }

    if ((e.key === "Delete" || e.key === "Backspace") && !typing && (e.metaKey || e.ctrlKey || e.key === "Delete")) {
      const task = selectedTask();
      if (!task) return;
      e.preventDefault();
      if (!confirm(`Delete “${task.title}”?`)) return;
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      toast("Task deleted");
      await refresh();
      return;
    }

    if (!typing && ["1", "2", "3"].includes(e.key)) {
      const task = selectedTask();
      if (!task) return;
      e.preventDefault();
      const map = { 1: "todo", 2: "doing", 3: "done" };
      await setTaskStatus(task, map[e.key]);
    }
  });

  refresh().catch((err) => toast(err.message || "Failed to load"));
})();
