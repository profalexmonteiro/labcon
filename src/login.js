(function () {
  "use strict";

  const tabs = Array.from(document.querySelectorAll("[data-auth-view]"));
  const panels = Array.from(document.querySelectorAll("[data-auth-panel]"));
  const toast = document.querySelector("#toast");
  const emptyState = {
    users: [],
    labs: [],
    desks: [],
    reservations: []
  };
  let professors = [];

  function showPanel(view) {
    tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.authView === view));
    panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.authPanel === view));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function option(value, label) {
    return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
  }

  function sortByName(items) {
    return [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  function selectedRegisterRole() {
    return document.querySelector("#register-role").value;
  }

  function updateRegisterFields() {
    const advisorField = document.querySelector("#register-advisor")?.closest(".field");
    const advisorSelect = document.querySelector("#register-advisor");
    const needsAdvisor = selectedRegisterRole() === "aluno";
    if (!advisorField || !advisorSelect) return;

    advisorField.classList.toggle("hidden", !needsAdvisor);
    advisorSelect.required = needsAdvisor;
    if (!needsAdvisor) advisorSelect.value = "";
  }

  function loadLocalState() {
    const raw = localStorage.getItem("labcon-state-v1");
    if (!raw) return { ...emptyState };
    try {
      return { ...emptyState, ...JSON.parse(raw) };
    } catch {
      return { ...emptyState };
    }
  }

  async function loadProfessors() {
    const select = document.querySelector("#register-advisor");
    if (!select) return;

    select.innerHTML = option("", "Carregando professores...");
    select.disabled = true;

    try {
      const fallbackState = loadLocalState();
      const state = await window.LabConSupabase.loadState(fallbackState);
      localStorage.setItem("labcon-state-v1", JSON.stringify(state));
      professors = sortByName(state.users.filter((user) => user.role === "professor"));
    } catch (error) {
      console.warn("Nao foi possivel carregar professores do Supabase. Usando cache local.", error);
      professors = sortByName(loadLocalState().users.filter((user) => user.role === "professor"));
    }

    select.disabled = false;
    select.innerHTML = professors.length
      ? option("", "Selecione") + professors.map((professor) => option(professor.id, professor.name)).join("")
      : option("", "Cadastre um professor na area administrativa");
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => showPanel(tab.dataset.authView));
  });

  document.querySelector("#register-role").addEventListener("change", updateRegisterFields);

  function authClient() {
    if (!window.LabConSupabase?.client) {
      showToast("Cliente Supabase indisponivel.");
      return null;
    }
    return window.LabConSupabase.client.auth;
  }

  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const auth = authClient();
    if (!auth) return;
    const email = document.querySelector("#login-email").value.trim();
    const password = document.querySelector("#login-password").value;
    const { error } = await auth.signInWithPassword({ email, password });

    if (error) {
      showToast("Nao foi possivel entrar. Verifique e-mail e senha.");
      return;
    }

    localStorage.removeItem("labcon-session-role");
    window.location.href = "admin.html";
  });

  document.querySelector("#register-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const auth = authClient();
    if (!auth) return;
    const form = event.currentTarget;
    const name = document.querySelector("#register-name").value.trim();
    const email = document.querySelector("#register-email").value.trim();
    const role = selectedRegisterRole();
    const advisorId = document.querySelector("#register-advisor").value;
    const advisor = professors.find((professor) => professor.id === advisorId);
    const password = document.querySelector("#register-password").value;
    const metadata = {
      name,
      role
    };

    if (role === "aluno" && !advisor) {
      showToast("Selecione um professor orientador.");
      return;
    }

    if (role === "aluno") {
      metadata.advisorId = advisor.id;
      metadata.advisorName = advisor.name;
    }

    const { data, error } = await auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });

    if (error) {
      showToast("Nao foi possivel criar o cadastro.");
      return;
    }

    try {
      await window.LabConSupabase.upsertUserFromAuth(data.user);
    } catch (syncError) {
      console.warn("Cadastro criado no Auth; sincronizacao direta com labcon_state ficou para o trigger do Supabase.", syncError);
    }

    showToast("Cadastro criado. Verifique seu e-mail se a confirmacao estiver ativa.");
    form.reset();
    updateRegisterFields();
  });

  document.querySelector("#recover-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const auth = authClient();
    if (!auth) return;
    const email = document.querySelector("#recover-email").value.trim();
    const redirectTo = new URL("login.html", window.location.href).toString();
    const { error } = await auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      showToast("Nao foi possivel enviar a recuperacao.");
      return;
    }

    showToast("Instrucoes de recuperacao enviadas por e-mail.");
    event.currentTarget.reset();
  });

  loadProfessors();
  updateRegisterFields();
}());
