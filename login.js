(function () {
  "use strict";

  const tabs = Array.from(document.querySelectorAll("[data-auth-view]"));
  const panels = Array.from(document.querySelectorAll("[data-auth-panel]"));
  const toast = document.querySelector("#toast");

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

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => showPanel(tab.dataset.authView));
  });

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
    const password = document.querySelector("#register-password").value;
    const { error } = await auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: "aluno"
        }
      }
    });

    if (error) {
      showToast("Nao foi possivel criar o cadastro.");
      return;
    }

    showToast("Cadastro criado. Verifique seu e-mail se a confirmacao estiver ativa.");
    form.reset();
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
}());
