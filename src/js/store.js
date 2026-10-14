import { uid, datesBetween, sumMoney } from "./utils.js";
export const STORAGE_KEY = "putevod.trips.v1";

function checkItem(item) {
  if (!item.title.trim()) throw new Error("Введите название.");
  if (!Number.isFinite(item.cost) || item.cost < 0) throw new Error("Укажите неотрицательную стоимость.");
}
function checkDetails(details) {
  if (!details.title.trim() || !details.city.trim()) throw new Error("Заполните название и город.");
  if (!Number.isInteger(details.travelers) || details.travelers < 1 || details.travelers > 50)
    throw new Error("Укажите число участников от 1 до 50.");
  if (!Number.isFinite(details.budget) || details.budget < 0) throw new Error("Укажите неотрицательный бюджет.");
}

export class TripStore {
  constructor(storage = null) {
    this.storage = storage;
    this.warning = "";
    this.state = { version: 1, trips: [], activeTripId: null };
    try {
      this.storage = storage || window.localStorage;
      const data = JSON.parse(this.storage.getItem(STORAGE_KEY));
      if (data) {
        if (!Array.isArray(data.trips)) throw new Error("Неверный формат");
        this.state = data;
        if (!this.trip) this.state.activeTripId = this.trips[0]?.id || null;
      }
    } catch {
      this.warning = "Не удалось прочитать сохранённые поездки.";
    }
  }
  get trips() {
    return this.state.trips;
  }
  get trip() {
    return this.trips.find((trip) => trip.id === this.state.activeTripId);
  }
  save() {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.warning = "";
    } catch {
      this.warning = "Не удалось сохранить данные. Не закрывайте страницу.";
    }
  }
  select(id) {
    this.state.activeTripId = id;
    this.save();
  }
  add(details) {
    checkDetails(details);
    const days = datesBetween(details.start, details.end).map((date) => ({ date, activities: [] }));
    const trip = { ...details, id: uid(), days, expenses: [], packing: [], notes: "" };
    this.trips.push(trip);
    this.select(trip.id);
    return trip;
  }
  editDetails(details) {
    checkDetails(details);
    const { title, city, country, coords, travelers, budget } = details;
    Object.assign(this.trip, { title, city, country, coords, travelers, budget });
    this.save();
  }
  remove(id) {
    this.state.trips = this.trips.filter((trip) => trip.id !== id);
    if (!this.trip) this.state.activeTripId = this.trips[0]?.id || null;
    this.save();
  }
  saveActivity(dayIndex, item, id = null) {
    checkItem(item);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)) throw new Error("Укажите время от 00:00 до 23:59.");
    const day = this.trip.days[dayIndex];
    if (!day) throw new Error("День поездки не найден.");
    const old = this.trip.days.flatMap((day) => day.activities).find((item) => item.id === id);
    this.deleteActivity(id, false);
    day.activities.push({ ...old, ...item, id: id || uid(), done: old?.done || false });
    day.activities.sort((a, b) => a.time.localeCompare(b.time));
    this.save();
  }
  deleteActivity(id, save = true) {
    for (const day of this.trip.days) day.activities = day.activities.filter((item) => item.id !== id);
    if (save) this.save();
  }
  saveExpense(item, id = null) {
    checkItem(item);
    this.trip.expenses = this.trip.expenses.filter((item) => item.id !== id);
    this.trip.expenses.push({ ...item, id: id || uid() });
    this.save();
  }
  deleteExpense(id) {
    this.trip.expenses = this.trip.expenses.filter((item) => item.id !== id);
    this.save();
  }
  addPacking(title) {
    if (!title.trim()) throw new Error("Введите название вещи.");
    this.trip.packing.push({ id: uid(), title: title.trim(), done: false });
    this.save();
  }
  deletePacking(id) {
    this.trip.packing = this.trip.packing.filter((item) => item.id !== id);
    this.save();
  }
  totals() {
    const costs = this.trip.days.flatMap((day) => day.activities).concat(this.trip.expenses);
    const total = sumMoney(costs.map((item) => item.cost));
    return {
      total,
      remaining: sumMoney([this.trip.budget, -total]),
      perPerson: Math.round((total * 100) / this.trip.travelers) / 100,
    };
  }
}
