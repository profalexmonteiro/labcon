(function () {
  "use strict";

  const Config = window.LabConConfig;
  const collapsedLabs = new Set();

  const Utils = {
    clone(value) { return JSON.parse(JSON.stringify(value)); },

    uid(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; },

    escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
      })[c]);
    },

    sortByName(items) { return [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")); },

    option(value, label, selectedValue) {
      const sel = value === selectedValue ? "selected" : "";
      return `<option value="${Utils.escapeHtml(value)}" ${sel}>${Utils.escapeHtml(label)}</option>`;
    }
  };

  function csrfHeaders() {
    return { "Content-Type": "application/json", "X-CSRF-Token": window.LabConCsrfToken || "" };
  }

  // ─── Repository ───────────────────────────────────────────────────────────
  const Repository = {
    state: Utils.clone(Config.emptyState),

    getState() { return this.state; },

    async init() {
      const res = await fetch("api/state.php");
      if (!res.ok) throw new Error("Falha ao carregar dados do servidor.");
      this.state = await res.json();
    },

    async upsert(collection, item) {
      const endpoint = collection; // users, labs, desks, reservations
      const isNew    = !this.state[collection].find((e) => e.id === item.id);
      const method   = isNew ? "POST" : "PUT";
      const res      = await fetch(`api/${endpoint}.php`, {
        method,
        headers: csrfHeaders(),
        body: JSON.stringify(item)
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Erro ao salvar.");

      const saved = result.item;
      const idx   = this.state[collection].findIndex((e) => e.id === saved.id);
      if (idx >= 0) this.state[collection][idx] = saved;
      else           this.state[collection].push(saved);
    },

    async upsertMany(collection, items) {
      if (!items.length) return;
      const endpoint = collection;
      const res = await fetch(`api/${endpoint}.php`, {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ items })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Erro ao salvar.");

      result.items.forEach((saved) => {
        const idx = this.state[collection].findIndex((e) => e.id === saved.id);
        if (idx >= 0) this.state[collection][idx] = saved;
        else           this.state[collection].push(saved);
      });
    },

    async removeUser(id) {
      const res    = await fetch(`api/users.php?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: csrfHeaders() });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Erro ao excluir.");

      this.state.users        = this.state.users.filter((u) => u.id !== id)
                                   .map((u) => u.advisorId === id ? { ...u, advisorId: "" } : u);
      this.state.reservations = this.state.reservations.filter((r) => r.userId !== id);
    },

    async removeLab(id) {
      const res    = await fetch(`api/labs.php?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: csrfHeaders() });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Erro ao excluir.");

      const deskIds = this.state.desks.filter((d) => d.labId === id).map((d) => d.id);
      this.state.labs         = this.state.labs.filter((l) => l.id !== id);
      this.state.desks        = this.state.desks.filter((d) => d.labId !== id);
      this.state.reservations = this.state.reservations.filter((r) => !deskIds.includes(r.deskId));
    },

    async removeDesk(id) {
      const res    = await fetch(`api/desks.php?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: csrfHeaders() });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Erro ao excluir.");

      this.state.desks        = this.state.desks.filter((d) => d.id !== id);
      this.state.reservations = this.state.reservations.filter((r) => r.deskId !== id);
    },

    async removeReservation(id) {
      const res    = await fetch(`api/reservations.php?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: csrfHeaders() });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Erro ao excluir.");

      this.state.reservations = this.state.reservations.filter((r) => r.id !== id);
    },

    async clear() {
      const res    = await fetch("api/state.php", { method: "DELETE", headers: csrfHeaders() });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Erro ao limpar.");
      this.state = Utils.clone(Config.emptyState);
    },

    async seed() {
      const res    = await fetch("api/state.php", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ action: "seed" })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Erro ao popular dados.");
      await this.init();
    },

    async loadSmtp() {
      const res = await fetch("api/smtp.php");
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Erro ao carregar SMTP.");
      return result.settings;
    },

    async saveSmtp(settings) {
      const res = await fetch("api/smtp.php", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify(settings)
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Erro ao salvar SMTP.");
      return result.settings;
    },

    async testSmtp(to) {
      const res = await fetch("api/smtp.php", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ action: "test", to })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Erro ao testar SMTP.");
    }
  };

  // ─── Domain ───────────────────────────────────────────────────────────────
  const Domain = {
    roleLabel(role) {
      return { professor: "Professor", aluno: "Aluno", tecnico: "Técnico", administrador: "Administrador" }[role] || role;
    },
    levelLabel(level) { return level === "pos-graduacao" ? "Pós-graduação" : "Graduação"; },
    getUser(state, id)  { return state.users.find((u) => u.id === id); },
    getLab(state, id)   { return state.labs.find((l) => l.id === id); },
    getDesk(state, id)  { return state.desks.find((d) => d.id === id); },
    professors(state)   { return Utils.sortByName(state.users.filter((u) => u.role === "professor")); },

    desksByLab(state, labId) {
      return state.desks.filter((d) => d.labId === labId).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    },

    visibleDesks(state, labFilter) {
      return state.desks
        .filter((d) => labFilter === "all" || d.labId === labFilter)
        .sort((a, b) => {
          const lA = Domain.getLab(state, a.labId)?.name || "";
          const lB = Domain.getLab(state, b.labId)?.name || "";
          return lA.localeCompare(lB, "pt-BR") || a.name.localeCompare(b.name, "pt-BR");
        });
    },

    visibleLabs(state, labFilter) {
      return Utils.sortByName(state.labs)
        .filter((l) => labFilter === "all" || l.id === labFilter)
        .filter((l) => Domain.visibleDesks(state, l.id).length);
    },

    occupiedDesks(state, labFilter, dayFilter) {
      return Domain.visibleDesks(state, labFilter)
        .filter((d) => Domain.reservationsForDesk(state, d.id, dayFilter).length);
    },

    visibleOccupiedLabs(state, labFilter, dayFilter) {
      return Domain.visibleLabs(state, labFilter)
        .filter((l) => Domain.occupiedDesks(state, l.id, dayFilter).length);
    },

    labOccupancy(state, labId) {
      const desks    = state.desks.filter((d) => d.labId === labId);
      const capacity = desks.length * Config.reservationDays.length * Config.reservationSlots.length;
      const used     = state.reservations.filter((r) => r.labId === labId).length;
      return { capacity, used, percent: capacity ? Math.round((used / capacity) * 100) : 0 };
    },

    visibleReservations(state, labFilter) {
      return state.reservations
        .filter((r) => labFilter === "all" || r.labId === labFilter)
        .sort((a, b) => Config.days.indexOf(a.day) - Config.days.indexOf(b.day) || a.start.localeCompare(b.start));
    },

    publicUsers(state, labFilter, dayFilter = "all") {
      const ids = new Set(
        state.reservations
          .filter((r) => (labFilter === "all" || r.labId === labFilter) && (dayFilter === "all" || r.day === dayFilter))
          .map((r) => r.userId)
      );
      return Utils.sortByName(state.users.filter((u) => ids.has(u.id)));
    },

    reservationsForDesk(state, deskId, dayFilter) {
      return state.reservations
        .filter((r) => r.deskId === deskId && (dayFilter === "all" || r.day === dayFilter))
        .sort((a, b) => Config.days.indexOf(a.day) - Config.days.indexOf(b.day) || a.start.localeCompare(b.start));
    },

    validateUser(state, user) {
      if (!user.name) return "Informe o nome do usuário.";
      if (user.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) return "Informe um e-mail válido.";
      if (user.email) {
        const owner = state.users.find((u) => u.id !== user.id && u.email && u.email.toLowerCase() === user.email.toLowerCase());
        if (owner) return "Já existe um usuário cadastrado com este e-mail.";
      }
      if (user.role === "aluno" && !user.advisorId) return "Cadastre e selecione um professor orientador.";
      if (user.role === "aluno" && !Domain.getUser(state, user.advisorId)) return "O orientador selecionado não existe.";
      return "";
    },

    validateLab(lab) {
      if (!lab.name) return "Informe o nome do laboratório.";
      return "";
    },

    validateDesk(state, desk) {
      if (!desk.labId) return "Selecione um laboratório.";
      if (!desk.name)  return "Informe a identificação da mesa.";
      if (!Domain.getLab(state, desk.labId)) return "O laboratório selecionado não existe.";
      return "";
    },

    validateReservation(state, reservation, schedules) {
      if (!reservation.userId || !reservation.labId || !reservation.deskId)
        return "Selecione usuário, laboratório e mesa.";
      if (!schedules.length) return "Selecione pelo menos um dia.";
      if (!Domain.getUser(state, reservation.userId)) return "O usuário selecionado não existe.";
      if (!Domain.getLab(state, reservation.labId))   return "O laboratório selecionado não existe.";
      const desk = Domain.getDesk(state, reservation.deskId);
      if (!desk) return "A mesa selecionada não existe.";
      if (desk.labId !== reservation.labId) return "A mesa selecionada não pertence ao laboratório escolhido.";
      const inv = schedules.find((s) => !s.start || !s.end);
      if (inv) return `Informe a faixa de horário de ${inv.day}.`;
      const badRange = schedules.find((s) => s.start >= s.end);
      if (badRange) return `O horário final de ${badRange.day} deve ser maior que o inicial.`;
      return "";
    },

    hasReservationConflict(state, candidate) {
      return state.reservations.some((r) => {
        if (r.id === candidate.id) return false;
        if (r.deskId !== candidate.deskId || r.day !== candidate.day) return false;
        return candidate.start < r.end && candidate.end > r.start;
      });
    },

    buildReservationBatch(reservation, schedules) {
      return schedules.map((s, i) => ({
        ...reservation,
        id:    i === 0 ? reservation.id : Utils.uid("reservation"),
        day:   s.day,
        start: s.start,
        end:   s.end
      }));
    }
  };

  // ─── Templates ────────────────────────────────────────────────────────────
  const Templates = {
    empty(msg) { return `<div class="empty-state">${Utils.escapeHtml(msg)}</div>`; },

    labOptions(state, selectedValue = "", includeAll = false) {
      const init = includeAll
        ? Utils.option("all", "Todos os laboratórios", selectedValue)
        : Utils.option("", "Selecione", selectedValue);
      return init + Utils.sortByName(state.labs).map((l) => Utils.option(l.id, l.name, selectedValue)).join("");
    },

    professorOptions(state, selectedValue = "") {
      const profs = Domain.professors(state);
      if (!profs.length) return Utils.option("", "Cadastre um professor", selectedValue);
      return Utils.option("", "Selecione", selectedValue) +
        profs.map((p) => Utils.option(p.id, p.name, selectedValue)).join("");
    },

    userOptions(state, selectedValue = "") {
      const users = Utils.sortByName(state.users);
      if (!users.length) return Utils.option("", "Cadastre usuários", selectedValue);
      return Utils.option("", "Selecione", selectedValue) +
        users.map((u) => Utils.option(u.id, `${u.name} - ${Domain.roleLabel(u.role)}`, selectedValue)).join("");
    },

    deskOptions(state, labId, selectedValue = "", includeAll = false) {
      const desks = (includeAll ? state.desks : Domain.desksByLab(state, labId))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      const init = includeAll ? Utils.option("all", "Todas as mesas", selectedValue) : Utils.option("", "Selecione", selectedValue);
      return init + desks.map((d) => {
        const lab   = Domain.getLab(state, d.labId);
        const label = includeAll && lab ? `${d.name} - ${lab.name}` : d.name;
        return Utils.option(d.id, label, selectedValue);
      }).join("");
    },

    dayOptions(selectedValue = Config.days[0], includeAll = false) {
      const init = includeAll ? Utils.option("all", "Todos os dias", selectedValue) : "";
      return init + Config.days.map((d) => Utils.option(d, d, selectedValue)).join("");
    },

    listRow(title, details, type, id, extraHtml = "", showActions = true) {
      return `<article class="list-row">
        <div>
          <div class="row-title">${Utils.escapeHtml(title)}</div>
          <div class="row-meta">${details.map((d) => `<span>${Utils.escapeHtml(d)}</span>`).join("")}</div>
          ${extraHtml}
        </div>
        <div class="row-actions ${showActions ? "" : "hidden"}">
          <button class="button ghost" type="button" data-edit="${type}" data-id="${id}">Editar</button>
          <button class="button danger" type="button" data-delete="${type}" data-id="${id}">Excluir</button>
        </div>
      </article>`;
    },

    reservationScheduleRow(reservation, details) {
      return `<article class="reservation-schedule-row">
        <div>
          <strong>${Utils.escapeHtml(details[0])}</strong>
          <div class="row-meta">${details.slice(1).map((d) => `<span>${Utils.escapeHtml(d)}</span>`).join("")}</div>
        </div>
        <div class="row-actions">
          <button class="button ghost" type="button" data-edit="reservation" data-id="${Utils.escapeHtml(reservation.id)}">Editar</button>
          <button class="button danger" type="button" data-delete="reservation" data-id="${Utils.escapeHtml(reservation.id)}">Excluir</button>
        </div>
      </article>`;
    },

    deskScheduleRow(desk, details) {
      return `<article class="desk-schedule-row">
        <div>
          <strong>${Utils.escapeHtml(desk.name)}</strong>
          <div class="row-meta">${details.map((d) => `<span>${Utils.escapeHtml(d)}</span>`).join("")}</div>
        </div>
        <div class="row-actions">
          <button class="button ghost" type="button" data-edit="desk" data-id="${Utils.escapeHtml(desk.id)}">Editar</button>
          <button class="button danger" type="button" data-delete="desk" data-id="${Utils.escapeHtml(desk.id)}">Excluir</button>
        </div>
      </article>`;
    },

    occupancyBar(percent) {
      return `<div class="occupancy-bar" aria-label="Ocupação ${percent}%">
        <span data-occupancy-width="${Math.max(0, Math.min(percent, 100))}"></span>
      </div>`;
    },

    publicUsers(users) {
      if (!users.length) return Templates.empty("Nenhum usuário vinculado ao filtro atual.");
      return users.map((u) => `<span class="user-chip">
        <strong>${Utils.escapeHtml(u.name)}</strong> | ${Utils.escapeHtml(Domain.roleLabel(u.role))}
      </span>`).join("");
    },

    deskUserSchedule(state, reservations) {
      const grouped = reservations.reduce((acc, r) => {
        if (!acc[r.userId]) acc[r.userId] = [];
        acc[r.userId].push(r);
        return acc;
      }, {});
      return Object.entries(grouped).map(([userId, items]) => {
        const user  = Domain.getUser(state, userId);
        const byDay = items.reduce((acc, r) => {
          if (!acc[r.day]) { acc[r.day] = { day: r.day, start: r.start, end: r.end }; return acc; }
          if (r.start < acc[r.day].start) acc[r.day].start = r.start;
          if (r.end   > acc[r.day].end)   acc[r.day].end   = r.end;
          return acc;
        }, {});
        const schedule = Object.values(byDay)
          .sort((a, b) => Config.days.indexOf(a.day) - Config.days.indexOf(b.day))
          .map((r) => `<span>${Utils.escapeHtml(r.day)} | ${Utils.escapeHtml(r.start)} às ${Utils.escapeHtml(r.end)}</span>`)
          .join("");
        return `<article class="desk-user-card">
          <strong>${Utils.escapeHtml(user?.name || "Usuário removido")}</strong>
          <div class="desk-user-schedule">${schedule}</div>
        </article>`;
      }).join("");
    },

    deskCard(state, desk, dayFilter) {
      const reservations = Domain.reservationsForDesk(state, desk.id, dayFilter);
      return `<article class="desk-card">
        <header>
          <div><div class="desk-name">${Utils.escapeHtml(desk.name)}</div></div>
          <div class="desk-badges">
            <span class="status-chip ${reservations.length ? "busy" : "free"}">${reservations.length ? "Ocupada" : "Livre"}</span>
          </div>
        </header>
        ${reservations.length ? Templates.deskUserSchedule(state, reservations) : Templates.empty("Sem reserva no período.")}
      </article>`;
    },

    labSection(state, lab, dayFilter, desks) {
      const occupancy = Domain.labOccupancy(state, lab.id);
      const collapsed = collapsedLabs.has(lab.id);
      return `<section class="lab-section lab-card ${collapsed ? "collapsed" : ""}" data-lab-section="${Utils.escapeHtml(lab.id)}">
        <header class="lab-section-header">
          <div>
            <h3>${Utils.escapeHtml(lab.name)}</h3>
            <span>${Utils.escapeHtml(lab.location || "Sem localização")}</span>
          </div>
          <div class="lab-section-status">
            <strong>${occupancy.percent}% ocupado</strong>
            <span>${desks.length} mesa(s) ocupada(s)</span>
            ${Templates.occupancyBar(occupancy.percent)}
            <button class="button ghost lab-toggle" type="button" data-toggle-lab="${Utils.escapeHtml(lab.id)}" aria-expanded="${collapsed ? "false" : "true"}">
              ${collapsed ? "Expandir" : "Contrair"}
            </button>
          </div>
        </header>
        <div class="lab-desk-grid" ${collapsed ? "hidden" : ""}>
          ${desks.map((d) => Templates.deskCard(state, d, dayFilter)).join("")}
        </div>
      </section>`;
    }
  };

  // ─── View ─────────────────────────────────────────────────────────────────
  const View = {
    els: {},

    init() {
      this.els = {
        viewTitle:                  $("#view-title"),
        toast:                      $("#toast"),
        publicLabFilter:            $("#public-lab-filter"),
        dashboardDayFilter:         $("#dashboard-day-filter"),
        reservationListFilter:      $("#reservation-list-filter"),
        deskListFilter:             $("#desk-list-filter"),
        publicBoard:                $("#public-board"),
        publicUsers:                $("#public-users"),
        publicInsight:              $("#public-insight"),
        reservationSelectionSummary: $("#reservation-selection-summary"),
        profileForm:                $("#profile-form"),
        profileSummary:             $("#profile-summary"),
        userForm:                   $("#user-form"),
        labForm:                    $("#lab-form"),
        deskForm:                   $("#desk-form"),
        reservationForm:            $("#reservation-form"),
        smtpForm:                   $("#smtp-form"),
        smtpTestForm:               $("#smtp-test-form"),
        smtpSummary:                $("#smtp-summary")
      };
    },

    render(state) {
      this.renderSelects(state);
      this.renderMetrics(state);
      this.renderInsight(state);
      this.renderUsers(state);
      this.renderLabs(state);
      this.renderDesks(state);
      this.renderReservations(state);
      this.renderDashboard(state);
      this.renderProfile(state);
      this.applyDynamicStyles();
    },

    renderSmtp(settings) {
      if (!this.els.smtpForm || !settings) return;
      $("#smtp-enabled").checked      = !!settings.enabled;
      $("#smtp-host").value           = settings.host || "";
      $("#smtp-port").value           = settings.port || 587;
      $("#smtp-encryption").value     = settings.encryption || "tls";
      $("#smtp-username").value       = settings.username || "";
      $("#smtp-password").value       = "";
      $("#smtp-from-email").value     = settings.fromEmail || "";
      $("#smtp-from-name").value      = settings.fromName || "LabCon";
      $("#smtp-test-email").value     = settings.fromEmail || "";
      this.renderSmtpSummary(settings);
    },

    renderSmtpSummary(settings) {
      if (!this.els.smtpSummary) return;
      const status = settings.enabled ? "Ativo" : "Inativo";
      const password = settings.passwordSet ? "Senha cadastrada" : "Senha nao cadastrada";
      this.els.smtpSummary.innerHTML = `
        <div class="row-meta settings-meta">
          <span>Status: ${Utils.escapeHtml(status)}</span>
          <span>Host: ${Utils.escapeHtml(settings.host || "Nao informado")}</span>
          <span>Porta: ${Utils.escapeHtml(settings.port || "")}</span>
          <span>${Utils.escapeHtml(password)}</span>
        </div>`;
    },

    renderSelects(state) {
      $("#student-course").innerHTML = Config.courses.map((c) => Utils.option(c, c, $("#student-course").value)).join("");
      $("#student-advisor").innerHTML = Templates.professorOptions(state, $("#student-advisor").value);
      $("#profile-course").innerHTML  = Config.courses.map((c) => Utils.option(c, c, $("#profile-course").value)).join("");
      $("#profile-advisor").innerHTML = Templates.professorOptions(state, $("#profile-advisor").value);

      const reservationUser = Controller.currentUser(state);
      if (Controller.canReserveForOthers()) {
        $("#reservation-user").innerHTML = Templates.userOptions(state, $("#reservation-user").value || reservationUser?.id || "");
        $("#reservation-user").disabled  = false;
      } else {
        $("#reservation-user").innerHTML = reservationUser
          ? Utils.option(reservationUser.id, reservationUser.name, reservationUser.id)
          : Utils.option("", "Usuário da sessão não encontrado", "");
        $("#reservation-user").disabled = true;
      }
      $("#reservation-lab").innerHTML = Templates.labOptions(state, $("#reservation-lab").value);
      $("#desk-lab").innerHTML        = Templates.labOptions(state, $("#desk-lab").value);
      this.els.publicLabFilter.innerHTML       = Templates.labOptions(state, this.els.publicLabFilter.value || "all", true);
      this.els.reservationListFilter.innerHTML = Templates.labOptions(state, this.els.reservationListFilter.value || "all", true);
      this.els.deskListFilter.innerHTML        = Templates.labOptions(state, this.els.deskListFilter.value || "all", true);
      this.els.dashboardDayFilter.innerHTML    = Templates.dayOptions(this.els.dashboardDayFilter.value || "all", true);
      this.updateReservationDeskOptions(state);
      this.renderReservationMatrix(state, this.selectedReservationSchedule());
    },

    renderProfile(state) {
      const user = Controller.currentUser(state);
      if (!user) {
        if (this.els.profileSummary) this.els.profileSummary.innerHTML = Templates.empty("Usuário da sessão não encontrado.");
        return;
      }
      $("#profile-name").value               = user.name || "";
      $("#profile-email").value              = user.email || "";
      $("#profile-role").value               = Domain.roleLabel(user.role);
      $("#profile-level").value              = user.level || "graduacao";
      $("#profile-course").value             = user.course || Config.courses[0];
      $("#profile-program").value            = user.program || "PIBIC";
      $("#profile-postgrad-type").value      = user.postgradType || "Mestrado";
      $("#profile-advisor").value            = user.advisorId || "";
      $("#profile-research-project").value   = user.researchProject || "";
      $("#profile-entry-date").value         = user.entryDate || "";
      $("#profile-qualification-deadline").value = user.qualificationDeadline || "";
      $("#profile-advisor-meeting-url").value = user.advisorMeetingUrl || "";
      $("#profile-article-url").value        = user.articleUrl || "";
      $("#profile-qualification-url").value  = user.qualificationUrl || "";
      $("#profile-thesis-url").value         = user.thesisUrl || "";
      $("#profile-photo-data").value         = user.photoDataUrl || "";
      this.renderProfilePhoto(user.photoDataUrl || "");
      this.updateProfileFields(user.role);

      const advisor  = user.advisorId ? Domain.getUser(state, user.advisorId)?.name || user.advisorName : "";
      const details  = [
        `Perfil: ${Domain.roleLabel(user.role)}`,
        user.email               ? `E-mail: ${user.email}` : "",
        user.photoDataUrl        ? "Foto cadastrada" : "",
        user.level               ? `Nível: ${Domain.levelLabel(user.level)}` : "",
        user.course              ? `Curso: ${user.course}` : "",
        user.program             ? `Vínculo: ${user.program}` : "",
        user.postgradType        ? `Tipo: ${user.postgradType}` : "",
        advisor                  ? `Orientador: ${advisor}` : "",
        user.researchProject     ? `Projeto: ${user.researchProject}` : "",
        user.entryDate           ? `Entrada: ${user.entryDate}` : "",
        user.qualificationDeadline ? `Limite qualificação: ${user.qualificationDeadline}` : "",
        user.advisorMeetingUrl   ? `Reunião: ${user.advisorMeetingUrl}` : "",
        user.articleUrl          ? `Artigo / Journal: ${user.articleUrl}` : "",
        user.qualificationUrl    ? `Qualificação: ${user.qualificationUrl}` : "",
        user.thesisUrl           ? `Dissertação / Tese: ${user.thesisUrl}` : ""
      ].filter(Boolean);
      this.els.profileSummary.innerHTML = Templates.listRow(user.name, details, "profile", user.id, "", false);
    },

    renderProfilePhoto(photoDataUrl) {
      const img = $("#profile-photo-preview");
      const ph  = $("#profile-photo-placeholder");
      if (!img || !ph) return;
      if (photoDataUrl) {
        img.src = photoDataUrl;
        img.classList.remove("hidden");
        ph.classList.add("hidden");
      } else {
        img.removeAttribute("src");
        img.classList.add("hidden");
        ph.classList.remove("hidden");
      }
    },

    renderReservationMatrix(state, selectedSchedule) {
      const deskId    = $("#reservation-desk").value;
      const editingId = $("#reservation-id").value;
      const selKeys   = new Set(selectedSchedule.map((e) => this.scheduleKey(e)));
      const header    = Config.reservationDays.map((d) => `<th scope="col">${Utils.escapeHtml(d)}</th>`).join("");
      const rows = Config.reservationSlots.map(([start, end]) => {
        const cells = Config.reservationDays.map((day) => {
          const occupied = deskId && Domain.hasReservationConflict(state, { id: editingId, deskId, day, start, end });
          const checked  = selKeys.has(this.scheduleKey({ day, start, end })) && !occupied;
          const title    = occupied ? "Horário ocupado para esta mesa" : `Reservar ${day}, ${start} às ${end}`;
          return `<td class="${checked ? "selected" : ""} ${occupied ? "occupied" : ""}">
            <label class="slot-check" title="${Utils.escapeHtml(title)}">
              <input type="checkbox" name="reservation-slots"
                data-day="${Utils.escapeHtml(day)}"
                data-start="${Utils.escapeHtml(start)}"
                data-end="${Utils.escapeHtml(end)}"
                ${checked ? "checked" : ""} ${occupied ? "disabled" : ""}
                aria-label="${Utils.escapeHtml(title)}">
              <span></span>
            </label>
          </td>`;
        }).join("");
        return `<tr><th scope="row">${Utils.escapeHtml(start)} - ${Utils.escapeHtml(end)}</th>${cells}</tr>`;
      }).join("");

      $("#reservation-days").innerHTML = `<div class="reservation-matrix-wrap">
        <table class="reservation-matrix">
          <thead><tr><th scope="col">Horário</th>${header}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
      this.updateReservationSelectionSummary();
    },

    selectedReservationSchedule() {
      return Array.from(document.querySelectorAll("input[name='reservation-slots']:checked")).map((i) => ({
        day: i.dataset.day, start: i.dataset.start, end: i.dataset.end
      }));
    },

    scheduleKey(s) { return `${s.day}|${s.start}|${s.end}`; },

    updateReservationSelectionSummary() {
      if (!this.els.reservationSelectionSummary) return;
      const schedule = this.selectedReservationSchedule();
      if (!schedule.length) { this.els.reservationSelectionSummary.textContent = "Nenhum horário selecionado."; return; }
      const byDay    = schedule.reduce((acc, s) => { acc[s.day] = (acc[s.day] || 0) + 1; return acc; }, {});
      const details  = Object.entries(byDay).map(([day, n]) => `${day}: ${n} bloco(s)`).join(" | ");
      this.els.reservationSelectionSummary.textContent = `${schedule.length} bloco(s) selecionado(s). ${details}`;
    },

    updateReservationDeskOptions(state) {
      const labId = $("#reservation-lab").value;
      $("#reservation-desk").innerHTML = Templates.deskOptions(state, labId, $("#reservation-desk").value);
    },

    renderMetrics(state) {
      $("#metric-labs").textContent         = state.labs.length;
      $("#metric-desks").textContent        = state.desks.length;
      $("#metric-users").textContent        = state.users.length;
      $("#metric-reservations").textContent = state.reservations.length;
    },

    renderInsight(state) {
      if (!this.els.publicInsight) return;
      const labFilter = this.els.publicLabFilter.value || "all";
      const dayFilter = this.els.dashboardDayFilter.value || "all";
      const desks     = Domain.visibleDesks(state, labFilter);
      const occupied  = new Set(
        state.reservations
          .filter((r) => (labFilter === "all" || r.labId === labFilter) && (dayFilter === "all" || r.day === dayFilter))
          .map((r) => r.deskId)
      );
      const labName = labFilter === "all" ? "Todos os laboratórios" : Domain.getLab(state, labFilter)?.name || "Laboratório";
      const dayName = dayFilter === "all" ? "Todos os dias" : dayFilter;
      this.els.publicInsight.innerHTML = `
        <div class="info-chip"><span>Laboratório</span><strong>${Utils.escapeHtml(labName)}</strong></div>
        <div class="info-chip"><span>Período</span><strong>${Utils.escapeHtml(dayName)}</strong></div>
        <div class="info-chip"><span>Mesas ocupadas</span><strong>${desks.filter((d) => occupied.has(d.id)).length}</strong></div>
        <div class="info-chip"><span>Mesas livres</span><strong>${desks.filter((d) => !occupied.has(d.id)).length}</strong></div>
      `;
    },

    renderUsers(state) {
      const list = $("#users-list");
      if (!state.users.length) { list.innerHTML = Templates.empty("Nenhum usuário cadastrado."); return; }
      list.innerHTML = Utils.sortByName(state.users).map((u) => {
        const advisor  = u.advisorId ? Domain.getUser(state, u.advisorId)?.name : "";
        const details  = [
          Domain.roleLabel(u.role),
          u.email              ? `E-mail: ${u.email}` : "",
          u.level              ? Domain.levelLabel(u.level) : "",
          u.course, u.program, u.postgradType,
          advisor              ? `Orientador: ${advisor}` : "",
          u.researchProject    ? `Projeto: ${u.researchProject}` : ""
        ].filter(Boolean);
        return Templates.listRow(u.name, details, "user", u.id);
      }).join("");
    },

    renderLabs(state) {
      const list = $("#labs-list");
      if (!state.labs.length) { list.innerHTML = Templates.empty("Nenhum laboratório cadastrado."); return; }
      list.innerHTML = Utils.sortByName(state.labs).map((l) => {
        const desks    = state.desks.filter((d) => d.labId === l.id).length;
        const occupancy = Domain.labOccupancy(state, l.id);
        return Templates.listRow(l.name,
          [l.location || "Sem localização", `${desks} mesa(s)`, `${occupancy.percent}% ocupado`],
          "lab", l.id, Templates.occupancyBar(occupancy.percent));
      }).join("");
    },

    renderDesks(state) {
      const list      = $("#desks-list");
      const labFilter = this.els.deskListFilter.value || "all";
      const desks     = Domain.visibleDesks(state, labFilter);
      if (!desks.length) { list.innerHTML = Templates.empty("Nenhuma mesa cadastrada."); return; }

      const byLab = desks.reduce((acc, d) => {
        const k = d.labId || "removed";
        if (!acc[k]) acc[k] = [];
        acc[k].push(d);
        return acc;
      }, {});

      list.innerHTML = Object.entries(byLab).map(([labId, labDesks]) => {
        const lab      = Domain.getLab(state, labId);
        const desksHtml = labDesks
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
          .map((d) => {
            const n = state.reservations.filter((r) => r.deskId === d.id).length;
            return Templates.deskScheduleRow(d, [`${n} reserva(s)`]);
          }).join("");
        return `<article class="desk-lab-group">
          <header>
            <h3>${Utils.escapeHtml(lab?.name || "Laboratório removido")}</h3>
            <span>${lab?.location ? Utils.escapeHtml(lab.location) : `${labDesks.length} mesa(s)`}</span>
          </header>
          <div class="desk-lab-list">${desksHtml}</div>
        </article>`;
      }).join("");
    },

    renderReservations(state) {
      const list      = $("#reservations-list");
      const labFilter = this.els.reservationListFilter.value || "all";
      const reservs   = Domain.visibleReservations(state, labFilter);
      if (!reservs.length) { list.innerHTML = Templates.empty("Nenhuma reserva cadastrada."); return; }

      const byUser = reservs.reduce((acc, r) => {
        const k = r.userId || "removed";
        if (!acc[k]) acc[k] = [];
        acc[k].push(r);
        return acc;
      }, {});

      list.innerHTML = Object.entries(byUser).map(([userId, userReservs]) => {
        const user  = Domain.getUser(state, userId);
        const byDay = userReservs.reduce((acc, r) => {
          if (!acc[r.day]) acc[r.day] = [];
          acc[r.day].push(r);
          return acc;
        }, {});
        const daysHtml = Object.entries(byDay)
          .sort(([a], [b]) => Config.days.indexOf(a) - Config.days.indexOf(b))
          .map(([day, dayReservs]) => {
            const entriesHtml = dayReservs
              .sort((a, b) => a.start.localeCompare(b.start))
              .map((r) => {
                const lab  = Domain.getLab(state, r.labId);
                const desk = Domain.getDesk(state, r.deskId);
                return Templates.reservationScheduleRow(r, [
                  `${r.start} às ${r.end}`,
                  lab?.name || "Laboratório removido",
                  desk?.name || "Mesa removida"
                ]);
              }).join("");
            return `<section class="reservation-day-group">
              <h4>${Utils.escapeHtml(day)}</h4>
              <div class="reservation-time-list">${entriesHtml}</div>
            </section>`;
          }).join("");
        return `<article class="reservation-user-group">
          <header>
            <h3>${Utils.escapeHtml(user?.name || "Usuário removido")}</h3>
            <span>${userReservs.length} horário(s)</span>
          </header>
          ${daysHtml}
        </article>`;
      }).join("");
    },

    renderDashboard(state) {
      const labFilter  = this.els.publicLabFilter.value || "all";
      const dayFilter  = this.els.dashboardDayFilter.value || "all";
      const desks      = Domain.occupiedDesks(state, labFilter, dayFilter);
      const pubUsers   = Domain.publicUsers(state, labFilter, dayFilter);
      this.els.publicUsers.innerHTML = Templates.publicUsers(pubUsers);
      if (!desks.length) { this.els.publicBoard.innerHTML = Templates.empty("Nenhuma mesa ocupada para o filtro atual."); return; }
      this.els.publicBoard.innerHTML = Domain.visibleOccupiedLabs(state, labFilter, dayFilter)
        .map((l) => Templates.labSection(state, l, dayFilter, Domain.occupiedDesks(state, l.id, dayFilter)))
        .join("");
    },

    showView(view) {
      const titles = { dashboard: "Painel público", reservations: "Reservas", profile: "Meu cadastro", users: "Usuários", labs: "Laboratórios", desks: "Mesas", smtp: "SMTP" };
      Array.from(document.querySelectorAll(".nav-item")).forEach((i) => i.classList.toggle("active", i.dataset.view === view));
      Array.from(document.querySelectorAll(".view")).forEach((s) => s.classList.toggle("active", s.id === `${view}-view`));
      this.els.viewTitle.textContent = titles[view];
    },

    updateStudentFields() {
      const isStudent  = $("#user-role").value === "aluno";
      const isPostgrad = $("#student-level").value === "pos-graduacao";
      Array.from(document.querySelectorAll(".student-only")).forEach((f) => f.classList.toggle("hidden", !isStudent));
      $("#undergrad-fields").classList.toggle("hidden", !isStudent || isPostgrad);
      $("#postgrad-fields").classList.toggle("hidden",  !isStudent || !isPostgrad);
    },

    updateProfileFields(role = Controller.currentUser()?.role) {
      const isStudent  = role === "aluno";
      const isPostgrad = $("#profile-level").value === "pos-graduacao";
      Array.from(document.querySelectorAll(".profile-student-only")).forEach((f) => f.classList.toggle("hidden", !isStudent));
      $("#profile-undergrad-fields").classList.toggle("hidden", !isStudent || isPostgrad);
      $("#profile-postgrad-fields").classList.toggle("hidden",  !isStudent || !isPostgrad);
    },

    resetForm(formId) {
      const form = document.getElementById(formId);
      form.reset();
      form.querySelectorAll("input[type='hidden']").forEach((i) => { i.value = ""; });
      if (formId === "reservation-form") this.renderReservationMatrix(Repository.getState(), []);
      this.updateStudentFields();
      this.updateProfileFields();
      this.updateReservationDeskOptions(Repository.getState());
    },

    toast(message) {
      this.els.toast.textContent = message;
      this.els.toast.classList.add("show");
      window.clearTimeout(this._toastTimer);
      this._toastTimer = window.setTimeout(() => this.els.toast.classList.remove("show"), Config.toastDuration);
    },

    applyDynamicStyles() {
      document.querySelectorAll("[data-occupancy-width]").forEach((el) => {
        el.style.width = `${Math.max(0, Math.min(Number(el.dataset.occupancyWidth), 100))}%`;
      });
    }
  };

  // ─── Controller ───────────────────────────────────────────────────────────
  const Controller = {
    sessionRole: "aluno",
    session: null,
    currentUserId: "",
    smtpSettings: null,

    async init() {
      View.init();

      // Verificar sessão via PHP
      let session;
      try {
        const res = await fetch("api/auth.php");
        session   = await res.json();
      } catch {
        window.location.href = "login.php";
        return;
      }

      if (!session.authenticated) {
        window.location.href = "login.php";
        return;
      }

      this.session      = session;
      this.sessionRole  = session.user.role;
      this.currentUserId = session.user.id;

      this.bindEvents();
      View.updateStudentFields();

      try {
        await Repository.init();
      } catch (e) {
        console.error("Falha ao carregar dados:", e);
        View.toast("Não foi possível carregar dados do servidor.");
      }

      this.applyPermissions();
      View.render(Repository.getState());
      if (this.canAccess("smtp")) await this.loadSmtpSettings();
    },

    currentRole() { return this.sessionRole; },

    allowedViews() { return Config.permissions[this.currentRole()] || Config.permissions.administrador; },

    canAccess(view) { return this.allowedViews().includes(view); },

    canReserveForOthers() { return ["administrador", "professor"].includes(this.currentRole()); },

    currentUser(state = Repository.getState()) {
      return Domain.getUser(state, this.currentUserId);
    },

    applyPermissions() {
      const allowed = this.allowedViews();
      Array.from(document.querySelectorAll(".nav-item")).forEach((i) => i.classList.toggle("hidden", !allowed.includes(i.dataset.view)));
      Array.from(document.querySelectorAll(".nav-group")).forEach((g) => {
        const visible = Array.from(g.querySelectorAll(".nav-item")).filter((i) => !i.classList.contains("hidden"));
        g.classList.toggle("hidden", !visible.length);
      });
      const role = this.currentRole();
      $("#seed-data").classList.toggle("hidden", role === "aluno");
      $("#clear-data").classList.toggle("hidden", role === "aluno");
      if (!this.canAccess("dashboard")) View.showView(allowed[0]);
    },

    bindEvents() {
      Array.from(document.querySelectorAll(".nav-item")).forEach((i) => i.addEventListener("click", () => {
        if (!this.canAccess(i.dataset.view)) { View.toast("Seu perfil não possui acesso a esta área."); return; }
        View.showView(i.dataset.view);
      }));

      View.els.userForm.addEventListener("submit",       (e) => this.saveUser(e));
      View.els.profileForm.addEventListener("submit",    (e) => this.saveProfile(e));
      View.els.labForm.addEventListener("submit",        (e) => this.saveLab(e));
      View.els.deskForm.addEventListener("submit",       (e) => this.saveDesk(e));
      View.els.reservationForm.addEventListener("submit",(e) => this.saveReservation(e));
      if (View.els.smtpForm) View.els.smtpForm.addEventListener("submit", (e) => this.saveSmtp(e));
      if (View.els.smtpTestForm) View.els.smtpTestForm.addEventListener("submit", (e) => this.testSmtp(e));

      $("#user-role").addEventListener("change",    () => View.updateStudentFields());
      $("#student-level").addEventListener("change",() => View.updateStudentFields());
      $("#profile-level").addEventListener("change",() => View.updateProfileFields());
      $("#profile-photo").addEventListener("change",(e) => this.loadProfilePhoto(e));
      $("#profile-photo-remove").addEventListener("click", () => this.removeProfilePhoto());

      $("#reservation-lab").addEventListener("change", () => {
        const state = Repository.getState();
        View.updateReservationDeskOptions(state);
        View.renderReservationMatrix(state, View.selectedReservationSchedule());
      });
      $("#reservation-desk").addEventListener("change", () => {
        View.renderReservationMatrix(Repository.getState(), View.selectedReservationSchedule());
      });
      $("#reservation-days").addEventListener("change", (e) => {
        if (!e.target.matches("input[name='reservation-slots']")) return;
        e.target.closest("td")?.classList.toggle("selected", e.target.checked);
        View.updateReservationSelectionSummary();
      });

      [View.els.publicLabFilter, View.els.dashboardDayFilter, View.els.reservationListFilter, View.els.deskListFilter]
        .forEach((el) => el.addEventListener("change", () => View.render(Repository.getState())));

      Array.from(document.querySelectorAll("[data-reset]")).forEach((b) => {
        b.addEventListener("click", () => View.resetForm(b.dataset.reset));
      });

      $("#seed-data").addEventListener("click", async () => {
        if (!this.canAccess("labs")) { View.toast("Sem permissão."); return; }
        await this.persist(() => Repository.seed(), "Dados de exemplo carregados.");
      });

      $("#clear-data").addEventListener("click", async () => {
        if (!this.canAccess("labs")) { View.toast("Sem permissão."); return; }
        if (!confirm("Limpar todos os dados cadastrados?")) return;
        await this.persist(() => Repository.clear(), "Dados removidos.");
      });

      document.addEventListener("click", (e) => {
        const toggleBtn = e.target.closest("[data-toggle-lab]");
        if (toggleBtn) {
          const id        = toggleBtn.dataset.toggleLab;
          const collapsed = !collapsedLabs.has(id);
          if (collapsed) collapsedLabs.add(id); else collapsedLabs.delete(id);
          const section = toggleBtn.closest("[data-lab-section]");
          const grid    = section.querySelector(".lab-desk-grid");
          const labName = section.querySelector("h3")?.textContent || "Laboratório";
          section.classList.toggle("collapsed", collapsed);
          grid.hidden = collapsed;
          toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
          toggleBtn.setAttribute("aria-label", `${collapsed ? "Expandir" : "Contrair"} ${labName}`);
          toggleBtn.textContent = collapsed ? "Expandir" : "Contrair";
          return;
        }
        const editBtn   = e.target.closest("[data-edit]");
        const deleteBtn = e.target.closest("[data-delete]");
        if (editBtn)   this.editItem(editBtn.dataset.edit,   editBtn.dataset.id);
        if (deleteBtn) this.deleteItem(deleteBtn.dataset.delete, deleteBtn.dataset.id);
      });
    },

    async persist(action, successMessage) {
      try {
        await action();
        View.render(Repository.getState());
        View.toast(successMessage);
      } catch (error) {
        View.render(Repository.getState());
        View.toast(error.message || "Erro ao salvar dados.");
      }
    },

    async loadSmtpSettings() {
      try {
        this.smtpSettings = await Repository.loadSmtp();
        View.renderSmtp(this.smtpSettings);
      } catch (error) {
        View.toast(error.message || "Nao foi possivel carregar SMTP.");
      }
    },

    async saveSmtp(event) {
      event.preventDefault();
      if (!this.canAccess("smtp")) { View.toast("Sem acesso a configuracao SMTP."); return; }
      const password = $("#smtp-password").value;
      const settings = {
        enabled: $("#smtp-enabled").checked,
        host: $("#smtp-host").value.trim(),
        port: Number($("#smtp-port").value || 587),
        encryption: $("#smtp-encryption").value,
        username: $("#smtp-username").value.trim(),
        password,
        keepPassword: !password,
        fromEmail: $("#smtp-from-email").value.trim(),
        fromName: $("#smtp-from-name").value.trim()
      };

      try {
        this.smtpSettings = await Repository.saveSmtp(settings);
        View.renderSmtp(this.smtpSettings);
        View.toast("Configuracao SMTP salva.");
      } catch (error) {
        View.toast(error.message || "Erro ao salvar SMTP.");
      }
    },

    async testSmtp(event) {
      event.preventDefault();
      if (!this.canAccess("smtp")) { View.toast("Sem acesso a configuracao SMTP."); return; }
      const to = $("#smtp-test-email").value.trim();
      try {
        await Repository.testSmtp(to);
        View.toast("E-mail de teste enviado.");
      } catch (error) {
        View.toast(error.message || "Erro ao enviar teste SMTP.");
      }
    },

    async saveUser(event) {
      event.preventDefault();
      if (!this.canAccess("users")) { View.toast("Sem acesso ao cadastro de usuários."); return; }
      const state = Repository.getState();
      const role  = $("#user-role").value;
      const user  = {
        id:    $("#user-id").value || Utils.uid("user"),
        name:  $("#user-name").value.trim(),
        email: $("#user-email").value.trim(),
        role
      };
      const password = $("#user-password").value;
      if (password) user.password = password;

      if (role === "aluno") {
        user.level   = $("#student-level").value;
        user.advisorId = $("#student-advisor").value;
        user.researchProject = $("#student-research-project").value.trim();
        if (user.level === "graduacao") {
          user.course   = $("#student-course").value;
          user.program  = $("#student-program").value;
        } else {
          user.postgradType = $("#postgrad-type").value;
        }
      }

      const error = Domain.validateUser(state, user);
      if (error) { View.toast(error); return; }
      await this.persist(() => Repository.upsert("users", user), "Usuário salvo.");
      View.resetForm("user-form");
    },

    loadProfilePhoto(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        View.toast("Use uma foto em JPG, PNG ou WebP.");
        event.target.value = "";
        return;
      }
      if (file.size > 500 * 1024) {
        View.toast("Use uma foto de até 500 KB.");
        event.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        $("#profile-photo-data").value = dataUrl;
        View.renderProfilePhoto(dataUrl);
      });
      reader.addEventListener("error", () => {
        View.toast("Não foi possível carregar a foto.");
        event.target.value = "";
      });
      reader.readAsDataURL(file);
    },

    removeProfilePhoto() {
      $("#profile-photo-data").value = "";
      $("#profile-photo").value      = "";
      View.renderProfilePhoto("");
    },

    async saveProfile(event) {
      event.preventDefault();
      const state       = Repository.getState();
      const currentUser = this.currentUser(state);
      if (!currentUser) { View.toast("Não foi possível identificar o usuário logado."); return; }

      const user = {
        ...currentUser,
        name:         $("#profile-name").value.trim(),
        email:        currentUser.email || "",
        role:         currentUser.role,
        photoDataUrl: $("#profile-photo-data").value || ""
      };

      if (user.role === "aluno") {
        user.level                 = $("#profile-level").value;
        user.advisorId             = $("#profile-advisor").value;
        user.researchProject       = $("#profile-research-project").value.trim();
        user.entryDate             = $("#profile-entry-date").value;
        user.qualificationDeadline = $("#profile-qualification-deadline").value;
        user.advisorMeetingUrl     = $("#profile-advisor-meeting-url").value.trim();
        user.articleUrl            = $("#profile-article-url").value.trim();
        user.qualificationUrl      = $("#profile-qualification-url").value.trim();
        user.thesisUrl             = $("#profile-thesis-url").value.trim();
        if (user.level === "graduacao") {
          user.course   = $("#profile-course").value;
          user.program  = $("#profile-program").value;
          delete user.postgradType;
        } else {
          user.postgradType = $("#profile-postgrad-type").value;
          delete user.course;
          delete user.program;
        }
        user.advisorName = Domain.getUser(state, user.advisorId)?.name || user.advisorName || "";
      } else {
        ["level","course","program","postgradType","advisorId","advisorName","researchProject",
         "entryDate","qualificationDeadline","advisorMeetingUrl","articleUrl","qualificationUrl","thesisUrl"]
          .forEach((k) => delete user[k]);
      }

      const error = Domain.validateUser(state, user);
      if (error) { View.toast(error); return; }
      await this.persist(() => Repository.upsert("users", user), "Cadastro atualizado.");
    },

    async saveLab(event) {
      event.preventDefault();
      if (!this.canAccess("labs")) { View.toast("Sem acesso ao cadastro de laboratórios."); return; }
      const lab = {
        id:       $("#lab-id").value || Utils.uid("lab"),
        name:     $("#lab-name").value.trim(),
        location: $("#lab-location").value.trim()
      };
      const error = Domain.validateLab(lab);
      if (error) { View.toast(error); return; }
      await this.persist(() => Repository.upsert("labs", lab), "Laboratório salvo.");
      View.resetForm("lab-form");
    },

    async saveDesk(event) {
      event.preventDefault();
      if (!this.canAccess("desks")) { View.toast("Sem acesso ao cadastro de mesas."); return; }
      const state = Repository.getState();
      const desk  = {
        id:    $("#desk-id").value || Utils.uid("desk"),
        labId: $("#desk-lab").value,
        name:  $("#desk-name").value.trim()
      };
      const error = Domain.validateDesk(state, desk);
      if (error) { View.toast(error); return; }
      await this.persist(() => Repository.upsert("desks", desk), "Mesa salva.");
      View.resetForm("desk-form");
    },

    async saveReservation(event) {
      event.preventDefault();
      const state       = Repository.getState();
      const currentUser = this.currentUser(state);
      if (!currentUser) { View.toast("Não foi possível identificar o usuário logado."); return; }

      const reservation = {
        id:     $("#reservation-id").value || Utils.uid("reservation"),
        userId: this.canReserveForOthers() ? $("#reservation-user").value : currentUser.id,
        labId:  $("#reservation-lab").value,
        deskId: $("#reservation-desk").value
      };
      const schedules = View.selectedReservationSchedule();

      const error = Domain.validateReservation(state, reservation, schedules);
      if (error) { View.toast(error); return; }

      const batch = Domain.buildReservationBatch(reservation, schedules);
      if (batch.some((r) => Domain.hasReservationConflict(state, r))) {
        View.toast("Já existe reserva nessa mesa para esse dia e faixa de horário.");
        return;
      }

      await this.persist(
        () => Repository.upsertMany("reservations", batch),
        batch.length > 1 ? "Reservas salvas." : "Reserva salva."
      );
      View.resetForm("reservation-form");
    },

    editItem(type, id) {
      const required = { user: "users", lab: "labs", desk: "desks", reservation: "reservations" }[type];
      if (required && !this.canAccess(required)) { View.toast("Sem acesso a esta ação."); return; }
      ({ user: () => this.editUser(id), lab: () => this.editLab(id), desk: () => this.editDesk(id), reservation: () => this.editReservation(id) })[type]?.();
    },

    editUser(id) {
      const state = Repository.getState();
      const user  = Domain.getUser(state, id);
      if (!user) return;
      View.showView("users");
      $("#user-id").value                = user.id;
      $("#user-name").value              = user.name;
      $("#user-email").value             = user.email || "";
      $("#user-password").value          = "";
      $("#user-role").value              = user.role;
      $("#student-level").value          = user.level || "graduacao";
      $("#student-course").value         = user.course || Config.courses[0];
      $("#student-program").value        = user.program || "PIBIC";
      $("#postgrad-type").value          = user.postgradType || "Mestrado";
      $("#student-advisor").value        = user.advisorId || "";
      $("#student-research-project").value = user.researchProject || "";
      View.updateStudentFields();
    },

    editLab(id) {
      const lab = Domain.getLab(Repository.getState(), id);
      if (!lab) return;
      View.showView("labs");
      $("#lab-id").value       = lab.id;
      $("#lab-name").value     = lab.name;
      $("#lab-location").value = lab.location || "";
    },

    editDesk(id) {
      const desk = Domain.getDesk(Repository.getState(), id);
      if (!desk) return;
      View.showView("desks");
      $("#desk-id").value   = desk.id;
      $("#desk-lab").value  = desk.labId;
      $("#desk-name").value = desk.name;
    },

    editReservation(id) {
      const state       = Repository.getState();
      const reservation = state.reservations.find((r) => r.id === id);
      if (!reservation) return;
      const currentUser = this.currentUser(state);
      if (!this.canReserveForOthers() && (!currentUser || reservation.userId !== currentUser.id)) {
        View.toast("Você só pode editar reservas feitas em seu próprio nome.");
        return;
      }
      View.showView("reservations");
      $("#reservation-id").value   = reservation.id;
      $("#reservation-user").value = this.canReserveForOthers() ? reservation.userId : currentUser.id;
      $("#reservation-lab").value  = reservation.labId;
      View.updateReservationDeskOptions(state);
      $("#reservation-desk").value = reservation.deskId;
      View.renderReservationMatrix(state, [{ day: reservation.day, start: reservation.start, end: reservation.end }]);
    },

    async deleteItem(type, id) {
      const required = { user: "users", lab: "labs", desk: "desks", reservation: "reservations" }[type];
      if (required && !this.canAccess(required)) { View.toast("Sem acesso a esta ação."); return; }
      if (type === "reservation") {
        const state       = Repository.getState();
        const reservation = state.reservations.find((r) => r.id === id);
        const currentUser = this.currentUser(state);
        if (!this.canReserveForOthers() && (!reservation || !currentUser || reservation.userId !== currentUser.id)) {
          View.toast("Você só pode excluir reservas feitas em seu próprio nome.");
          return;
        }
      }
      const names = { user: "usuário", lab: "laboratório", desk: "mesa", reservation: "reserva" };
      if (!confirm(`Excluir ${names[type]}?`)) return;

      if (type === "user")        await this.persist(() => Repository.removeUser(id),        "Registro excluído.");
      if (type === "lab")         await this.persist(() => Repository.removeLab(id),         "Registro excluído.");
      if (type === "desk")        await this.persist(() => Repository.removeDesk(id),        "Registro excluído.");
      if (type === "reservation") await this.persist(() => Repository.removeReservation(id), "Registro excluído.");
    }
  };

  function $(selector) { return document.querySelector(selector); }

  Controller.init();
}());
