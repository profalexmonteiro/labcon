(function () {
  "use strict";

  const cfg = window.LabConConfig;
  const collapsedLabs = new Set();

  const $ = (selector) => document.querySelector(selector);

  function loadLocalState() {
    const raw = localStorage.getItem(cfg.storeKey);
    if (!raw) return clone(cfg.emptyState);
    try {
      const parsed = JSON.parse(raw);
      const { _v, ...state } = parsed;
      return { ...clone(cfg.emptyState), ...state };
    } catch {
      return clone(cfg.emptyState);
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  async function loadState() {
    const fallbackState = loadLocalState();

    try {
      const state = await window.LabConSupabase.loadState(clone(cfg.emptyState));
      localStorage.setItem(cfg.storeKey, JSON.stringify({ ...state, _v: cfg.schemaVersion }));
      return state;
    } catch (error) {
      console.warn("Não foi possível carregar dados do Supabase. Usando cache local.", error);
      return fallbackState;
    }
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

  function option(value, label, selectedValue) {
    return `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }

  function sortByName(items) {
    return [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  function roleLabel(role) {
    return {
      professor: "Professor",
      aluno: "Aluno",
      tecnico: "Técnico",
      administrador: "Administrador"
    }[role] || role;
  }

  function getLab(state, id) {
    return state.labs.find((lab) => lab.id === id);
  }

  function getDesk(state, id) {
    return state.desks.find((desk) => desk.id === id);
  }

  function getUser(state, id) {
    return state.users.find((user) => user.id === id);
  }

  function labOptions(state, selectedValue = "all") {
    return option("all", "Todos os laboratórios", selectedValue) +
      sortByName(state.labs).map((lab) => option(lab.id, lab.name, selectedValue)).join("");
  }

  function dayOptions(selectedValue = "all") {
    return option("all", "Todos os dias", selectedValue) +
      cfg.days.map((day) => option(day, day, selectedValue)).join("");
  }

  function visibleDesks(state, labFilter) {
    return state.desks
      .filter((desk) => labFilter === "all" || desk.labId === labFilter)
      .sort((a, b) => {
        const labA = getLab(state, a.labId)?.name || "";
        const labB = getLab(state, b.labId)?.name || "";
        return labA.localeCompare(labB, "pt-BR") || a.name.localeCompare(b.name, "pt-BR");
      });
  }

  function visibleLabs(state, labFilter) {
    return sortByName(state.labs)
      .filter((lab) => labFilter === "all" || lab.id === labFilter)
      .filter((lab) => visibleDesks(state, lab.id).length);
  }

  function occupiedDesks(state, labFilter, dayFilter) {
    return visibleDesks(state, labFilter)
      .filter((desk) => reservationsForDesk(state, desk.id, dayFilter).length);
  }

  function visibleOccupiedLabs(state, labFilter, dayFilter) {
    return visibleLabs(state, labFilter)
      .filter((lab) => occupiedDesks(state, lab.id, dayFilter).length);
  }

  function labOccupancy(state, labId) {
    const desks = state.desks.filter((desk) => desk.labId === labId);
    const capacity = desks.length * cfg.reservationDays.length * cfg.reservationSlots.length;
    const used = state.reservations.filter((reservation) => reservation.labId === labId).length;
    const percent = capacity ? Math.round((used / capacity) * 100) : 0;
    return { capacity, used, percent };
  }

  function occupancyBar(percent) {
    return `<div class="occupancy-bar" aria-label="Ocupação ${percent}%">
      <span data-occupancy-width="${Math.max(0, Math.min(percent, 100))}"></span>
    </div>`;
  }

  function reservationsForDesk(state, deskId, dayFilter) {
    return state.reservations
      .filter((reservation) => reservation.deskId === deskId && (dayFilter === "all" || reservation.day === dayFilter))
      .sort((a, b) => cfg.days.indexOf(a.day) - cfg.days.indexOf(b.day) || a.start.localeCompare(b.start));
  }

  function insight(state, labFilter, dayFilter) {
    const desks = visibleDesks(state, labFilter);
    const occupiedDeskIds = new Set(
      state.reservations
        .filter((reservation) => (labFilter === "all" || reservation.labId === labFilter) && (dayFilter === "all" || reservation.day === dayFilter))
        .map((reservation) => reservation.deskId)
    );
    const users = publicUsers(state, labFilter, dayFilter);
    const labName = labFilter === "all" ? "Todos os laboratórios" : getLab(state, labFilter)?.name || "Laboratório";
    const dayName = dayFilter === "all" ? "Todos os dias" : dayFilter;

    return {
      labName,
      dayName,
      occupied: desks.filter((desk) => occupiedDeskIds.has(desk.id)).length,
      free: desks.filter((desk) => !occupiedDeskIds.has(desk.id)).length,
      users: users.length
    };
  }

  function publicUsers(state, labFilter, dayFilter = "all") {
    const userIds = new Set(
      state.reservations
        .filter((reservation) => (labFilter === "all" || reservation.labId === labFilter) && (dayFilter === "all" || reservation.day === dayFilter))
        .map((reservation) => reservation.userId)
    );
    return sortByName(state.users.filter((user) => userIds.has(user.id)));
  }

  function empty(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function renderMetrics(state) {
    $("#metric-labs").textContent = state.labs.length;
    $("#metric-desks").textContent = state.desks.length;
    $("#metric-users").textContent = state.users.length;
    $("#metric-reservations").textContent = state.reservations.length;
  }

  function renderInsight(state, labFilter, dayFilter) {
    const data = insight(state, labFilter, dayFilter);
    $("#public-insight").innerHTML = `
      <div class="info-chip">
        <label for="public-lab-filter">Laboratório</label>
        <select id="public-lab-filter" aria-label="Filtrar laboratório do painel"></select>
      </div>
      <div class="info-chip">
        <label for="dashboard-day-filter">Período</label>
        <select id="dashboard-day-filter" aria-label="Filtrar dia no painel"></select>
      </div>
      <div class="info-chip"><span>Mesas ocupadas</span><strong>${data.occupied}</strong></div>
      <div class="info-chip"><span>Mesas livres</span><strong>${data.free}</strong></div>
    `;
  }

  function renderBoard(state, labFilter, dayFilter) {
    const desks = occupiedDesks(state, labFilter, dayFilter);
    if (!desks.length) {
      $("#public-board").innerHTML = empty("Nenhuma mesa ocupada para o filtro atual.");
      return;
    }

    const userSchedule = (reservations) => {
      const grouped = reservations.reduce((acc, reservation) => {
        const userId = reservation.userId;
        if (!acc[userId]) acc[userId] = [];
        acc[userId].push(reservation);
        return acc;
      }, {});

      return Object.entries(grouped).map(([userId, items]) => {
        const user = getUser(state, userId);
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
          .sort((a, b) => cfg.days.indexOf(a.day) - cfg.days.indexOf(b.day))
          .map((reservation) => `<span>${escapeHtml(reservation.day)} | ${escapeHtml(reservation.start)} às ${escapeHtml(reservation.end)}</span>`)
          .join("");

        return `<article class="desk-user-card">
          <strong>${escapeHtml(user?.name || "Usuário removido")}</strong>
          <div class="desk-user-schedule">${schedule}</div>
        </article>`;
      }).join("");
    };

    const deskCard = (desk) => {
      const reservations = reservationsForDesk(state, desk.id, dayFilter);
      const status = reservations.length ? "Ocupada" : "Livre";
      const reservationHtml = reservations.length
        ? userSchedule(reservations)
        : empty("Sem reserva no período.");

      return `<article class="desk-card">
        <header>
          <div>
            <div class="desk-name">${escapeHtml(desk.name)}</div>
          </div>
          <div class="desk-badges">
            <span class="status-chip ${reservations.length ? "busy" : "free"}">${status}</span>
          </div>
        </header>
        ${reservationHtml}
      </article>`;
    };

    $("#public-board").innerHTML = visibleOccupiedLabs(state, labFilter, dayFilter).map((lab) => {
      const labDesks = occupiedDesks(state, lab.id, dayFilter);
      const occupancy = labOccupancy(state, lab.id);
      const collapsed = collapsedLabs.has(lab.id);
      return `<section class="lab-section lab-card ${collapsed ? "collapsed" : ""}" data-lab-section="${escapeHtml(lab.id)}">
        <header class="lab-section-header">
          <div>
            <h3>${escapeHtml(lab.name)}</h3>
            <span>${escapeHtml(lab.location || "Sem localização")}</span>
          </div>
          <div class="lab-section-status">
            <strong>${occupancy.percent}% ocupado</strong>
            <span>${labDesks.length} mesa(s) ocupada(s)</span>
            ${occupancyBar(occupancy.percent)}
            <button class="button ghost lab-toggle" type="button" data-toggle-lab="${escapeHtml(lab.id)}" aria-expanded="${collapsed ? "false" : "true"}" aria-label="${collapsed ? "Expandir" : "Contrair"} ${escapeHtml(lab.name)}">
              ${collapsed ? "Expandir" : "Contrair"}
            </button>
          </div>
        </header>
        <div class="lab-desk-grid" ${collapsed ? "hidden" : ""}>
          ${labDesks.map(deskCard).join("")}
        </div>
      </section>`;
    }).join("");
  }

  async function render() {
    const state = await loadState();
    const labFilter = $("#public-lab-filter")?.value || "all";
    const dayFilter = $("#dashboard-day-filter")?.value || "all";

    renderInsight(state, labFilter, dayFilter);
    $("#public-lab-filter").innerHTML = labOptions(state, labFilter);
    $("#dashboard-day-filter").innerHTML = dayOptions(dayFilter);
    renderMetrics(state);
    renderBoard(state, labFilter, dayFilter);
    applyDynamicStyles();
  }

  function applyDynamicStyles() {
    Array.from(document.querySelectorAll("[data-occupancy-width]")).forEach((element) => {
      const width = Number(element.dataset.occupancyWidth);
      element.style.width = `${Math.max(0, Math.min(width, 100))}%`;
    });
  }

  function applyLabVisibility(section, button, collapsed) {
    const grid = section.querySelector(".lab-desk-grid");
    const labName = section.querySelector("h3")?.textContent || "Laboratório";
    section.classList.toggle("collapsed", collapsed);
    grid.hidden = collapsed;
    button.setAttribute("aria-expanded", collapsed ? "false" : "true");
    button.setAttribute("aria-label", `${collapsed ? "Expandir" : "Contrair"} ${labName}`);
    button.textContent = collapsed ? "Expandir" : "Contrair";
  }

  document.addEventListener("change", (event) => {
    if (!event.target.matches("#public-lab-filter, #dashboard-day-filter")) return;
    render();
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-toggle-lab]");
    if (!button) return;
    const labId = button.dataset.toggleLab;
    const collapsed = !collapsedLabs.has(labId);
    if (collapsed) collapsedLabs.add(labId);
    else collapsedLabs.delete(labId);
    applyLabVisibility(button.closest("[data-lab-section]"), button, collapsed);
  });
  render();
}());
