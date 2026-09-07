// 気温T(℃)と湿度RH(%)からVPD(kPa)を計算
export function calcVPD(T, RH) {
  const es = 0.6108 * Math.exp((17.27 * T) / (T + 237.3)); // 飽和水蒸気圧
  const ea = es * (RH / 100);                              // 実際の水蒸気圧
  return es - ea;                                          // VPD
}
