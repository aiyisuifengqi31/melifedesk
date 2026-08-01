export type CurrentWeather = {
  apparentTemperature: number;
  description: string;
  humidity: number;
  latitude: number;
  locationLabel: string;
  longitude: number;
  source: "Open-Meteo";
  status: "ready";
  temperature: number;
  unit: string;
  updatedAt: string;
};

export type WeatherState =
  | CurrentWeather
  | {
      message: string;
      status: "idle" | "loading" | "error";
    };

type Fetcher = (url: string) => Promise<{
  json: () => Promise<unknown>;
  ok: boolean;
}>;

type GeoPosition = {
  coords: {
    latitude: number;
    longitude: number;
  };
};

type GeolocationLike = {
  getCurrentPosition: (success: (position: GeoPosition) => void, error: (error: unknown) => void, options?: PositionOptions) => void;
};

export async function resolveCurrentCityWeather(input: {
  fetcher?: Fetcher;
  geolocation?: GeolocationLike | null;
  timeoutMs?: number;
} = {}): Promise<WeatherState> {
  const geolocation = input.geolocation ?? (typeof navigator !== "undefined" ? navigator.geolocation : null);
  if (!geolocation) {
    return { message: "无法读取当前位置，请检查浏览器定位权限。", status: "error" };
  }

  try {
    const position = await getCurrentPosition(geolocation, input.timeoutMs ?? 8000);
    const fetcher = input.fetcher ?? fetch;
    const city = await reverseGeocodeCity({
      fetcher,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    });

    return fetchOpenMeteoWeather({
      fetcher,
      latitude: position.coords.latitude,
      locationLabel: city,
      longitude: position.coords.longitude
    });
  } catch {
    return { message: "定位失败，允许定位后会显示当前城市实时天气。", status: "error" };
  }
}

export async function fetchOpenMeteoWeather(input: {
  fetcher?: Fetcher;
  latitude: number;
  locationLabel?: string;
  longitude: number;
}): Promise<CurrentWeather> {
  const fetcher = input.fetcher ?? fetch;
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(input.latitude));
  url.searchParams.set("longitude", String(input.longitude));
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code");
  url.searchParams.set("timezone", "auto");

  const response = await fetcher(url.toString());
  if (!response.ok) {
    throw new Error("weather_request_failed");
  }

  const payload = (await response.json()) as {
    current?: {
      apparent_temperature?: number;
      relative_humidity_2m?: number;
      temperature_2m?: number;
      time?: string;
      weather_code?: number;
    };
    current_units?: {
      temperature_2m?: string;
    };
    latitude?: number;
    longitude?: number;
  };

  return {
    apparentTemperature: Math.round(payload.current?.apparent_temperature ?? 0),
    description: weatherCodeToText(payload.current?.weather_code ?? 0),
    humidity: Math.round(payload.current?.relative_humidity_2m ?? 0),
    latitude: payload.latitude ?? input.latitude,
    locationLabel: input.locationLabel ?? "当前位置",
    longitude: payload.longitude ?? input.longitude,
    source: "Open-Meteo",
    status: "ready",
    temperature: Math.round(payload.current?.temperature_2m ?? 0),
    unit: payload.current_units?.temperature_2m ?? "°C",
    updatedAt: payload.current?.time ?? ""
  };
}

async function reverseGeocodeCity(input: { fetcher: Fetcher; latitude: number; longitude: number }) {
  const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
  url.searchParams.set("latitude", String(input.latitude));
  url.searchParams.set("longitude", String(input.longitude));
  url.searchParams.set("localityLanguage", "zh");

  const response = await input.fetcher(url.toString());
  if (!response.ok) {
    return "当前城市";
  }

  const payload = (await response.json()) as {
    city?: string;
    locality?: string;
    principalSubdivision?: string;
  };

  return payload.city || payload.locality || payload.principalSubdivision || "当前城市";
}

function getCurrentPosition(geolocation: GeolocationLike, timeoutMs: number) {
  return new Promise<GeoPosition>((resolve, reject) => {
    geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 10 * 60 * 1000,
      timeout: timeoutMs
    });
  });
}

function weatherCodeToText(code: number) {
  if (code === 0) return "Clear";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Weather";
}
