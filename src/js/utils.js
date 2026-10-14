export const uid = () => crypto.randomUUID();
export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
export const money = (value) => value.toLocaleString("ru-RU", { style: "currency", currency: "RUB" });
export const sumMoney = (values) => values.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100;
export const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const addDays = (date, count) => new Date(Date.parse(date) + count * 86400000).toISOString().slice(0, 10);
export const formatDate = (date) => new Date(date + "T12:00:00").toLocaleDateString("ru-RU");
export function datesBetween(start, end) {
  const count = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (!Number.isInteger(count) || count < 1 || count > 30) throw new Error("Выберите даты поездки: от 1 до 30 дней.");
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}
