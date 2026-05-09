(function () {
  "use strict";

  const Config = window.LabConConfig;
  const collapsedLabs = new Set();

  const Utils = {
    clone(value) {
      return JSON.parse(JSON.stringify(value));
    },

    uid(prefix) {
      return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    },

    escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]);
    },

    sortByName(items) {
      return [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    },

    option(value, label, selectedValue) {
      const selected = value === selectedValue ? "selected" : "";
      return `<option value="${Utils.escapeHtml(value)}" ${selected}>${Utils.escapeHtml(label)}</option>`;
    }
  };

  const Repository = {
    state: loadLocal(),
    isRemoteReady: false,
    lastUpdatedAt: null,

    getState() {
      return this.state;
    },

    async init() {
      try {
        const meta = await window.LabConSupabase.loadStateWithMeta(Utils.clone(Config.emptyState));
        this.state = meta.data;
        this.lastUpdatedAt = meta.updatedAt;
        this.cacheLocal();
        this.isRemoteReady = true;
      } catch (error) {
        console.warn("Nao foi possivel carregar dados do Supabase. Usando cache local.", error);
        this.state = loadLocal();
      }
    },

    cacheLocal() {
      localStorage.setItem(Config.storeKey, JSON.stringify({ ...this.state, _v: Config.schemaVersion }));
    },

    async commit(nextState) {
      this.state = nextState;
      this.cacheLocal();

      try {
        const updatedAt = await window.LabConSupabase.saveStateAtomic(this.state, this.lastUpdatedAt);
        this.lastUpdatedAt = updatedAt;
        this.isRemoteReady = true;
      } catch (error) {
        this.isRemoteReady = false;
        console.warn("Nao foi possivel salvar no Supabase. Dados mantidos no cache local.", error);
        throw error;
      }
    },

    async upsert(collection, item) {
      const nextState = Utils.clone(this.state);
      const index = nextState[collection].findIndex((entry) => entry.id === item.id);
      if (index >= 0) nextState[collection][index] = item;
      else nextState[collection].push(item);
      await this.commit(nextState);
    },

    async upsertMany(collection, items) {
      const nextState = Utils.clone(this.state);
      items.forEach((item) => {
        const index = nextState[collection].findIndex((entry) => entry.id === item.id);
        if (index >= 0) nextState[collection][index] = item;
        else nextState[collection].push(item);
      });
      await this.commit(nextState);
    },

    async removeUser(id) {
      const nextState = Utils.clone(this.state);
      nextState.users = nextState.users
        .filter((user) => user.id !== id)
        .map((user) => user.advisorId === id ? { ...user, advisorId: "" } : user);
      nextState.reservations = nextState.reservations.filter((reservation) => reservation.userId !== id);
      await this.commit(nextState);
    },

    async removeLab(id) {
      const nextState = Utils.clone(this.state);
      const deskIds = nextState.desks.filter((desk) => desk.labId === id).map((desk) => desk.id);
      nextState.labs = nextState.labs.filter((lab) => lab.id !== id);
      nextState.desks = nextState.desks.filter((desk) => desk.labId !== id);
      nextState.reservations = nextState.reservations.filter((reservation) => !deskIds.includes(reservation.deskId));
      await this.commit(nextState);
    },

    async removeDesk(id) {
      const nextState = Utils.clone(this.state);
      nextState.desks = nextState.desks.filter((desk) => desk.id !== id);
      nextState.reservations = nextState.reservations.filter((reservation) => reservation.deskId !== id);
      await this.commit(nextState);
    },

    async removeReservation(id) {
      const nextState = Utils.clone(this.state);
      nextState.reservations = nextState.reservations.filter((reservation) => reservation.id !== id);
      await this.commit(nextState);
    },

    async clear() {
      await this.commit(Utils.clone(Config.emptyState));
    },

    async seed() {
      await this.commit(Domain.createSeedState());
    },

    async upsertAuthUser(authUser) {
      if (!authUser) return null;
      const nextState = Utils.clone(this.state);
      const users = Array.isArray(nextState.users) ? nextState.users : [];
      const userIndex = users.findIndex((user) => {
        return user.authUserId === authUser.id || user.email === authUser.email || user.id === `auth-${authUser.id}`;
      });
      const existingUser = userIndex >= 0 ? users[userIndex] : null;
      const metadata = authUser.user_metadata || {};
      const role = window.LabConSupabase.roleFromUser(authUser);
      const syncedUser = {
        ...(existingUser || {}),
        id: existingUser?.id || `auth-${authUser.id}`,
        authUserId: authUser.id,
        email: authUser.email,
        name: metadata.name || existingUser?.name || authUser.email?.split("@")[0] || "Usuario",
        role,
        photoDataUrl: metadata.photoDataUrl || existingUser?.photoDataUrl || "",
        source: "auth"
      };

      if (role === "aluno") {
        syncedUser.level = metadata.level || existingUser?.level || "graduacao";
        syncedUser.advisorId = metadata.advisorId || existingUser?.advisorId || "";
        syncedUser.advisorName = metadata.advisorName || existingUser?.advisorName || "";
        syncedUser.researchProject = metadata.researchProject || existingUser?.researchProject || "";
        syncedUser.entryDate = metadata.entryDate || existingUser?.entryDate || "";
        syncedUser.qualificationDeadline = metadata.qualificationDeadline || existingUser?.qualificationDeadline || "";
        syncedUser.advisorMeetingUrl = metadata.advisorMeetingUrl || existingUser?.advisorMeetingUrl || "";
        syncedUser.articleUrl = metadata.articleUrl || existingUser?.articleUrl || "";
        syncedUser.qualificationUrl = metadata.qualificationUrl || existingUser?.qualificationUrl || "";
        syncedUser.thesisUrl = metadata.thesisUrl || existingUser?.thesisUrl || "";
        if (syncedUser.level === "graduacao") {
          syncedUser.course = metadata.course || existingUser?.course || "";
          syncedUser.program = metadata.program || existingUser?.program || "";
          delete syncedUser.postgradType;
        } else {
          syncedUser.postgradType = metadata.postgradType || existingUser?.postgradType || "";
          delete syncedUser.course;
          delete syncedUser.program;
        }
      } else {
        delete syncedUser.level;
        delete syncedUser.course;
        delete syncedUser.program;
        delete syncedUser.postgradType;
        delete syncedUser.advisorId;
        delete syncedUser.advisorName;
        delete syncedUser.researchProject;
        delete syncedUser.entryDate;
        delete syncedUser.qualificationDeadline;
        delete syncedUser.advisorMeetingUrl;
        delete syncedUser.articleUrl;
        delete syncedUser.qualificationUrl;
        delete syncedUser.thesisUrl;
      }

      if (userIndex >= 0) users[userIndex] = syncedUser;
      else users.push(syncedUser);
      nextState.users = users;

      if (JSON.stringify(this.state.users) !== JSON.stringify(nextState.users)) {
        await this.commit(nextState);
      }

      return syncedUser;
    }
  };

  function loadLocal() {
    const raw = localStorage.getItem(Config.storeKey);
    if (!raw) return Utils.clone(Config.emptyState);

    try {
      const parsed = JSON.parse(raw);
      if ((parsed._v ?? 0) !== Config.schemaVersion) {
        localStorage.removeItem(Config.storeKey);
        return Utils.clone(Config.emptyState);
      }
      const { _v, ...state } = parsed;
      return { ...Utils.clone(Config.emptyState), ...state };
    } catch {
      return Utils.clone(Config.emptyState);
    }
  }

  const Domain = {
    roleLabel(role) {
      return {
        professor: "Professor",
        aluno: "Aluno",
        tecnico: "Tecnico",
        administrador: "Administrador"
      }[role] || role;
    },

    levelLabel(level) {
      return level === "pos-graduacao" ? "Pos-graduacao" : "Graduacao";
    },

    getUser(state, id) {
      return state.users.find((user) => user.id === id);
    },

    getUserByAuth(state, authUser) {
      if (!authUser) return null;
      return state.users.find((user) => {
        return user.authUserId === authUser.id || user.email === authUser.email || user.id === `auth-${authUser.id}`;
      });
    },

    getLab(state, id) {
      return state.labs.find((lab) => lab.id === id);
    },

    getDesk(state, id) {
      return state.desks.find((desk) => desk.id === id);
    },

    professors(state) {
      return Utils.sortByName(state.users.filter((user) => user.role === "professor"));
    },

    desksByLab(state, labId) {
      return state.desks
        .filter((desk) => desk.labId === labId)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    },

    visibleDesks(state, labFilter) {
      return state.desks
        .filter((desk) => labFilter === "all" || desk.labId === labFilter)
        .sort((a, b) => {
          const labA = Domain.getLab(state, a.labId)?.name || "";
          const labB = Domain.getLab(state, b.labId)?.name || "";
          return labA.localeCompare(labB, "pt-BR") || a.name.localeCompare(b.name, "pt-BR");
        });
    },

    visibleLabs(state, labFilter) {
      return Utils.sortByName(state.labs)
        .filter((lab) => labFilter === "all" || lab.id === labFilter)
        .filter((lab) => Domain.visibleDesks(state, lab.id).length);
    },

    occupiedDesks(state, labFilter, dayFilter) {
      return Domain.visibleDesks(state, labFilter)
        .filter((desk) => Domain.reservationsForDesk(state, desk.id, dayFilter).length);
    },

    visibleOccupiedLabs(state, labFilter, dayFilter) {
      return Domain.visibleLabs(state, labFilter)
        .filter((lab) => Domain.occupiedDesks(state, lab.id, dayFilter).length);
    },

    labOccupancy(state, labId) {
      const desks = state.desks.filter((desk) => desk.labId === labId);
      const capacity = desks.length * Config.reservationDays.length * Config.reservationSlots.length;
      const used = state.reservations.filter((reservation) => reservation.labId === labId).length;
      const percent = capacity ? Math.round((used / capacity) * 100) : 0;
      return { capacity, used, percent };
    },

    visibleReservations(state, labFilter) {
      return state.reservations
        .filter((reservation) => labFilter === "all" || reservation.labId === labFilter)
        .sort((a, b) => Config.days.indexOf(a.day) - Config.days.indexOf(b.day) || a.start.localeCompare(b.start));
    },

    publicUsers(state, labFilter, dayFilter = "all") {
      const userIds = new Set(
        state.reservations
          .filter((reservation) => (labFilter === "all" || reservation.labId === labFilter) && (dayFilter === "all" || reservation.day === dayFilter))
          .map((reservation) => reservation.userId)
      );
      return Utils.sortByName(state.users.filter((user) => userIds.has(user.id)));
    },

    reservationsForDesk(state, deskId, dayFilter) {
      return state.reservations
        .filter((reservation) => reservation.deskId === deskId && (dayFilter === "all" || reservation.day === dayFilter))
        .sort((a, b) => Config.days.indexOf(a.day) - Config.days.indexOf(b.day) || a.start.localeCompare(b.start));
    },

    validateUser(state, user) {
      if (!user.name) return "Informe o nome do usuario.";
      if (user.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) return "Informe um e-mail valido.";
      if (user.email) {
        const emailOwner = state.users.find((entry) => {
          return entry.id !== user.id && entry.email && entry.email.toLowerCase() === user.email.toLowerCase();
        });
        if (emailOwner) return "Ja existe um usuario cadastrado com este e-mail.";
      }
      if (user.role === "aluno" && !user.advisorId) return "Cadastre e selecione um professor orientador.";
      if (user.role === "aluno" && !Domain.getUser(state, user.advisorId)) return "O orientador selecionado nao existe.";
      return "";
    },

    validateLab(lab) {
      if (!lab.name) return "Informe o nome do laboratorio.";
      return "";
    },

    validateDesk(state, desk) {
      if (!desk.labId) return "Selecione um laboratorio.";
      if (!desk.name) return "Informe a identificacao da mesa.";
      if (!Domain.getLab(state, desk.labId)) return "O laboratorio selecionado nao existe.";
      return "";
    },

    validateReservation(state, reservation, schedules) {
      if (!reservation.userId || !reservation.labId || !reservation.deskId) {
        return "Selecione usuario, laboratorio e mesa.";
      }
      if (!schedules.length) return "Selecione pelo menos um dia.";
      if (!Domain.getUser(state, reservation.userId)) return "O usuario selecionado nao existe.";
      if (!Domain.getLab(state, reservation.labId)) return "O laboratorio selecionado nao existe.";
      const desk = Domain.getDesk(state, reservation.deskId);
      if (!desk) return "A mesa selecionada nao existe.";
      if (desk.labId !== reservation.labId) return "A mesa selecionada nao pertence ao laboratorio escolhido.";
      const invalidSchedule = schedules.find((schedule) => !schedule.start || !schedule.end);
      if (invalidSchedule) return `Informe a faixa de horario de ${invalidSchedule.day}.`;
      const invalidRange = schedules.find((schedule) => schedule.start >= schedule.end);
      if (invalidRange) return `O horario final de ${invalidRange.day} deve ser maior que o inicial.`;
      return "";
    },

    hasReservationConflict(state, candidate) {
      return state.reservations.some((reservation) => {
        if (reservation.id === candidate.id) return false;
        if (reservation.deskId !== candidate.deskId || reservation.day !== candidate.day) return false;
        return candidate.start < reservation.end && candidate.end > reservation.start;
      });
    },

    buildReservationBatch(reservation, schedules) {
      return schedules.map((schedule, index) => ({
        ...reservation,
        id: index === 0 ? reservation.id : Utils.uid("reservation"),
        day: schedule.day,
        start: schedule.start,
        end: schedule.end
      }));
    },

    createSeedState() {
      const labId = Utils.uid("lab");
      const bayLetters = "ABCDEFGHIJKLMNOP".split("");

      return {
        users: [
          { id: Utils.uid("user"), name: "Eduardo Souto", role: "professor" },
          { id: Utils.uid("user"), name: "Eduardo Feitosa", role: "professor" }
        ],
        labs: [
          { id: labId, name: "ETSS", location: "Laboratorio ETSS" }
        ],
        desks: bayLetters.map((letter) => ({ id: Utils.uid("desk"), labId, name: `Baia ${letter}` })),
        reservations: []
      };
    }
  };

  const View = {
    els: {},

    init() {
      this.els = {
        viewTitle: $("#view-title"),
        toast: $("#toast"),
        publicLabFilter: $("#public-lab-filter"),
        dashboardDayFilter: $("#dashboard-day-filter"),
        reservationListFilter: $("#reservation-list-filter"),
        deskListFilter: $("#desk-list-filter"),
        publicBoard: $("#public-board"),
        publicUsers: $("#public-users"),
        publicInsight: $("#public-insight"),
        reservationSelectionSummary: $("#reservation-selection-summary"),
        profileForm: $("#profile-form"),
        profileSummary: $("#profile-summary"),
        userForm: $("#user-form"),
        labForm: $("#lab-form"),
        deskForm: $("#desk-form"),
        reservationForm: $("#reservation-form")
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

    renderSelects(state) {
      $("#student-course").innerHTML = Config.courses.map((course) => Utils.option(course, course, $("#student-course").value)).join("");
      $("#student-advisor").innerHTML = Templates.professorOptions(state, $("#student-advisor").value);
      $("#profile-course").innerHTML = Config.courses.map((course) => Utils.option(course, course, $("#profile-course").value)).join("");
      $("#profile-advisor").innerHTML = Templates.professorOptions(state, $("#profile-advisor").value);
      const reservationUser = Controller.currentUser(state);
      if (Controller.canReserveForOthers()) {
        $("#reservation-user").innerHTML = Templates.userOptions(state, $("#reservation-user").value || reservationUser?.id || "");
        $("#reservation-user").disabled = false;
      } else {
        $("#reservation-user").innerHTML = reservationUser
          ? Utils.option(reservationUser.id, reservationUser.name, reservationUser.id)
          : Utils.option("", "Usuario da sessao nao encontrado", "");
        $("#reservation-user").disabled = true;
      }
      $("#reservation-lab").innerHTML = Templates.labOptions(state, $("#reservation-lab").value);
      $("#desk-lab").innerHTML = Templates.labOptions(state, $("#desk-lab").value);

      this.els.publicLabFilter.innerHTML = Templates.labOptions(state, this.els.publicLabFilter.value || "all", true);
      this.els.reservationListFilter.innerHTML = Templates.labOptions(state, this.els.reservationListFilter.value || "all", true);
      this.els.deskListFilter.innerHTML = Templates.labOptions(state, this.els.deskListFilter.value || "all", true);
      this.els.dashboardDayFilter.innerHTML = Templates.dayOptions(this.els.dashboardDayFilter.value || "all", true);
      this.updateReservationDeskOptions(state);
      this.renderReservationMatrix(state, this.selectedReservationSchedule());
    },

    renderProfile(state) {
      const user = Controller.currentUser(state);
      if (!user) {
        if (this.els.profileSummary) this.els.profileSummary.innerHTML = Templates.empty("Usuario da sessao nao encontrado.");
        return;
      }

      $("#profile-name").value = user.name || "";
      $("#profile-email").value = user.email || Controller.session?.user?.email || "";
      $("#profile-role").value = Domain.roleLabel(user.role);
      $("#profile-level").value = user.level || "graduacao";
      $("#profile-course").value = user.course || Config.courses[0];
      $("#profile-program").value = user.program || "PIBIC";
      $("#profile-postgrad-type").value = user.postgradType || "Mestrado";
      $("#profile-advisor").value = user.advisorId || "";
      $("#profile-research-project").value = user.researchProject || "";
      $("#profile-entry-date").value = user.entryDate || "";
      $("#profile-qualification-deadline").value = user.qualificationDeadline || "";
      $("#profile-advisor-meeting-url").value = user.advisorMeetingUrl || "";
      $("#profile-article-url").value = user.articleUrl || "";
      $("#profile-qualification-url").value = user.qualificationUrl || "";
      $("#profile-thesis-url").value = user.thesisUrl || "";
      $("#profile-photo-data").value = user.photoDataUrl || "";
      this.renderProfilePhoto(user.photoDataUrl || "");
      this.updateProfileFields(user.role);

      const advisor = user.advisorId ? Domain.getUser(state, user.advisorId)?.name || user.advisorName : "";
      const details = [
        `Perfil: ${Domain.roleLabel(user.role)}`,
        user.email ? `E-mail: ${user.email}` : "",
        user.photoDataUrl ? "Foto cadastrada" : "",
        user.level ? `Nivel: ${Domain.levelLabel(user.level)}` : "",
        user.course ? `Curso: ${user.course}` : "",
        user.program ? `Vinculo: ${user.program}` : "",
        user.postgradType ? `Tipo: ${user.postgradType}` : "",
        advisor ? `Orientador: ${advisor}` : "",
        user.researchProject ? `Projeto: ${user.researchProject}` : "",
        user.entryDate ? `Entrada: ${user.entryDate}` : "",
        user.qualificationDeadline ? `Limite qualificacao: ${user.qualificationDeadline}` : "",
        user.advisorMeetingUrl ? `Reuniao: ${user.advisorMeetingUrl}` : "",
        user.articleUrl ? `Artigo / Journal: ${user.articleUrl}` : "",
        user.qualificationUrl ? `Qualificacao: ${user.qualificationUrl}` : "",
        user.thesisUrl ? `Dissertacao / Tese: ${user.thesisUrl}` : ""
      ].filter(Boolean);
      this.els.profileSummary.innerHTML = Templates.listRow(user.name, details, "profile", user.id, "", false);
    },

    renderProfilePhoto(photoDataUrl) {
      const image = $("#profile-photo-preview");
      const placeholder = $("#profile-photo-placeholder");
      if (!image || !placeholder) return;
      if (photoDataUrl) {
        image.src = photoDataUrl;
        image.classList.remove("hidden");
        placeholder.classList.add("hidden");
        return;
      }
      image.removeAttribute("src");
      image.classList.add("hidden");
      placeholder.classList.remove("hidden");
    },

    renderReservationMatrix(state, selectedSchedule) {
      const deskId = $("#reservation-desk").value;
      const editingId = $("#reservation-id").value;
      const selectedKeys = new Set(selectedSchedule.map((entry) => this.scheduleKey(entry)));
      const header = Config.reservationDays.map((day) => `<th scope="col">${Utils.escapeHtml(day)}</th>`).join("");
      const rows = Config.reservationSlots.map(([start, end]) => {
        const cells = Config.reservationDays.map((day) => {
          const schedule = { day, start, end };
          const key = this.scheduleKey(schedule);
          const occupied = deskId && Domain.hasReservationConflict(state, { id: editingId, deskId, day, start, end });
          const checked = selectedKeys.has(key) && !occupied;
          const disabled = occupied;
          const title = occupied ? "Horario ocupado para esta mesa" : `Reservar ${day}, ${start} as ${end}`;
          return `<td class="${checked ? "selected" : ""} ${disabled ? "occupied" : ""}">
            <label class="slot-check" title="${Utils.escapeHtml(title)}">
              <input
                type="checkbox"
                name="reservation-slots"
                data-day="${Utils.escapeHtml(day)}"
                data-start="${Utils.escapeHtml(start)}"
                data-end="${Utils.escapeHtml(end)}"
                ${checked ? "checked" : ""}
                ${disabled ? "disabled" : ""}
                aria-label="${Utils.escapeHtml(title)}"
              >
              <span></span>
            </label>
          </td>`;
        }).join("");

        return `<tr>
          <th scope="row">${Utils.escapeHtml(start)} - ${Utils.escapeHtml(end)}</th>
          ${cells}
        </tr>`;
      }).join("");

      $("#reservation-days").innerHTML = `<div class="reservation-matrix-wrap">
        <table class="reservation-matrix">
          <thead>
            <tr>
              <th scope="col">Horario</th>
              ${header}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
      this.updateReservationSelectionSummary();
    },

    selectedReservationSchedule() {
      return $$("input[name='reservation-slots']:checked").map((input) => {
        return {
          day: input.dataset.day,
          start: input.dataset.start,
          end: input.dataset.end
        };
      });
    },

    scheduleKey(schedule) {
      return `${schedule.day}|${schedule.start}|${schedule.end}`;
    },

    updateReservationSelectionSummary() {
      if (!this.els.reservationSelectionSummary) return;
      const schedule = this.selectedReservationSchedule();
      if (!schedule.length) {
        this.els.reservationSelectionSummary.textContent = "Nenhum horario selecionado.";
        return;
      }
      const byDay = schedule.reduce((acc, item) => {
        acc[item.day] = (acc[item.day] || 0) + 1;
        return acc;
      }, {});
      const details = Object.entries(byDay).map(([day, total]) => `${day}: ${total} bloco(s)`).join(" | ");
      this.els.reservationSelectionSummary.textContent = `${schedule.length} bloco(s) selecionado(s). ${details}`;
    },

    updateReservationDeskOptions(state) {
      const labId = $("#reservation-lab").value;
      $("#reservation-desk").innerHTML = Templates.deskOptions(state, labId, $("#reservation-desk").value);
    },

    renderMetrics(state) {
      $("#metric-labs").textContent = state.labs.length;
      $("#metric-desks").textContent = state.desks.length;
      $("#metric-users").textContent = state.users.length;
      $("#metric-reservations").textContent = state.reservations.length;
    },

    renderInsight(state) {
      if (!this.els.publicInsight) return;
      const labFilter = this.els.publicLabFilter.value || "all";
      const dayFilter = this.els.dashboardDayFilter.value || "all";
      const desks = Domain.visibleDesks(state, labFilter);
      const occupiedDeskIds = new Set(
        state.reservations
          .filter((reservation) => (labFilter === "all" || reservation.labId === labFilter) && (dayFilter === "all" || reservation.day === dayFilter))
          .map((reservation) => reservation.deskId)
      );
      const labName = labFilter === "all" ? "Todos os laboratorios" : Domain.getLab(state, labFilter)?.name || "Laboratorio";
      const dayName = dayFilter === "all" ? "Todos os dias" : dayFilter;
      const occupied = desks.filter((desk) => occupiedDeskIds.has(desk.id)).length;
      const free = desks.length - occupied;

      this.els.publicInsight.innerHTML = `
        <div class="info-chip"><span>Laboratorio</span><strong>${Utils.escapeHtml(labName)}</strong></div>
        <div class="info-chip"><span>Periodo</span><strong>${Utils.escapeHtml(dayName)}</strong></div>
        <div class="info-chip"><span>Mesas ocupadas</span><strong>${occupied}</strong></div>
        <div class="info-chip"><span>Mesas livres</span><strong>${free}</strong></div>
      `;
    },

    renderUsers(state) {
      const list = $("#users-list");
      if (!state.users.length) {
        list.innerHTML = Templates.empty("Nenhum usuario cadastrado.");
        return;
      }

      list.innerHTML = Utils.sortByName(state.users).map((user) => {
        const advisor = user.advisorId ? Domain.getUser(state, user.advisorId)?.name : "";
        const details = [
          Domain.roleLabel(user.role),
          user.email ? `E-mail: ${user.email}` : "",
          user.level ? Domain.levelLabel(user.level) : "",
          user.course,
          user.program,
          user.postgradType,
          advisor ? `Orientador: ${advisor}` : "",
          user.researchProject ? `Projeto: ${user.researchProject}` : ""
        ].filter(Boolean);
        return Templates.listRow(user.name, details, "user", user.id);
      }).join("");
    },

    renderLabs(state) {
      const list = $("#labs-list");
      if (!state.labs.length) {
        list.innerHTML = Templates.empty("Nenhum laboratorio cadastrado.");
        return;
      }

      list.innerHTML = Utils.sortByName(state.labs).map((lab) => {
        const desks = state.desks.filter((desk) => desk.labId === lab.id).length;
        const occupancy = Domain.labOccupancy(state, lab.id);
        return Templates.listRow(
          lab.name,
          [lab.location || "Sem localizacao", `${desks} mesa(s)`, `${occupancy.percent}% ocupado`],
          "lab",
          lab.id,
          Templates.occupancyBar(occupancy.percent)
        );
      }).join("");
    },

    renderDesks(state) {
      const list = $("#desks-list");
      const labFilter = this.els.deskListFilter.value || "all";
      const desks = Domain.visibleDesks(state, labFilter);

      if (!desks.length) {
        list.innerHTML = Templates.empty("Nenhuma mesa cadastrada.");
        return;
      }

      const byLab = desks.reduce((acc, desk) => {
        const labKey = desk.labId || "removed";
        if (!acc[labKey]) acc[labKey] = [];
        acc[labKey].push(desk);
        return acc;
      }, {});

      list.innerHTML = Object.entries(byLab).map(([labId, labDesks]) => {
        const lab = Domain.getLab(state, labId);
        const desksHtml = labDesks
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
          .map((desk) => {
            const reservations = state.reservations.filter((reservation) => reservation.deskId === desk.id).length;
            return Templates.deskScheduleRow(desk, [`${reservations} reserva(s)`]);
          }).join("");

        return `<article class="desk-lab-group">
          <header>
            <h3>${Utils.escapeHtml(lab?.name || "Laboratorio removido")}</h3>
            <span>${lab?.location ? Utils.escapeHtml(lab.location) : `${labDesks.length} mesa(s)`}</span>
          </header>
          <div class="desk-lab-list">${desksHtml}</div>
        </article>`;
      }).join("");
    },

    renderReservations(state) {
      const list = $("#reservations-list");
      const labFilter = this.els.reservationListFilter.value || "all";
      const reservations = Domain.visibleReservations(state, labFilter);

      if (!reservations.length) {
        list.innerHTML = Templates.empty("Nenhuma reserva cadastrada.");
        return;
      }

      const byUser = reservations.reduce((acc, reservation) => {
        const userKey = reservation.userId || "removed";
        if (!acc[userKey]) acc[userKey] = [];
        acc[userKey].push(reservation);
        return acc;
      }, {});

      list.innerHTML = Object.entries(byUser).map(([userId, userReservations]) => {
        const user = Domain.getUser(state, userId);
        const byDay = userReservations.reduce((acc, reservation) => {
          if (!acc[reservation.day]) acc[reservation.day] = [];
          acc[reservation.day].push(reservation);
          return acc;
        }, {});

        const daysHtml = Object.entries(byDay)
          .sort(([dayA], [dayB]) => Config.days.indexOf(dayA) - Config.days.indexOf(dayB))
          .map(([day, dayReservations]) => {
            const entriesHtml = dayReservations
              .sort((a, b) => a.start.localeCompare(b.start))
              .map((reservation) => {
                const lab = Domain.getLab(state, reservation.labId);
                const desk = Domain.getDesk(state, reservation.deskId);
                return Templates.reservationScheduleRow(reservation, [
                  `${reservation.start} as ${reservation.end}`,
                  lab?.name || "Laboratorio removido",
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
            <h3>${Utils.escapeHtml(user?.name || "Usuario removido")}</h3>
            <span>${userReservations.length} horario(s)</span>
          </header>
          ${daysHtml}
        </article>`;
      }).join("");
    },

    renderDashboard(state) {
      const labFilter = this.els.publicLabFilter.value || "all";
      const dayFilter = this.els.dashboardDayFilter.value || "all";
      const desks = Domain.occupiedDesks(state, labFilter, dayFilter);
      const publicUsers = Domain.publicUsers(state, labFilter, dayFilter);

      this.els.publicUsers.innerHTML = Templates.publicUsers(publicUsers);

      if (!desks.length) {
        this.els.publicBoard.innerHTML = Templates.empty("Nenhuma mesa ocupada para o filtro atual.");
        return;
      }

      this.els.publicBoard.innerHTML = Domain.visibleOccupiedLabs(state, labFilter, dayFilter)
        .map((lab) => Templates.labSection(state, lab, dayFilter, Domain.occupiedDesks(state, lab.id, dayFilter)))
        .join("");
    },

    showView(view) {
      const titles = {
        dashboard: "Painel publico",
        reservations: "Reservas",
        profile: "Meu cadastro",
        users: "Usuarios",
        labs: "Laboratorios",
        desks: "Mesas"
      };

      $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
      $$(".view").forEach((section) => section.classList.toggle("active", section.id === `${view}-view`));
      this.els.viewTitle.textContent = titles[view];
    },

    updateStudentFields() {
      const isStudent = $("#user-role").value === "aluno";
      const isPostgrad = $("#student-level").value === "pos-graduacao";
      $$(".student-only").forEach((field) => field.classList.toggle("hidden", !isStudent));
      $("#undergrad-fields").classList.toggle("hidden", !isStudent || isPostgrad);
      $("#postgrad-fields").classList.toggle("hidden", !isStudent || !isPostgrad);
    },

    updateProfileFields(role = Controller.currentUser()?.role) {
      const isStudent = role === "aluno";
      const isPostgrad = $("#profile-level").value === "pos-graduacao";
      $$(".profile-student-only").forEach((field) => field.classList.toggle("hidden", !isStudent));
      $("#profile-undergrad-fields").classList.toggle("hidden", !isStudent || isPostgrad);
      $("#profile-postgrad-fields").classList.toggle("hidden", !isStudent || !isPostgrad);
    },

    resetForm(formId) {
      const form = document.getElementById(formId);
      form.reset();
      form.querySelectorAll("input[type='hidden']").forEach((input) => {
        input.value = "";
      });
      if (formId === "reservation-form") this.renderReservationMatrix(Repository.getState(), []);
      this.updateStudentFields();
      this.updateProfileFields();
      this.updateReservationDeskOptions(Repository.getState());
    },

    toast(message) {
      this.els.toast.textContent = message;
      this.els.toast.classList.add("show");
      window.clearTimeout(this.toastTimer);
      this.toastTimer = window.setTimeout(() => this.els.toast.classList.remove("show"), Config.toastDuration);
    },

    applyDynamicStyles() {
      $$("[data-occupancy-width]").forEach((element) => {
        const width = Number(element.dataset.occupancyWidth);
        element.style.width = `${Math.max(0, Math.min(width, 100))}%`;
      });
    }
  };

  const Templates = {
    empty(message) {
      return `<div class="empty-state">${Utils.escapeHtml(message)}</div>`;
    },

    labOptions(state, selectedValue = "", includeAll = false) {
      const initial = includeAll
        ? Utils.option("all", "Todos os laboratorios", selectedValue)
        : Utils.option("", "Selecione", selectedValue);
      return initial + Utils.sortByName(state.labs).map((lab) => Utils.option(lab.id, lab.name, selectedValue)).join("");
    },

    professorOptions(state, selectedValue = "") {
      const professors = Domain.professors(state);
      if (!professors.length) return Utils.option("", "Cadastre um professor", selectedValue);
      return Utils.option("", "Selecione", selectedValue) + professors.map((professor) => Utils.option(professor.id, professor.name, selectedValue)).join("");
    },

    userOptions(state, selectedValue = "") {
      const users = Utils.sortByName(state.users);
      if (!users.length) return Utils.option("", "Cadastre usuarios", selectedValue);
      return Utils.option("", "Selecione", selectedValue) + users.map((user) => {
        return Utils.option(user.id, `${user.name} - ${Domain.roleLabel(user.role)}`, selectedValue);
      }).join("");
    },

    deskOptions(state, labId, selectedValue = "", includeAll = false) {
      const desks = (includeAll ? state.desks : Domain.desksByLab(state, labId))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      const initial = includeAll
        ? Utils.option("all", "Todas as mesas", selectedValue)
        : Utils.option("", "Selecione", selectedValue);

      return initial + desks.map((desk) => {
        const lab = Domain.getLab(state, desk.labId);
        const label = includeAll && lab ? `${desk.name} - ${lab.name}` : desk.name;
        return Utils.option(desk.id, label, selectedValue);
      }).join("");
    },

    dayOptions(selectedValue = Config.days[0], includeAll = false) {
      const initial = includeAll ? Utils.option("all", "Todos os dias", selectedValue) : "";
      return initial + Config.days.map((day) => Utils.option(day, day, selectedValue)).join("");
    },

    listRow(title, details, type, id, extraHtml = "", showActions = true) {
      return `<article class="list-row">
        <div>
          <div class="row-title">${Utils.escapeHtml(title)}</div>
          <div class="row-meta">${details.map((detail) => `<span>${Utils.escapeHtml(detail)}</span>`).join("")}</div>
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
          <div class="row-meta">${details.slice(1).map((detail) => `<span>${Utils.escapeHtml(detail)}</span>`).join("")}</div>
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
          <div class="row-meta">${details.map((detail) => `<span>${Utils.escapeHtml(detail)}</span>`).join("")}</div>
        </div>
        <div class="row-actions">
          <button class="button ghost" type="button" data-edit="desk" data-id="${Utils.escapeHtml(desk.id)}">Editar</button>
          <button class="button danger" type="button" data-delete="desk" data-id="${Utils.escapeHtml(desk.id)}">Excluir</button>
        </div>
      </article>`;
    },

    occupancyBar(percent) {
      return `<div class="occupancy-bar" aria-label="Ocupacao ${percent}%">
        <span data-occupancy-width="${Math.max(0, Math.min(percent, 100))}"></span>
      </div>`;
    },

    publicUsers(users) {
      if (!users.length) return Templates.empty("Nenhum usuario vinculado ao filtro atual.");
      return users.map((user) => `<span class="user-chip">
        <strong>${Utils.escapeHtml(user.name)}</strong> | ${Utils.escapeHtml(Domain.roleLabel(user.role))}
      </span>`).join("");
    },

    deskCard(state, desk, dayFilter) {
      const reservations = Domain.reservationsForDesk(state, desk.id, dayFilter);
      const status = reservations.length ? "Ocupada" : "Livre";
      const reservationsHtml = reservations.length
        ? Templates.deskUserSchedule(state, reservations)
        : Templates.empty("Sem reserva no periodo.");

      return `<article class="desk-card">
        <header>
          <div>
            <div class="desk-name">${Utils.escapeHtml(desk.name)}</div>
          </div>
          <div class="desk-badges">
            <span class="status-chip ${reservations.length ? "busy" : "free"}">${Utils.escapeHtml(status)}</span>
          </div>
        </header>
        ${reservationsHtml}
      </article>`;
    },

    deskUserSchedule(state, reservations) {
      const grouped = reservations.reduce((acc, reservation) => {
        if (!acc[reservation.userId]) acc[reservation.userId] = [];
        acc[reservation.userId].push(reservation);
        return acc;
      }, {});

      return Object.entries(grouped).map(([userId, items]) => {
        const user = Domain.getUser(state, userId);
        const byDay = items.reduce((acc, reservation) => {
          if (!acc[reservation.day]) {
            acc[reservation.day] = {
              day: reservation.day,
              start: reservation.start,
              end: reservation.end
            };
            return acc;
          }

          if (reservation.start < acc[reservation.day].start) acc[reservation.day].start = reservation.start;
          if (reservation.end > acc[reservation.day].end) acc[reservation.day].end = reservation.end;
          return acc;
        }, {});
        const schedule = Object.values(byDay)
          .sort((a, b) => Config.days.indexOf(a.day) - Config.days.indexOf(b.day))
          .map((reservation) => `<span>${Utils.escapeHtml(reservation.day)} | ${Utils.escapeHtml(reservation.start)} as ${Utils.escapeHtml(reservation.end)}</span>`)
          .join("");

        return `<article class="desk-user-card">
          <strong>${Utils.escapeHtml(user?.name || "Usuario removido")}</strong>
          <div class="desk-user-schedule">${schedule}</div>
        </article>`;
      }).join("");
    },

    labSection(state, lab, dayFilter, desks = Domain.visibleDesks(state, lab.id)) {
      const occupancy = Domain.labOccupancy(state, lab.id);
      const collapsed = collapsedLabs.has(lab.id);
      return `<section class="lab-section lab-card ${collapsed ? "collapsed" : ""}" data-lab-section="${Utils.escapeHtml(lab.id)}">
        <header class="lab-section-header">
          <div>
            <h3>${Utils.escapeHtml(lab.name)}</h3>
            <span>${Utils.escapeHtml(lab.location || "Sem localizacao")}</span>
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
          ${desks.map((desk) => Templates.deskCard(state, desk, dayFilter)).join("")}
        </div>
      </section>`;
    }
  };

  function applyLabVisibility(section, button, collapsed) {
    const grid = section.querySelector(".lab-desk-grid");
    const labName = section.querySelector("h3")?.textContent || "Laboratorio";
    section.classList.toggle("collapsed", collapsed);
    grid.hidden = collapsed;
    button.setAttribute("aria-expanded", collapsed ? "false" : "true");
    button.setAttribute("aria-label", `${collapsed ? "Expandir" : "Contrair"} ${labName}`);
    button.textContent = collapsed ? "Expandir" : "Contrair";
  }

  const Controller = {
    sessionRole: "aluno",
    session: null,
    currentUserId: "",

    async init() {
      View.init();
      const session = await window.LabConSupabase.requireSession();
      if (!session) return;
      this.session = session;
      this.sessionRole = window.LabConSupabase.roleFromUser(session.user);
      this.bindEvents();
      View.updateStudentFields();
      await Repository.init();
      const currentUser = await Repository.upsertAuthUser(session.user);
      this.currentUserId = currentUser?.id || "";
      this.applyPermissions();
      View.render(Repository.getState());
    },

    currentRole() {
      return this.sessionRole;
    },

    allowedViews() {
      return Config.permissions[this.currentRole()] || Config.permissions.administrador;
    },

    canAccess(view) {
      return this.allowedViews().includes(view);
    },

    canReserveForOthers() {
      return ["administrador", "professor"].includes(this.currentRole());
    },

    currentUser(state = Repository.getState()) {
      return Domain.getUser(state, this.currentUserId) || Domain.getUserByAuth(state, this.session?.user);
    },

    applyPermissions() {
      const role = this.currentRole();
      const allowed = this.allowedViews();
      $$(".nav-item").forEach((item) => {
        item.classList.toggle("hidden", !allowed.includes(item.dataset.view));
      });
      $$(".nav-group").forEach((group) => {
        const visibleItems = Array.from(group.querySelectorAll(".nav-item"))
          .filter((item) => !item.classList.contains("hidden"));
        group.classList.toggle("hidden", !visibleItems.length);
      });
      $("#seed-data").classList.toggle("hidden", role === "aluno");
      $("#clear-data").classList.toggle("hidden", role === "aluno");
      if (!this.canAccess("dashboard")) View.showView(allowed[0]);
    },

    bindEvents() {
      $$(".nav-item").forEach((item) => item.addEventListener("click", () => {
        if (!this.canAccess(item.dataset.view)) {
          View.toast("Seu perfil nao possui acesso a esta area.");
          return;
        }
        View.showView(item.dataset.view);
      }));
      View.els.userForm.addEventListener("submit", (event) => this.saveUser(event));
      View.els.profileForm.addEventListener("submit", (event) => this.saveProfile(event));
      View.els.labForm.addEventListener("submit", (event) => this.saveLab(event));
      View.els.deskForm.addEventListener("submit", (event) => this.saveDesk(event));
      View.els.reservationForm.addEventListener("submit", (event) => this.saveReservation(event));

      $("#user-role").addEventListener("change", () => View.updateStudentFields());
      $("#student-level").addEventListener("change", () => View.updateStudentFields());
      $("#profile-level").addEventListener("change", () => View.updateProfileFields());
      $("#profile-photo").addEventListener("change", (event) => this.loadProfilePhoto(event));
      $("#profile-photo-remove").addEventListener("click", () => this.removeProfilePhoto());
      $("#reservation-lab").addEventListener("change", () => {
        const state = Repository.getState();
        View.updateReservationDeskOptions(state);
        View.renderReservationMatrix(state, View.selectedReservationSchedule());
      });
      $("#reservation-desk").addEventListener("change", () => {
        View.renderReservationMatrix(Repository.getState(), View.selectedReservationSchedule());
      });
      $("#reservation-days").addEventListener("change", (event) => {
        if (!event.target.matches("input[name='reservation-slots']")) return;
        event.target.closest("td")?.classList.toggle("selected", event.target.checked);
        View.updateReservationSelectionSummary();
      });

      [View.els.publicLabFilter, View.els.dashboardDayFilter, View.els.reservationListFilter, View.els.deskListFilter]
        .forEach((element) => element.addEventListener("change", () => View.render(Repository.getState())));

      $$("[data-reset]").forEach((button) => {
        button.addEventListener("click", () => View.resetForm(button.dataset.reset));
      });

      $("#seed-data").addEventListener("click", async () => {
        if (!this.canAccess("labs")) {
          View.toast("Seu perfil nao possui permissao para popular dados.");
          return;
        }
        await this.persist(() => Repository.seed(), "Dados de exemplo carregados.");
      });

      $("#clear-data").addEventListener("click", async () => {
        if (!this.canAccess("labs")) {
          View.toast("Seu perfil nao possui permissao para limpar dados.");
          return;
        }
        if (!confirm("Limpar todos os dados cadastrados?")) return;
        await this.persist(() => Repository.clear(), "Dados removidos.");
      });

      $("#logout-link").addEventListener("click", async (event) => {
        event.preventDefault();
        await window.LabConSupabase?.client?.auth.signOut();
        localStorage.removeItem("labcon-session-role");
        window.location.href = "login.html";
      });

      document.addEventListener("click", (event) => {
        const toggleButton = event.target.closest("[data-toggle-lab]");
        if (toggleButton) {
          const labId = toggleButton.dataset.toggleLab;
          const collapsed = !collapsedLabs.has(labId);
          if (collapsed) collapsedLabs.add(labId);
          else collapsedLabs.delete(labId);
          applyLabVisibility(toggleButton.closest("[data-lab-section]"), toggleButton, collapsed);
          return;
        }

        const editButton = event.target.closest("[data-edit]");
        const deleteButton = event.target.closest("[data-delete]");
        if (editButton) this.editItem(editButton.dataset.edit, editButton.dataset.id);
        if (deleteButton) this.deleteItem(deleteButton.dataset.delete, deleteButton.dataset.id);
      });
    },

    async persist(action, successMessage) {
      try {
        await action();
        View.render(Repository.getState());
        View.toast(successMessage);
      } catch (error) {
        View.render(Repository.getState());
        if (error.code === "CONFLICT") {
          View.toast("Conflito detectado. Recarregue a pagina e tente novamente.");
        } else {
          View.toast("Dados salvos localmente, mas nao sincronizados no Supabase.");
        }
      }
    },

    async saveUser(event) {
      event.preventDefault();
      if (!this.canAccess("users")) {
        View.toast("Seu perfil nao possui acesso ao cadastro de usuarios.");
        return;
      }
      const state = Repository.getState();
      const role = $("#user-role").value;
      const user = {
        id: $("#user-id").value || Utils.uid("user"),
        name: $("#user-name").value.trim(),
        email: $("#user-email").value.trim(),
        role
      };

      if (role === "aluno") {
        user.level = $("#student-level").value;
        user.advisorId = $("#student-advisor").value;
        user.researchProject = $("#student-research-project").value.trim();
        if (user.level === "graduacao") {
          user.course = $("#student-course").value;
          user.program = $("#student-program").value;
        } else {
          user.postgradType = $("#postgrad-type").value;
        }
      }

      const error = Domain.validateUser(state, user);
      if (error) {
        View.toast(error);
        return;
      }

      const password = $("#user-password").value;
      await this.persist(() => Repository.upsert("users", user), password ? "Usuario salvo. A senha nao foi armazenada no painel." : "Usuario salvo.");
      View.resetForm("user-form");
    },

    loadProfilePhoto(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        View.toast("Use uma foto em JPG, PNG ou WebP.");
        event.target.value = "";
        return;
      }

      const maxSize = 500 * 1024;
      if (file.size > maxSize) {
        View.toast("Use uma foto de ate 500 KB.");
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
        View.toast("Nao foi possivel carregar a foto.");
        event.target.value = "";
      });
      reader.readAsDataURL(file);
    },

    removeProfilePhoto() {
      $("#profile-photo-data").value = "";
      $("#profile-photo").value = "";
      View.renderProfilePhoto("");
    },

    async saveProfile(event) {
      event.preventDefault();
      const state = Repository.getState();
      const currentUser = this.currentUser(state);
      if (!currentUser) {
        View.toast("Nao foi possivel identificar o usuario logado.");
        return;
      }

      const user = {
        ...currentUser,
        name: $("#profile-name").value.trim(),
        email: currentUser.email || this.session?.user?.email || "",
        role: currentUser.role,
        photoDataUrl: $("#profile-photo-data").value || ""
      };

      if (user.role === "aluno") {
        user.level = $("#profile-level").value;
        user.advisorId = $("#profile-advisor").value;
        user.researchProject = $("#profile-research-project").value.trim();
        user.entryDate = $("#profile-entry-date").value;
        user.qualificationDeadline = $("#profile-qualification-deadline").value;
        user.advisorMeetingUrl = $("#profile-advisor-meeting-url").value.trim();
        user.articleUrl = $("#profile-article-url").value.trim();
        user.qualificationUrl = $("#profile-qualification-url").value.trim();
        user.thesisUrl = $("#profile-thesis-url").value.trim();
        if (user.level === "graduacao") {
          user.course = $("#profile-course").value;
          user.program = $("#profile-program").value;
          delete user.postgradType;
        } else {
          user.postgradType = $("#profile-postgrad-type").value;
          delete user.course;
          delete user.program;
        }
        user.advisorName = Domain.getUser(state, user.advisorId)?.name || user.advisorName || "";
      } else {
        delete user.level;
        delete user.course;
        delete user.program;
        delete user.postgradType;
        delete user.advisorId;
        delete user.advisorName;
        delete user.researchProject;
        delete user.entryDate;
        delete user.qualificationDeadline;
        delete user.advisorMeetingUrl;
        delete user.articleUrl;
        delete user.qualificationUrl;
        delete user.thesisUrl;
      }

      const error = Domain.validateUser(state, user);
      if (error) {
        View.toast(error);
        return;
      }

      const metadata = {
        ...(this.session?.user?.user_metadata || {}),
        name: user.name,
        role: user.role
      };
      if (user.role === "aluno") {
        metadata.level = user.level;
        metadata.advisorId = user.advisorId;
        metadata.advisorName = user.advisorName;
        metadata.researchProject = user.researchProject || "";
        metadata.entryDate = user.entryDate || "";
        metadata.qualificationDeadline = user.qualificationDeadline || "";
        metadata.advisorMeetingUrl = user.advisorMeetingUrl || "";
        metadata.articleUrl = user.articleUrl || "";
        metadata.qualificationUrl = user.qualificationUrl || "";
        metadata.thesisUrl = user.thesisUrl || "";
        if (user.level === "graduacao") {
          metadata.course = user.course;
          metadata.program = user.program;
          delete metadata.postgradType;
        } else {
          metadata.postgradType = user.postgradType;
          delete metadata.course;
          delete metadata.program;
        }
      }

      await this.persist(async () => {
        const authUser = await window.LabConSupabase.updateUserMetadata(metadata);
        if (authUser) this.session.user = authUser;
        Repository.lastUpdatedAt = null;
        await Repository.upsert("users", user);
      }, "Cadastro atualizado.");
    },

    async saveLab(event) {
      event.preventDefault();
      if (!this.canAccess("labs")) {
        View.toast("Seu perfil nao possui acesso ao cadastro de laboratorios.");
        return;
      }
      const lab = {
        id: $("#lab-id").value || Utils.uid("lab"),
        name: $("#lab-name").value.trim(),
        location: $("#lab-location").value.trim()
      };

      const error = Domain.validateLab(lab);
      if (error) {
        View.toast(error);
        return;
      }

      await this.persist(() => Repository.upsert("labs", lab), "Laboratorio salvo.");
      View.resetForm("lab-form");
    },

    async saveDesk(event) {
      event.preventDefault();
      if (!this.canAccess("desks")) {
        View.toast("Seu perfil nao possui acesso ao cadastro de mesas.");
        return;
      }
      const state = Repository.getState();
      const desk = {
        id: $("#desk-id").value || Utils.uid("desk"),
        labId: $("#desk-lab").value,
        name: $("#desk-name").value.trim()
      };

      const error = Domain.validateDesk(state, desk);
      if (error) {
        View.toast(error);
        return;
      }

      await this.persist(() => Repository.upsert("desks", desk), "Mesa salva.");
      View.resetForm("desk-form");
    },

    async saveReservation(event) {
      event.preventDefault();
      const state = Repository.getState();
      const currentUser = this.currentUser(state);
      if (!currentUser) {
        View.toast("Nao foi possivel identificar o usuario logado para a reserva.");
        return;
      }
      const reservation = {
        id: $("#reservation-id").value || Utils.uid("reservation"),
        userId: this.canReserveForOthers() ? $("#reservation-user").value : currentUser.id,
        labId: $("#reservation-lab").value,
        deskId: $("#reservation-desk").value
      };
      const schedules = View.selectedReservationSchedule();

      const error = Domain.validateReservation(state, reservation, schedules);
      if (error) {
        View.toast(error);
        return;
      }

      const reservations = Domain.buildReservationBatch(reservation, schedules);
      if (reservations.some((entry) => Domain.hasReservationConflict(state, entry))) {
        View.toast("Ja existe reserva nessa mesa para esse dia e faixa de horario.");
        return;
      }

      await this.persist(
        () => Repository.upsertMany("reservations", reservations),
        reservations.length > 1 ? "Reservas salvas." : "Reserva salva."
      );
      View.resetForm("reservation-form");
    },

    editItem(type, id) {
      const requiredView = {
        user: "users",
        lab: "labs",
        desk: "desks",
        reservation: "reservations"
      }[type];
      if (requiredView && !this.canAccess(requiredView)) {
        View.toast("Seu perfil nao possui acesso a esta acao.");
        return;
      }
      const handlers = {
        user: () => this.editUser(id),
        lab: () => this.editLab(id),
        desk: () => this.editDesk(id),
        reservation: () => this.editReservation(id)
      };
      handlers[type]?.();
    },

    editUser(id) {
      const state = Repository.getState();
      const user = Domain.getUser(state, id);
      if (!user) return;

      View.showView("users");
      $("#user-id").value = user.id;
      $("#user-name").value = user.name;
      $("#user-email").value = user.email || "";
      $("#user-password").value = "";
      $("#user-role").value = user.role;
      $("#student-level").value = user.level || "graduacao";
      $("#student-course").value = user.course || Config.courses[0];
      $("#student-program").value = user.program || "PIBIC";
      $("#postgrad-type").value = user.postgradType || "Mestrado";
      $("#student-advisor").value = user.advisorId || "";
      $("#student-research-project").value = user.researchProject || "";
      View.updateStudentFields();
    },

    editLab(id) {
      const lab = Domain.getLab(Repository.getState(), id);
      if (!lab) return;

      View.showView("labs");
      $("#lab-id").value = lab.id;
      $("#lab-name").value = lab.name;
      $("#lab-location").value = lab.location || "";
    },

    editDesk(id) {
      const desk = Domain.getDesk(Repository.getState(), id);
      if (!desk) return;

      View.showView("desks");
      $("#desk-id").value = desk.id;
      $("#desk-lab").value = desk.labId;
      $("#desk-name").value = desk.name;
    },

    editReservation(id) {
      const state = Repository.getState();
      const reservation = state.reservations.find((entry) => entry.id === id);
      if (!reservation) return;
      const currentUser = this.currentUser(state);
      if (!this.canReserveForOthers() && (!currentUser || reservation.userId !== currentUser.id)) {
        View.toast("Voce so pode editar reservas feitas em seu proprio nome.");
        return;
      }

      View.showView("reservations");
      $("#reservation-id").value = reservation.id;
      $("#reservation-user").value = this.canReserveForOthers() ? reservation.userId : currentUser.id;
      $("#reservation-lab").value = reservation.labId;
      View.updateReservationDeskOptions(state);
      $("#reservation-desk").value = reservation.deskId;
      View.renderReservationMatrix(state, [{ day: reservation.day, start: reservation.start, end: reservation.end }]);
    },

    async deleteItem(type, id) {
      const requiredView = {
        user: "users",
        lab: "labs",
        desk: "desks",
        reservation: "reservations"
      }[type];
      if (requiredView && !this.canAccess(requiredView)) {
        View.toast("Seu perfil nao possui acesso a esta acao.");
        return;
      }
      if (type === "reservation") {
        const state = Repository.getState();
        const reservation = state.reservations.find((entry) => entry.id === id);
        const currentUser = this.currentUser(state);
        if (!this.canReserveForOthers() && (!reservation || !currentUser || reservation.userId !== currentUser.id)) {
          View.toast("Voce so pode excluir reservas feitas em seu proprio nome.");
          return;
        }
      }
      const names = {
        user: "usuario",
        lab: "laboratorio",
        desk: "mesa",
        reservation: "reserva"
      };
      if (!confirm(`Excluir ${names[type]}?`)) return;

      if (type === "user") await this.persist(() => Repository.removeUser(id), "Registro excluido.");
      if (type === "lab") await this.persist(() => Repository.removeLab(id), "Registro excluido.");
      if (type === "desk") await this.persist(() => Repository.removeDesk(id), "Registro excluido.");
      if (type === "reservation") await this.persist(() => Repository.removeReservation(id), "Registro excluido.");
    }
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  Controller.init();
}());
