(function () {
  "use strict";

  const toast = document.querySelector("#toast");
  const cfg = window.LabConConfig || { toastDuration: 2600 };
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => toast.classList.remove("show"), cfg.toastDuration);
  }

  document.querySelector("#reset-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = document.querySelector("#reset-token").value;
    const password = document.querySelector("#reset-password").value;
    const confirm = document.querySelector("#reset-password-confirm").value;
    if (!token) { showToast("Link de recuperacao invalido."); return; }
    if (password !== confirm) { showToast("As senhas nao conferem."); return; }

    try {
      const res = await fetch("api/auth.php", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": window.LabConCsrfToken || "" },
        body: JSON.stringify({ action: "resetPassword", token, password })
      });
      const result = await res.json();
      if (!result.success) { showToast(result.error || "Nao foi possivel redefinir a senha."); return; }
      showToast("Senha redefinida. Redirecionando para o login.");
      window.setTimeout(() => { window.location.href = "login.php"; }, 900);
    } catch {
      showToast("Erro de conexao.");
    }
  });
}());
