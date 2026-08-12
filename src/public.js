(function () {
  "use strict";

  const cfg = window.LabConConfig;
  const collapsedLabs = new Set();
  const $ = (sel) => document.querySelector(sel);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[c]);
  }

  function option(value, label, selected) {
    return `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }

  function sortByName(items) {
    return [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  function getLab(state, id)  { return state.labs.find((l) => l.id === id); }
  function getUser(state, id) { return state.users.find((u) => u.id === id); }

  function labOccupancy(state, labId) {
    const desks    = state.desks.filter((d) => d.labId === labId);
    const capacity = desks.length * cfg.reservationDays.length * cfg.reservationSlots.length;
    const used     = state.reservations.filter((r) => r.labId === labId).length;
    return { capacity, used, percent: capacity ? Math.round((used / capacity) * 100) : 0 };
  }

  function occupancyBar(percent) {
    return `<div class="occupancy-bar" aria-label="Ocupação ${percent}%">
      <span data-occupancy-width="${Math.max(0, Math.min(percent, 100))}"></span>
    </div>`;
  }

  function reservationsForDesk(state, deskId, dayFilter) {
    return state.reservations
      .filter((r) => r.deskId === deskId && (dayFilter === "all" || r.day === dayFilter))
      .sort((a, b) => cfg.days.indexOf(a.day) - cfg.days.indexOf(b.day) || a.start.localeCompare(b.start));
  }

  function visibleDesks(state, labFilter) {
    return state.desks
      .filter((d) => labFilter === "all" || d.labId === labFilter)
      .sort((a, b) => {
        const lA = getLab(state, a.labId)?.name || "";
        const lB = getLab(state, b.labId)?.name || "";
        return lA.localeCompare(lB, "pt-BR") || a.name.localeCompare(b.name, "pt-BR");
      });
  }

  function visibleLabs(state, labFilter) {
    return sortByName(state.labs)
      .filter((l) => labFilter === "all" || l.id === labFilter)
      .filter((l) => visibleDesks(state, l.id).length);
  }

  function occupiedDesks(state, labFilter, dayFilter) {
    return visibleDesks(state, labFilter)
      .filter((d) => reservationsForDesk(state, d.id, dayFilter).length);
  }

  function visibleOccupiedLabs(state, labFilter, dayFilter) {
    return visibleLabs(state, labFilter)
      .filter((l) => occupiedDesks(state, l.id, dayFilter).length);
  }

  function publicUsers(state, labFilter, dayFilter) {
    const ids = new Set(
      state.reservations
        .filter((r) => (labFilter === "all" || r.labId === labFilter) && (dayFilter === "all" || r.day === dayFilter))
        .map((r) => r.userId)
    );
    return sortByName(state.users.filter((u) => ids.has(u.id)));
  }

  function empty(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function renderMetrics(state) {
    $("#metric-labs").textContent         = state.labs.length;
    $("#metric-desks").textContent        = state.desks.length;
    $("#metric-users").textContent        = state.users.length;
    $("#metric-reservations").textContent = state.reservations.length;
  }

  function renderInsight(state, labFilter, dayFilter) {
    const desks    = visibleDesks(state, labFilter);
    const occupied = new Set(
      state.reservations
        .filter((r) => (labFilter === "all" || r.labId === labFilter) && (dayFilter === "all" || r.day === dayFilter))
        .map((r) => r.deskId)
    );
    const labName = labFilter === "all" ? "Todos os laboratórios" : getLab(state, labFilter)?.name || "Laboratório";
    const dayName = dayFilter === "all" ? "Todos os dias" : dayFilter;

    $("#public-insight").innerHTML = `
      <div class="info-chip">
        <label for="public-lab-filter">Laboratório</label>
        <select id="public-lab-filter" aria-label="Filtrar laboratório do painel"></select>
      </div>
      <div class="info-chip">
        <label for="dashboard-day-filter">Período</label>
        <select id="dashboard-day-filter" aria-label="Filtrar dia no painel"></select>
      </div>
      <div class="info-chip"><span>Mesas ocupadas</span><strong>${desks.filter((d) => occupied.has(d.id)).length}</strong></div>
      <div class="info-chip"><span>Mesas livres</span><strong>${desks.filter((d) => !occupied.has(d.id)).length}</strong></div>
    `;
  }

  function deskUserSchedule(state, reservations) {
    const grouped = reservations.reduce((acc, r) => {
      if (!acc[r.userId]) acc[r.userId] = [];
      acc[r.userId].push(r);
      return acc;
    }, {});

    return Object.entries(grouped).map(([userId, items]) => {
      const user  = getUser(state, userId);
      const byDay = items.reduce((acc, r) => {
        if (!acc[r.day]) { acc[r.day] = { day: r.day, start: r.start, end: r.end }; return acc; }
        if (r.start < acc[r.day].start) acc[r.day].start = r.start;
        if (r.end   > acc[r.day].end)   acc[r.day].end   = r.end;
        return acc;
      }, {});
      const schedule = Object.values(byDay)
        .sort((a, b) => cfg.days.indexOf(a.day) - cfg.days.indexOf(b.day))
        .map((r) => `<span>${escapeHtml(r.day)} | ${escapeHtml(r.start)} às ${escapeHtml(r.end)}</span>`)
        .join("");
      return `<article class="desk-user-card">
        <strong>${escapeHtml(user?.name || "Usuário removido")}</strong>
        <div class="desk-user-schedule">${schedule}</div>
      </article>`;
    }).join("");
  }

  function renderBoard(state, labFilter, dayFilter) {
    const desks = occupiedDesks(state, labFilter, dayFilter);
    if (!desks.length) {
      $("#public-board").innerHTML = empty("Nenhuma mesa ocupada para o filtro atual.");
      return;
    }

    const deskCard = (desk) => {
      const reservations = reservationsForDesk(state, desk.id, dayFilter);
      return `<article class="desk-card">
        <header>
          <div><div class="desk-name">${escapeHtml(desk.name)}</div></div>
          <div class="desk-badges">
            <span class="status-chip ${reservations.length ? "busy" : "free"}">${reservations.length ? "Ocupada" : "Livre"}</span>
          </div>
        </header>
        ${reservations.length ? deskUserSchedule(state, reservations) : empty("Sem reserva no período.")}
      </article>`;
    };

    $("#public-board").innerHTML = visibleOccupiedLabs(state, labFilter, dayFilter).map((lab) => {
      const labDesks  = occupiedDesks(state, lab.id, dayFilter);
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
            <button class="button ghost lab-toggle" type="button" data-toggle-lab="${escapeHtml(lab.id)}"
              aria-expanded="${collapsed ? "false" : "true"}" aria-label="${collapsed ? "Expandir" : "Contrair"} ${escapeHtml(lab.name)}">
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

  function applyDynamicStyles() {
    document.querySelectorAll("[data-occupancy-width]").forEach((el) => {
      el.style.width = `${Math.max(0, Math.min(Number(el.dataset.occupancyWidth), 100))}%`;
    });
  }

  function applyLabVisibility(section, button, collapsed) {
    const grid    = section.querySelector(".lab-desk-grid");
    const labName = section.querySelector("h3")?.textContent || "Laboratório";
    section.classList.toggle("collapsed", collapsed);
    grid.hidden = collapsed;
    button.setAttribute("aria-expanded", collapsed ? "false" : "true");
    button.setAttribute("aria-label", `${collapsed ? "Expandir" : "Contrair"} ${labName}`);
    button.textContent = collapsed ? "Expandir" : "Contrair";
  }

  async function render() {
    let state;
    try {
      const res = await fetch("api/state.php");
      state     = await res.json();
    } catch {
      state = { users: [], labs: [], desks: [], reservations: [] };
    }

    const labFilter = $("#public-lab-filter")?.value || "all";
    const dayFilter = $("#dashboard-day-filter")?.value || "all";

    renderInsight(state, labFilter, dayFilter);

    const labSel = $("#public-lab-filter");
    const daySel = $("#dashboard-day-filter");
    if (labSel) {
      labSel.innerHTML = option("all", "Todos os laboratórios", labFilter) +
        sortByName(state.labs).map((l) => option(l.id, l.name, labFilter)).join("");
    }
    if (daySel) {
      daySel.innerHTML = option("all", "Todos os dias", dayFilter) +
        cfg.days.map((d) => option(d, d, dayFilter)).join("");
    }

    renderMetrics(state);
    renderBoard(state, labFilter, dayFilter);
    applyDynamicStyles();
  }

  document.addEventListener("change", (e) => {
    if (e.target.matches("#public-lab-filter, #dashboard-day-filter")) render();
  });
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-toggle-lab]");
    if (!btn) return;
    const id       = btn.dataset.toggleLab;
    const collapsed = !collapsedLabs.has(id);
    if (collapsed) collapsedLabs.add(id); else collapsedLabs.delete(id);
    applyLabVisibility(btn.closest("[data-lab-section]"), btn, collapsed);
  });

  render();
}());
