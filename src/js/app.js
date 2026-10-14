import { TripStore } from "./store.js";
import { TravelApi } from "./api.js";
import { escapeHtml as esc, money, sumMoney, today, addDays, formatDate } from "./utils.js";
const $ = (selector) => document.querySelector(selector);

export class App {
  constructor(store, api) {
    this.store = store;
    this.api = api;
    this.day = 0;
    this.tab = "plan";
    for (const [name, count] of [
      ["hour", 24],
      ["minute", 60],
    ]) {
      $(`[name=${name}]`).innerHTML = Array.from({ length: count }, (_, i) => {
        const value = String(i).padStart(2, "0");
        return `<option>${value}</option>`;
      }).join("");
    }
    this.bindEvents();
    this.render(true);
  }
  bindEvents() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (button) this.action(button.dataset.action, button.dataset.id);
    });
    document.addEventListener("change", (event) => {
      const input = event.target;
      if (input.dataset.done) {
        const day = this.store.trip.days[this.day];
        const item = day.activities.find((item) => item.id === input.dataset.done);
        item.done = input.checked;
      }
      if (input.dataset.packed) {
        this.store.trip.packing.find((item) => item.id === input.dataset.packed).done = input.checked;
      }
      if (input.dataset.done || input.dataset.packed) {
        this.store.save();
        this.render();
      }
      if (input.setCustomValidity) input.setCustomValidity("");
    });
    document.addEventListener("input", (event) => {
      const input = event.target;
      if (input.setCustomValidity) input.setCustomValidity("");
      if (input.id === "trip-notes") {
        this.store.trip.notes = input.value;
        this.store.save();
        this.showWarning();
      }
      if (input.id === "city-search") {
        this.selectedCity = null;
        $("#city-results").innerHTML = "";
        $("#city-selection").textContent = "Выберите город из результатов поиска для прогноза.";
      }
    });
    document.addEventListener(
      "invalid",
      (event) => {
        const input = event.target;
        input.setCustomValidity("");
        const validity = input.validity;
        let message = "Проверьте значение поля.";
        if (validity.badInput) message = "Введите корректное значение.";
        else if (validity.valueMissing) message = "Заполните это поле.";
        else if (validity.rangeUnderflow) message = `Значение должно быть не меньше ${input.min}.`;
        else if (validity.rangeOverflow) message = `Значение должно быть не больше ${input.max}.`;
        else if (validity.stepMismatch)
          message = input.step === "1" ? "Введите целое число." : "Укажите сумму с точностью до копеек.";
        input.setCustomValidity(message);
      },
      true,
    );
    document.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.target;
      try {
        this.submit(form);
      } catch (error) {
        const message = form.querySelector(".form__error") || $("#storage-warning");
        message.textContent = error.message;
        message.hidden = false;
      }
    });
    $(".tabs").addEventListener("keydown", (event) => {
      const tabs = ["plan", "budget", "packing"];
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      let index = tabs.indexOf(this.tab);
      if (event.key === "Home") index = 0;
      else if (event.key === "End") index = tabs.length - 1;
      else if (event.key === "ArrowRight") index = (index + 1) % tabs.length;
      else index = (index + tabs.length - 1) % tabs.length;
      this.tab = tabs[index];
      this.render();
      $(`[data-id=${this.tab}]`).focus();
    });
  }
  action(action, id) {
    let weather = false;
    switch (action) {
      case "trip":
        this.store.select(id);
        this.day = 0;
        weather = true;
        break;
      case "day":
        this.day = Number(id);
        weather = true;
        break;
      case "tab":
        this.tab = id;
        break;
      case "new-trip":
      case "edit-trip":
        return this.tripDialog(action === "edit-trip");
      case "add-activity":
      case "edit-activity":
        return this.activityDialog(id);
      case "add-expense":
      case "edit-expense":
        return this.expenseDialog(id);
      case "delete-trip":
        if (!window.confirm("Удалить поездку вместе с её планом?")) return;
        this.store.remove(this.store.trip.id);
        this.day = 0;
        weather = true;
        break;
      case "delete-activity":
        if (!window.confirm("Удалить место из плана?")) return;
        this.store.deleteActivity(id);
        break;
      case "delete-expense":
        if (!window.confirm("Удалить расход?")) return;
        this.store.deleteExpense(id);
        break;
      case "delete-packed":
        this.store.deletePacking(id);
        break;
      case "search-city":
        return this.searchCities();
      case "city":
        this.selectedCity = this.cities[Number(id)];
        $("#city-search").value = this.selectedCity.city;
        $("#city-search").setCustomValidity("");
        $("#city-results").innerHTML = "";
        $("#city-selection").textContent = "Город выбран. Прогноз погоды доступен.";
        return;
      case "weather":
        return this.renderWeather();
      case "close":
        return $("#" + id).close();
      case "help":
        return $("#help-dialog").showModal();
      default:
        return;
    }
    this.render(weather);
  }
  showWarning() {
    $("#storage-warning").textContent = this.store.warning;
    $("#storage-warning").hidden = !this.store.warning;
  }
  render(weather = false) {
    const trip = this.store.trip;
    this.showWarning();
    $("#trip-count").textContent = this.store.trips.length;
    $("#trip-list").innerHTML = this.store.trips
      .map(
        (item) =>
          `<button class="trip-list__item ${item === trip ? "trip-list__item--active" : ""}" data-action="trip" data-id="${esc(item.id)}"><strong>${esc(item.city)}</strong><small>${esc(item.title)}</small></button>`,
      )
      .join("");
    $("#workspace").hidden = !trip;
    $("#empty-workspace").hidden = !!trip;
    $("#breadcrumb-city").textContent = trip?.city || "Нет поездок";
    if (!trip) return;
    this.day = Math.min(this.day, trip.days.length - 1);
    $("#trip-title").textContent = trip.title;
    $("#trip-destination").textContent = trip.city;
    $("#trip-meta").textContent =
      `${formatDate(trip.start)} — ${formatDate(trip.end)} · Дней: ${trip.days.length} · Участников: ${trip.travelers}`;
    for (const tab of ["plan", "budget", "packing"]) {
      const button = $(`[data-action=tab][data-id=${tab}]`);
      button.setAttribute("aria-selected", String(this.tab === tab));
      button.tabIndex = this.tab === tab ? 0 : -1;
      $(`#view-${tab}`).hidden = this.tab !== tab;
    }
    this.renderPlan();
    this.renderBudget();
    this.renderPacking();
    if (weather) this.renderWeather();
  }
  renderPlan() {
    const trip = this.store.trip,
      day = trip.days[this.day];
    $("#day-tabs").innerHTML = trip.days
      .map(
        (item, i) =>
          `<button class="days__button ${i === this.day ? "days__button--active" : ""}" data-action="day" data-id="${i}" aria-pressed="${i === this.day}">День ${i + 1}<small>${formatDate(item.date)}</small></button>`,
      )
      .join("");
    $("#day-title").textContent = formatDate(day.date);
    $("#day-summary").textContent = `Мест в плане: ${day.activities.length}`;
    $("#activities").innerHTML =
      day.activities
        .map(
          (item) => `<article class="activity ${item.done ? "activity--done" : ""}">
      <div class="activity__heading"><h3>${esc(item.title)}</h3><time>${esc(item.time)}</time></div>
      <p class="muted">${money(item.cost)}</p>
      <div class="activity__actions"><label><input type="checkbox" data-done="${esc(item.id)}" ${item.done ? "checked" : ""}> Посещено</label>
      <button class="text-button" data-action="edit-activity" data-id="${esc(item.id)}">Изменить</button>
      <a href="https://www.openstreetmap.org/search?query=${encodeURIComponent(trip.city + ", " + item.title)}" target="_blank" rel="noopener noreferrer">Найти на карте</a>
      <button class="text-button text-button--danger" data-action="delete-activity" data-id="${esc(item.id)}">Удалить</button></div></article>`,
        )
        .join("") || '<p class="empty">Добавьте первое место в план этого дня.</p>';
    $("#day-total").textContent = `Расходы на день: ${money(sumMoney(day.activities.map((item) => item.cost)))}`;
    $("#trip-notes").value = trip.notes;
  }
  renderBudget() {
    const totals = this.store.totals();
    $("#budget-total").textContent = money(totals.total);
    $("#budget-limit").textContent = money(this.store.trip.budget);
    $("#budget-left").textContent =
      `${totals.remaining < 0 ? "Превышение" : "Осталось"}: ${money(Math.abs(totals.remaining))}`;
    $("#budget-left").classList.toggle("budget__over", totals.remaining < 0);
    $("#budget-summary").textContent = `Всего: ${money(totals.total)} · На участника: ${money(totals.perPerson)}`;
    $("#expense-list").innerHTML =
      this.store.trip.expenses
        .map(
          (item) =>
            `<div class="expense"><div><strong>${esc(item.title)}</strong></div><strong>${money(item.cost)}</strong><button class="text-button" data-action="edit-expense" data-id="${esc(item.id)}">Изменить</button><button class="text-button text-button--danger" data-action="delete-expense" data-id="${esc(item.id)}">Удалить</button></div>`,
        )
        .join("") || '<p class="muted">Дополнительных расходов пока нет.</p>';
  }
  renderPacking() {
    const items = this.store.trip.packing;
    $("#packing-count").textContent = `Собрано ${items.filter((item) => item.done).length} из ${items.length}`;
    $("#packing-list").innerHTML =
      items
        .map(
          (item) =>
            `<div class="packing__item"><label><input type="checkbox" data-packed="${esc(item.id)}" ${item.done ? "checked" : ""}> ${esc(item.title)}</label><button class="text-button text-button--danger" data-action="delete-packed" data-id="${esc(item.id)}" aria-label="Удалить вещь ${esc(item.title)}">Удалить</button></div>`,
        )
        .join("") || '<p class="muted">Добавьте документы, одежду и другие вещи.</p>';
  }
  openForm(id, values, title, editId = "") {
    const form = $("#" + id),
      dialog = form.closest("dialog");
    form.reset();
    form.dataset.editId = editId || "";
    form.querySelector(".form__error").hidden = true;
    for (const input of form.elements) if (input.setCustomValidity) input.setCustomValidity("");
    for (const [name, value] of Object.entries(values))
      if (form.elements[name]) form.elements[name].value = value ?? "";
    dialog.querySelector("h2").textContent = title;
    dialog.showModal();
  }
  tripDialog(edit = false) {
    const trip = edit ? this.store.trip : null;
    this.selectedCity = trip?.coords ? { city: trip.city, country: trip.country, coords: trip.coords } : null;
    this.openForm(
      "trip-form",
      trip || { start: addDays(today(), 4), end: addDays(today(), 6), travelers: 2, budget: 30000 },
      edit ? "Изменить поездку" : "Новая поездка",
      trip?.id,
    );
    $("#trip-start").disabled = edit;
    $("#trip-end").disabled = edit;
    $("#trip-submit").textContent = edit ? "Сохранить изменения" : "Создать поездку";
    $("#city-results").innerHTML = "";
    $("#city-selection").textContent = this.selectedCity
      ? "Город выбран. Прогноз погоды доступен."
      : "Найдите и выберите город для прогноза погоды.";
  }
  activityDialog(id = null) {
    const item = this.store.trip.days[this.day].activities.find((item) => item.id === id);
    const [hour, minute] = (item?.time || "10:00").split(":");
    this.openForm(
      "activity-form",
      {
        title: item?.title || "",
        hour,
        minute,
        cost: item?.cost ?? 0,
      },
      item ? "Изменить место" : "Добавить место",
      id,
    );
  }
  expenseDialog(id = null) {
    const item = this.store.trip.expenses.find((item) => item.id === id);
    this.openForm("expense-form", item || { cost: "" }, item ? "Изменить расход" : "Добавить расход", id);
  }
  submit(form) {
    const values = Object.fromEntries(new FormData(form));
    const id = form.dataset.editId || null;
    if (form.id === "trip-form") {
      const selected = this.selectedCity?.city === values.city.trim() ? this.selectedCity : null;
      const details = {
        title: values.title.trim(),
        city: values.city.trim(),
        country: selected?.country || "",
        coords: selected?.coords || null,
        start: values.start,
        end: values.end,
        travelers: Number(values.travelers),
        budget: Number(values.budget),
      };
      if (id) this.store.editDetails(details);
      else {
        this.store.add(details);
        this.day = 0;
        this.tab = "plan";
      }
    } else if (form.id === "activity-form") {
      this.store.saveActivity(
        this.day,
        {
          title: values.title.trim(),
          time: `${values.hour}:${values.minute}`,
          cost: Number(values.cost),
        },
        id,
      );
      this.tab = "plan";
    } else if (form.id === "expense-form") {
      this.store.saveExpense({ title: values.title.trim(), cost: Number(values.cost) }, id);
    } else if (form.id === "packing-form") {
      this.store.addPacking(values.title);
      form.reset();
    }
    form.closest("dialog")?.close();
    this.render(form.id === "trip-form" || form.id === "activity-form");
  }
  async searchCities() {
    const input = $("#city-search"),
      button = $("#search-city"),
      query = input.value.trim();
    button.disabled = true;
    $("#city-results").textContent = "Ищем город…";
    try {
      this.cities = await this.api.searchCities(query);
      if (input.value.trim() !== query || !$("#trip-dialog").open) return;
      $("#city-results").innerHTML =
        this.cities
          .map(
            (city, i) =>
              `<button type="button" data-action="city" data-id="${i}">${esc(city.city)}<small>${esc(city.region)}, ${esc(city.country)}</small></button>`,
          )
          .join("") || "Город не найден.";
    } catch (error) {
      if (input.value.trim() === query) $("#city-results").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }
  async renderWeather() {
    const trip = this.store.trip;
    if (!trip) return;
    const day = this.day,
      coords = trip.coords,
      date = trip.days[day].date;
    const distance = (Date.parse(date) - Date.parse(today())) / 86400000;
    if (!coords) {
      $("#weather").textContent = "Выберите город из поиска в настройках поездки.";
      return;
    }
    if (distance < 0 || distance > 15) {
      $("#weather").textContent = "Прогноз доступен на ближайшие 16 дней.";
      return;
    }
    $("#weather").textContent = "Загружаем прогноз…";
    try {
      const data = await this.api.forecast(coords);
      if (this.store.trip !== trip || this.day !== day || trip.coords !== coords) return;
      const index = data.time.indexOf(date);
      if (index < 0) throw new Error("На выбранную дату прогноз недоступен.");
      const max = data.temperature_2m_max?.[index],
        min = data.temperature_2m_min?.[index];
      if (!Number.isFinite(max) || !Number.isFinite(min)) throw new Error("Сервис вернул неполный прогноз.");
      $("#weather").innerHTML =
        `<p>${esc(trip.city)} · ${formatDate(date)}</p><strong class="weather__temperature">${max}° / ${min}°</strong><p>Вероятность осадков: ${esc(data.precipitation_probability_max?.[index] ?? "—")}%</p>`;
    } catch (error) {
      if (this.store.trip === trip && this.day === day && trip.coords === coords)
        $("#weather").textContent = error.message;
    }
  }
}
new App(new TripStore(), new TravelApi());
