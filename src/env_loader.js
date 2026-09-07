// Open-Meteoから短波放射・気温・湿度を取得
export async function loadEnv(
  lat = 36.013447,
  lon = 139.593063
) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=shortwave_radiation,temperature_2m,relative_humidity_2m`;
  const res = await fetch(url);
  const data = await res.json();
  return {
    shortwave: data.hourly.shortwave_radiation,
    temp: data.hourly.temperature_2m,
    rh: data.hourly.relative_humidity_2m
  };
}
