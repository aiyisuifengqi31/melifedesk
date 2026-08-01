import { fetchOpenMeteoWeather } from "@/features/plan/weatherProvider";

describe("plan weather provider", () => {
  it("maps current location weather from Open-Meteo response", async () => {
    const fetcher = jest.fn(async () => ({
      json: async () => ({
        current: {
          apparent_temperature: 34.2,
          relative_humidity_2m: 73,
          temperature_2m: 29.4,
          time: "2026-07-31T09:22",
          weather_code: 3
        },
        current_units: {
          temperature_2m: "°C"
        },
        latitude: 39.9,
        longitude: 116.4
      }),
      ok: true
    }));

    await expect(fetchOpenMeteoWeather({ fetcher, latitude: 39.9, longitude: 116.4 })).resolves.toEqual({
      apparentTemperature: 34,
      description: "Cloudy",
      humidity: 73,
      latitude: 39.9,
      locationLabel: "当前位置",
      longitude: 116.4,
      source: "Open-Meteo",
      status: "ready",
      temperature: 29,
      updatedAt: "2026-07-31T09:22",
      unit: "°C"
    });

    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("latitude=39.9"));
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("longitude=116.4"));
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("current=temperature_2m"));
  });
});
