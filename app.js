const app = document.getElementById("app");

const STORAGE_KEY = "dolon.class8.state";
const AUTH = {
  admin: "dolon.admin",
  visitor: "dolon"
};

const defaultState = {
  notices: [
    { id: crypto.randomUUID(), title: "Welcome to Smart Campus", body: "All class updates now appear here in real-time." }
  ],
  homework: [
    { id: crypto.randomUUID(), title: "Mathematics", body: "Solve chapter 4 exercise questions 1-10 by tomorrow." }
  ],
  routine: [
    { id: crypto.randomUUID(), title: "Monday", body: "Math, Science, ICT, English" }
  ],
  classTime: [
    { id: crypto.randomUUID(), title: "Period 1", body: "8:30 AM - 9:15 AM" }
  ],
  locks: { notices: false, homework: false, routine: false, classTime: false },
  visibility: { notices: true, homework: true, routine: true, classTime: true },
  updatedAt: Date.now()
};

let state = loadState();
let session = { role: null, editMode: false };

window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY) {
    state = loadState();
    if (session.role) renderDashboard();
  }
});

renderLogin();

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed && typeof parsed === "object") {
      return { ...defaultState, ...parsed };
    }
  } catch {
    // ignore invalid persisted state
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
  return structuredClone(defaultState);
}

function saveState() {
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderLogin() {
  const node = document.getElementById("login-template").content.cloneNode(true);
  app.replaceChildren(node);

  const form = document.getElementById("auth-form");
  const title = document.getElementById("auth-title");
  const message = document.getElementById("auth-message");
  const passwordInput = document.getElementById("auth-password");
  let pendingRole = null;

  app.querySelectorAll(".role-btn").forEach((button) => {
    button.addEventListener("click", () => {
      pendingRole = button.dataset.role;
      message.textContent = "";

      if (pendingRole === "student") {
        session.role = "student";
        renderDashboard();
        return;
      }

      form.classList.remove("hidden");
      title.textContent = `${capitalize(pendingRole)} Login`;
      passwordInput.focus();
    });
  });

  document.getElementById("auth-cancel").addEventListener("click", () => {
    form.classList.add("hidden");
    pendingRole = null;
    passwordInput.value = "";
    message.textContent = "";
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!pendingRole) return;
    if (AUTH[pendingRole] === passwordInput.value.trim()) {
      session.role = pendingRole;
      session.editMode = false;
      renderDashboard();
      return;
    }
    message.textContent = "Wrong password. Access denied.";
  });
}

function renderDashboard() {
  const node = document.getElementById("dashboard-template").content.cloneNode(true);
  app.replaceChildren(node);

  const roleLabel = document.getElementById("role-label");
  roleLabel.textContent = `${capitalize(session.role)} Workspace`;

  const isAdmin = session.role === "admin";
  const canUseAi = session.role !== null;

  const adminControl = document.getElementById("admin-control");
  const editToggle = document.getElementById("edit-toggle");
  if (isAdmin) {
    editToggle.classList.remove("hidden");
    editToggle.textContent = `Edit Mode: ${session.editMode ? "ON" : "OFF"}`;
    editToggle.addEventListener("click", () => {
      session.editMode = !session.editMode;
      renderDashboard();
    });

    adminControl.classList.remove("hidden");
    adminControl.innerHTML = `
      <p class="eyebrow">Central Admin Control Panel</p>
      <h2>God Mode Controls</h2>
      <p class="subtitle">Manage all pages, content modules, lock state, and visibility for live users.</p>
      <div class="admin-grid">
        <div class="admin-chip">Live sync across tabs/users</div>
        <div class="admin-chip">Permission and visibility controls</div>
        <div class="admin-chip">Section lock / unlock</div>
        <div class="admin-chip">Instant dashboard publishing</div>
      </div>
    `;
  }

  document.getElementById("logout-btn").addEventListener("click", () => {
    session = { role: null, editMode: false };
    renderLogin();
  });

  ["notices", "homework", "routine", "classTime"].forEach((section) => {
    renderSection(section, isAdmin);
  });

  setupAI(canUseAi);
}

