export class ApiClient {
  async get(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Ошибка сервиса: ${response.status}. Попробуйте позже.`);
      return await response.json();
    } catch (error) {
      if (error instanceof TypeError) throw new Error("Не удалось связаться с сервисом. Проверьте интернет.");
      if (error instanceof SyntaxError) throw new Error("Сервис вернул непонятный ответ. Попробуйте позже.");
      throw error;
    }
  }
}
export class TravelApi extends ApiClient {
  async searchCities(query) {
    if (query.trim().length < 2) throw new Error("Введите хотя бы 2 символа названия города.");
    const data = await this.get(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=ru`,
    );
    return (data.results || []).map((city) => ({
      city: city.name,
      country: city.country || "",
      region: city.admin1 || "",
      coords: { lat: city.latitude, lng: city.longitude },
    }));
  }
  async forecast(coords) {
    const data = await this.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16`,
    );
    if (!Array.isArray(data.daily?.time)) throw new Error("Прогноз временно недоступен.");
    return data.daily;
  }
}
