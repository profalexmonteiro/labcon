(function () {
  "use strict";

  window.LabConConfig = {
    toastDuration: 2600,
    days: ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado", "Domingo"],
    reservationDays: ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"],
    reservationSlots: [
      ["08:00", "09:00"],
      ["09:00", "10:00"],
      ["10:00", "11:00"],
      ["11:00", "12:00"],
      ["12:00", "13:00"],
      ["13:00", "14:00"],
      ["14:00", "15:00"],
      ["15:00", "16:00"],
      ["16:00", "17:00"],
      ["17:00", "18:00"],
      ["18:00", "19:00"],
      ["19:00", "20:00"],
      ["20:00", "21:00"],
      ["21:00", "22:00"]
    ],
    courses: [
      "Engenharia da Computação",
      "Ciência da Computação",
      "Engenharia de Software",
      "Inteligencia Artificial",
      "Ciberseguranca"
    ],
    emptyState: {
      users: [],
      labs: [],
      desks: [],
      reservations: []
    },
    permissions: {
      aluno:         ["dashboard", "reservations", "profile"],
      professor:     ["dashboard", "reservations", "profile", "users", "labs", "desks"],
      tecnico:       ["dashboard", "reservations", "profile", "users", "labs", "desks"],
      administrador: ["dashboard", "reservations", "profile", "users", "labs", "desks", "smtp"]
    }
  };

  // O token CSRF é publicado via <meta> (em vez de <script> inline) para
  // que a Content-Security-Policy possa recusar script-src 'unsafe-inline'.
  var csrfMeta = document.querySelector('meta[name="csrf-token"]');
  window.LabConCsrfToken = csrfMeta ? csrfMeta.getAttribute("content") : "";
}());
