// 短波放射（W/m2）配列からDLI（mol/m2/day）を計算
export function calcDLI(shortwaveArray) {
  let totalMol = 0;
  shortwaveArray.forEach(W => {
    const MJ = (W / 1000) * 3600; // MJ/m2/h
    const mol = MJ * 2.04;        // mol/m2/h
    totalMol += mol;
  });
  return totalMol;
}
