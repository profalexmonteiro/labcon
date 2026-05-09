(function () {
  "use strict";

  window.LabConConfig = {
    storeKey: "labcon-state-v1",
    schemaVersion: 1,
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
      aluno: ["dashboard", "reservations", "profile"],
      professor: ["dashboard", "reservations", "profile", "users", "labs", "desks"],
      tecnico: ["dashboard", "reservations", "profile", "users", "labs", "desks"],
      administrador: ["dashboard", "reservations", "profile", "users", "labs", "desks"]
    }
  };
}());
