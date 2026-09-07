// 収量予測モデル（ET → 収量）
export function calcYield(ET, crop = "cucumber") {
  const ky = {
    cucumber: 0.20,
    tomato: 0.28,
    pepper: 0.18,
    strawberry: 0.12
  }[crop];

  return ky * ET; // kg/株/day
}


// NPK施肥モデル（収量比例施肥）
export function calcNPK(ET, crop = "cucumber") {

  // 収量予測を統合
  const Y = calcYield(ET, crop);

  // NPK係数（g/kg収量）
  const coef = {
    cucumber: { N: 0.45, P: 0.16, K: 1.10 },
    tomato:   { N: 0.50, P: 0.18, K: 1.20 },
    pepper:   { N: 0.40, P: 0.15, K: 0.90 },
    strawberry:{ N: 0.30, P: 0.12, K: 0.70 }
  }[crop];

  return {
    Y,                 // 収量予測（kg/株/day）
    N: Y * coef.N,     // 窒素
    P: Y * coef.P,     // リン酸
    K: Y * coef.K      // カリ
  };
}
