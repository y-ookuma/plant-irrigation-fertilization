import { calcDLI } from "./lai_core.js";
import { calcVPD } from "./vpd.js";

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// LAI・環境データからET・潅水量を計算
export function calcIrrigationFromEnv(LAI, env, {
  temp = null,      // ハウス内気温（指定があれば優先）
  rh = null,        // ハウス内湿度（指定があれば優先）
  plant_density = 2.5, // 株数/m2
  ground_area = null,  // m2/株（未指定なら密度から計算）
  leaching = 1.1,      // 排液率補正
  crop_factor = 1.0    // 作物係数
} = {}) {

  const DLI = calcDLI(env.shortwave);

  const T = temp ?? average(env.temp);
  const RH = rh ?? average(env.rh);

  const VPD = calcVPD(T, RH);

  // 蒸散量 ET（L/m2/day相当）
  const ET =
    0.05 * DLI * (0.7 + 0.3 * LAI) *
    (0.6 + 0.4 * VPD) * crop_factor;

  const area = ground_area ?? (1 / plant_density);

  return {
    DLI,
    T,
    RH,
    VPD,
    ET,
    irrigation_per_plant: ET * area * leaching // L/株/day
  };
}