function renderSection(section, isAdmin) {
  const panel = app.querySelector(`[data-section='${section}']`);
  const list = document.getElementById(`${section}-list`);
  const form = app.querySelector(`[data-editor='${section}']`);
  const lockBtn = app.querySelector(`[data-lock='${section}']`);

  const isVisible = !!state.visibility[section];
  if (!isVisible) {
    panel.classList.add("hidden");
    return;
  }

  const isLocked = !!state.locks[section];
  lockBtn.classList.toggle("locked", isLocked);
  lockBtn.textContent = isLocked ? "🔒" : "🔓";
  lockBtn.disabled = !isAdmin;

  lockBtn.addEventListener("click", () => {
    if (!isAdmin) return;
    state.locks[section] = !state.locks[section];
    saveState();
    renderDashboard();
  });

  const items = state[section] || [];
  list.innerHTML = items
    .map(
      (item) => `
        <li class="content-item">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.body)}</p>
          ${
            isAdmin && session.editMode
              ? `<div class="item-actions">
              <button class="ghost" data-action="edit" data-id="${item.id}" data-section="${section}">Edit</button>
              <button class="ghost" data-action="delete" data-id="${item.id}" data-section="${section}">Delete</button>
            </div>`
              : ""
          }
        </li>
      `
    )
    .join("");

  const canEdit = isAdmin && session.editMode && !isLocked;
  form.classList.toggle("hidden", !canEdit);
  form.querySelector("button").disabled = !canEdit;

  if (!form.dataset.bound) {
    form.dataset.bound = "yes";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!canEdit) return;
      const data = new FormData(form);
      const title = String(data.get("title") || "").trim();
      const body = String(data.get("body") || "").trim();
      if (!title || !body) return;
      state[section].unshift({ id: crypto.randomUUID(), title, body });
      form.reset();
      saveState();
      renderDashboard();
    });
  }

  list.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      const action = button.dataset.action;
      if (!isAdmin || !session.editMode || isLocked) return;
      const idx = state[section].findIndex((item) => item.id === id);
      if (idx < 0) return;

      if (action === "delete") {
        state[section].splice(idx, 1);
      }

      if (action === "edit") {
        const current = state[section][idx];
        const title = prompt("Edit title", current.title);
        if (title === null) return;
        const body = prompt("Edit details", current.body);
        if (body === null) return;
        state[section][idx] = { ...current, title: title.trim() || current.title, body: body.trim() || current.body };
      }

      saveState();
      renderDashboard();
    });
  });

  if (isAdmin && session.editMode && !isLocked) {
    injectVisibilityToggle(panel, section);
  }
}

function injectVisibilityToggle(panel, section) {
  const head = panel.querySelector(".panel-head");
  if (head.querySelector(".visibility-toggle")) return;
  const btn = document.createElement("button");
  btn.className = "ghost visibility-toggle";
  btn.textContent = state.visibility[section] ? "Hide" : "Show";
  btn.addEventListener("click", () => {
    state.visibility[section] = !state.visibility[section];
    saveState();
    renderDashboard();
  });
  head.append(btn);
}

function setupAI(enabled) {
  const aiLog = document.getElementById("ai-log");
  const aiForm = document.getElementById("ai-form");
  const aiInput = document.getElementById("ai-input");

  pushAI(aiLog, "bot", getWelcomeMessage());

  aiForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!enabled) return;
    const q = aiInput.value.trim();
    if (!q) return;
    pushAI(aiLog, "user", q);
    const answer = respondToPrompt(q);
    setTimeout(() => pushAI(aiLog, "bot", answer), 260);
    aiInput.value = "";
  });
}

function getWelcomeMessage() {
  if (session.role === "admin") return "Welcome Admin. You can switch Edit Mode on to manage all modules, locks, and visibility instantly.";
  if (session.role === "student") return "Hi Student! I can explain routine, notices, homework, and how to use this portal.";
  return "Welcome Visitor. You can view public class details and ask for guided help.";
}

function respondToPrompt(promptText) {
  const input = promptText.toLowerCase();
  const isAdmin = session.role === "admin";
  const isVisitor = session.role === "visitor";

  if (input.includes("permission") || input.includes("role")) {
    if (isAdmin) return "Admin permissions: full create/edit/delete access, lock controls, and section visibility toggles.";
    if (isVisitor) return "Visitor permissions: view-only panels and limited assistant guidance.";
    return "Student permissions: view all visible sections and use AI support. Future edit access can be granted by admin.";
  }

  if (input.includes("notice")) return summarize("notices", "Notices");
  if (input.includes("homework")) return summarize("homework", "Homework");
  if (input.includes("routine")) return summarize("routine", "Routine");
  if (input.includes("time") || input.includes("class")) return summarize("classTime", "Class Time");
  if (input.includes("lock")) {
    return isAdmin
      ? "Use the glowing gold lock icons to lock/unlock sections. Locked sections disable edits in admin mode."
      : "Only admins can change lock state. You can still view unlocked visible content.";
  }

  if (input.includes("edit") || input.includes("update")) {
    return isAdmin
      ? "Enable Edit Mode from the top bar, then use each panel form or edit/delete buttons. All saves publish live instantly."
      : "Content updates are admin-controlled; your dashboard refreshes automatically when admin publishes changes.";
  }

  return `System summary: ${state.notices.length} notices, ${state.homework.length} homework items, ${state.routine.length} routine entries, ${state.classTime.length} class-time slots. Ask about a module for details.`;
}

function summarize(section, label) {
  const items = state[section];
  if (!items?.length) return `${label} is currently empty.`;
  const sample = items.slice(0, 2).map((item) => `${item.title}`).join("; ");
  return `${label} total ${items.length}. Latest: ${sample}.`;
}

function pushAI(container, role, text) {
  const div = document.createElement("div");
  div.className = `ai-msg ${role === "user" ? "ai-user" : "ai-bot"}`;
  div.textContent = text;
  container.append(div);
  container.scrollTop = container.scrollHeight;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
