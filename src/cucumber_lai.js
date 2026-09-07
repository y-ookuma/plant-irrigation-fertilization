// キュウリのLAI計算（葉齢から推定）
export function calcCucumberLAI(leafAges) {
  const a = 150;      // 最大葉面積係数
  const b = 0.055;    // 葉齢係数
  const groundArea = 0.30; // 1株あたり地表面積 m2/株

  let totalLA = 0;
  leafAges.forEach(age => {
    totalLA += a * Math.exp(b * age);
  });

  return totalLA / groundArea; // LAI
}
