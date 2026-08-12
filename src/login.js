(function () {
  "use strict";

  const cfg  = window.LabConConfig;
  function csrfHeaders() {
    return { "Content-Type": "application/json", "X-CSRF-Token": window.LabConCsrfToken || "" };
  }
  const tabs   = Array.from(document.querySelectorAll("[data-auth-view]"));
  const panels = Array.from(document.querySelectorAll("[data-auth-panel]"));
  const toast  = document.querySelector("#toast");
  let professors = [];

  function showPanel(view) {
    tabs.forEach((t)   => t.classList.toggle("active", t.dataset.authView   === view));
    panels.forEach((p) => p.classList.toggle("active", p.dataset.authPanel  === view));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => toast.classList.remove("show"), cfg.toastDuration);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[c]);
  }

  function selectedLevel() { return document.querySelector("#register-level").value; }

  function fillCourses() {
    const select = document.querySelector("#register-course");
    if (!select) return;
    const current = select.value;
    select.innerHTML = cfg.courses
      .map((c) => `<option value="${escapeHtml(c)}" ${c === current ? "selected" : ""}>${escapeHtml(c)}</option>`)
      .join("");
  }

  function updateStudentFields() {
    const isPostgrad = selectedLevel() === "pos-graduacao";

    document.querySelector("#register-undergrad-fields").classList.toggle("hidden", isPostgrad);
    document.querySelector("#register-postgrad-fields").classList.toggle("hidden", !isPostgrad);
  }

  async function loadProfessors() {
    const select = document.querySelector("#register-advisor");
    if (!select) return;
    select.innerHTML = `<option value="">Carregando...</option>`;
    select.disabled  = true;

    try {
      const res   = await fetch("api/state.php");
      const state = await res.json();
      professors  = [...state.users]
        .filter((u) => u.role === "professor")
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    } catch {
      professors = [];
    }

    select.disabled = false;
    select.innerHTML = professors.length
      ? `<option value="">Selecione</option>` + professors.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("")
      : `<option value="">Nenhum professor cadastrado</option>`;
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => {
    showPanel(tab.dataset.authView);
    if (tab.dataset.authView === "register") loadProfessors();
  }));

  document.querySelector("#register-level").addEventListener("change", updateStudentFields);

  // Login
  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email    = document.querySelector("#login-email").value.trim();
    const password = document.querySelector("#login-password").value;

    try {
      const res    = await fetch("api/auth.php", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ action: "login", email, password })
      });
      const result = await res.json();
      if (!result.success) { showToast(result.error || "Não foi possível entrar."); return; }
      window.location.href = "admin.php";
    } catch {
      showToast("Erro de conexão.");
    }
  });

  // Registro
  document.querySelector("#register-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const level = selectedLevel();

    const advisorEl = document.querySelector("#register-advisor");
    const advisor   = professors.find((p) => p.id === advisorEl.value);
    if (!advisor) { showToast("Selecione um professor orientador."); return; }

    const body = {
      action:   "register",
      name:     document.querySelector("#register-name").value.trim(),
      email:    document.querySelector("#register-email").value.trim(),
      password: document.querySelector("#register-password").value,
      level,
      advisorId:   advisor.id,
      advisorName: advisor.name,
      researchProject: document.querySelector("#register-research-project").value.trim()
    };

    if (level === "graduacao") {
      body.course   = document.querySelector("#register-course").value;
      body.program  = document.querySelector("#register-program").value;
    } else {
      body.postgradType = document.querySelector("#register-postgrad-type").value;
    }

    try {
      const res    = await fetch("api/auth.php", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify(body)
      });
      const result = await res.json();
      if (!result.success) { showToast(result.error || "Não foi possível criar o cadastro."); return; }
      window.location.href = "admin.php";
    } catch {
      showToast("Erro de conexão.");
    }
  });

  // Recuperar senha
  document.querySelector("#recover-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.querySelector("#recover-email").value.trim();

    try {
      const res = await fetch("api/auth.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "requestPasswordReset", email })
      });
      const result = await res.json();
      if (!result.success) { showToast(result.error || "Nao foi possivel enviar a recuperacao."); return; }
      showToast("Se o e-mail existir, enviaremos as instrucoes de recuperacao.");
      document.querySelector("#recover-form").reset();
    } catch {
      showToast("Erro de conexao.");
    }
  });

  // Se já logado, redireciona
  fetch("api/auth.php")
    .then((r) => r.json())
    .then((s) => { if (s.authenticated) window.location.href = "admin.php"; })
    .catch(() => {});

  fillCourses();
  updateStudentFields();
}());
