/**
 * キュウリ 潅水・施肥量計算機 (app.js)
 * 短波放射(GHI)入力対応 & 直散比（直達43%・散乱57%）によるPAR算出版
 */

const FERTILIZER_DATABASE = {
  'black': { name: 'トミー液肥ブラック', n: 10, p: 4, k: 6 },
  'green': { name: 'トミー液肥グリーン', n: 6, p: 8, k: 8 },
  'okf1':  { name: 'OK-F-1', n: 15, p: 8, k: 17 }
};

document.addEventListener('DOMContentLoaded', () => {
  updatePlantDensity();
});

function updatePlantDensity() {
  const area = parseFloat(document.getElementById('houseArea')?.value) || 0;
  const plants = parseFloat(document.getElementById('totalPlantsInput')?.value) || 0;
  const densityInput = document.getElementById('plantDensity');
  if (densityInput && area > 0) {
    densityInput.value = (plants / area).toFixed(2);
  }
}

function getCurrentLocation() {
  if (!navigator.geolocation) {
    alert('お使いのブラウザは位置情報取得に対応していません。');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      document.getElementById('lat').value = pos.coords.latitude.toFixed(4);
      document.getElementById('lon').value = pos.coords.longitude.toFixed(4);
      alert('現在地の緯度・経度を取得しました。');
    },
    (err) => {
      alert(`位置情報の取得に失敗しました: ${err.message}`);
    }
  );
}

async function fetchWeatherData(lat, lon, days) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=shortwave_radiation_sum,temperature_2m_mean,relative_humidity_2m_mean&timezone=auto&forecast_days=${days}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('気象API通信エラー');
    const data = await res.json();

    let sumSolar = 0;
    let sumTemp = 0;
    let sumHum = 0;
    const count = data.daily.time.length;

    for (let i = 0; i < count; i++) {
      sumSolar += data.daily.shortwave_radiation_sum[i];
      sumTemp += data.daily.temperature_2m_mean[i];
      sumHum += data.daily.relative_humidity_2m_mean ? data.daily.relative_humidity_2m_mean[i] : 65;
    }

    const startDate = data.daily.time[0];
    const endDate = data.daily.time[count - 1];

    return {
      solarTotal: sumSolar,
      solarDaily: sumSolar / count,
      avgTemp: sumTemp / count,
      avgHum: sumHum / count,
      startDate,
      endDate,
      daysFetched: count,
      isApiSuccess: true
    };
  } catch (error) {
    console.warn('API取得失敗。デフォルト値を使用します:', error);
    const today = new Date();
    const future = new Date();
    future.setDate(today.getDate() + (days - 1));

    return {
      solarTotal: 15.0 * days,
      solarDaily: 15.0,
      avgTemp: 25.0,
      avgHum: 65.0,
      startDate: today.toISOString().slice(0, 10),
      endDate: future.toISOString().slice(0, 10),
      daysFetched: days,
      isApiSuccess: false
    };
  }
}

async function calculateWaterAndFertilizer() {
  const lat = parseFloat(document.getElementById('lat').value) || 35.6895;
  const lon = parseFloat(document.getElementById('lon').value) || 139.6917;
  const houseArea = parseFloat(document.getElementById('houseArea').value) || 1000;
  const totalPlants = parseFloat(document.getElementById('totalPlantsInput').value) || 3000;
  const flowRate = parseFloat(document.getElementById('flowRate').value) || 50.0;
  const intervalDays = parseInt(document.getElementById('intervalDays').value) || 1;
  const lai = parseFloat(document.getElementById('lai').value) || 3.5;
  const fertilizerType = document.getElementById('fertilizerType').value;
  const harvestKg = parseFloat(document.getElementById('harvestKg').value) || 0;

  const manualSolarRad = document.getElementById('manualSolarRad').value;
  const manualTemp = document.getElementById('temperature').value;
  const manualHum = document.getElementById('humidity').value;

  const weather = await fetchWeatherData(lat, lon, intervalDays);

  const solarDaily = manualSolarRad !== "" ? parseFloat(manualSolarRad) : weather.solarDaily;
  const avgTemp = manualTemp !== "" ? parseFloat(manualTemp) : weather.avgTemp;
  const avgHum = manualHum !== "" ? parseFloat(manualHum) : weather.avgHum;

  const totalRsDaily = solarDaily;
  const totalRsTotal = solarDaily * intervalDays;

  // 直散比仮定モデル（直達43%・散乱57%に分離してPARを算出）
  const rsDirect = totalRsDaily * 0.43;
  const rsDiffuse = totalRsDaily * 0.57;
  const parDirect = rsDirect * 0.43;
  const parDiffuse = rsDiffuse * 0.57;
  const totalParDaily = parDirect + parDiffuse;
  const totalParTotal = totalParDaily * intervalDays;

  // モンシ・サエキの消光モデル (k = 0.7)
  const k = 0.7;
  const absorbedRatio = 1 - Math.exp(-k * lai);

  const absorbedParDaily = totalParDaily * absorbedRatio;
  const absorbedParTotal = totalParTotal * absorbedRatio;
  const absorbedRsTotal = totalRsTotal * absorbedRatio;

  // 蒸散量計算 (1 MJ吸収あたり 0.35 L/m²)
  let transRatePerM2Total = absorbedRsTotal * 0.35;

  if (avgTemp > 25) {
    transRatePerM2Total *= (1 + (avgTemp - 25) * 0.02);
  }
  if (avgHum < 50) {
    transRatePerM2Total *= (1 + (50 - avgHum) * 0.005);
  }

  const totalWaterL = transRatePerM2Total * houseArea;
  const waterPerPlantL = totalPlants > 0 ? totalWaterL / totalPlants : 0;
  const transM2Daily = transRatePerM2Total / intervalDays;

  const totalMinutes = flowRate > 0 ? totalWaterL / flowRate : 0;
  const timeMin = Math.floor(totalMinutes);
  const timeSec = Math.round((totalMinutes - timeMin) * 60);

  // 施肥量計算 (N: 150ppm = 0.15g/L)
  const fert = FERTILIZER_DATABASE[fertilizerType] || FERTILIZER_DATABASE['black'];
  const supplyNGramTotal = totalWaterL * 0.15;
  const fertWeightKg = supplyNGramTotal / (fert.n * 10);
  const fertVolumeL = fertWeightKg;
  const dilutionRatio = (fert.n * 10000) / 150;

  const supplyN = supplyNGramTotal / 1000;
  const supplyP = supplyN * (fert.p / fert.n);
  const supplyK = supplyN * (fert.k / fert.n);

  // 果実養分持ち出し計算
  const dryMatterKg = harvestKg * 0.04;
  const outN = dryMatterKg * 0.03;
  const outP = dryMatterKg * 0.01;
  const outK = dryMatterKg * 0.045;

  const diffN = supplyN - outN;
  const nExportRatio = supplyN > 0 ? (outN / supplyN) * 100 : 0;

  // DOM反映
  document.getElementById('summaryPeriodDates').textContent = `${weather.startDate} 〜 ${weather.endDate}`;
  document.getElementById('summaryPeriodDays').textContent = intervalDays;

  document.getElementById('cardTotalTranspirationL').textContent = Math.round(totalWaterL).toLocaleString();
  document.getElementById('cardTranspirationM2').textContent = transRatePerM2Total.toFixed(2);
  document.getElementById('cardTranspirationPlant').textContent = waterPerPlantL.toFixed(2);

  document.getElementById('cardTotalWaterL').textContent = Math.round(totalWaterL).toLocaleString();
  document.getElementById('cardWaterM2').textContent = transRatePerM2Total.toFixed(2);
  document.getElementById('cardWaterPlant').textContent = waterPerPlantL.toFixed(2);
  document.getElementById('cardWaterTime').textContent = `${timeMin}分${timeSec}秒`;

  document.getElementById('cardFertL').textContent = fertVolumeL.toFixed(2);
  document.getElementById('cardFertName').textContent = fert.name;
  document.getElementById('cardFertKg').textContent = fertWeightKg.toFixed(2);
  document.getElementById('cardDilution').textContent = Math.round(dilutionRatio);

  document.getElementById('cardDryMatter').textContent = dryMatterKg.toFixed(2);
  document.getElementById('cardHarvestKg').textContent = harvestKg;

  // SVG表示更新
  document.getElementById('svgSolarVal').textContent = totalRsDaily.toFixed(1);
  document.getElementById('svgParVal').textContent = totalParDaily.toFixed(2);
  document.getElementById('svgLaiVal').textContent = lai.toFixed(1);
  document.getElementById('svgAbsorbedRatio').textContent = Math.round(absorbedRatio * 100);
  document.getElementById('svgTranspirationM2').textContent = transM2Daily.toFixed(2);
  document.getElementById('svgTranspirationTotal').textContent = Math.round(totalWaterL).toLocaleString();
  document.getElementById('svgAbsorbedPar').textContent = absorbedParDaily.toFixed(2);
  document.getElementById('svgTranspirationPlant').textContent = waterPerPlantL.toFixed(2);

  // 養分収支
  document.getElementById('balanceFertLabel').textContent = fert.name;
  document.getElementById('balSupplyN').textContent = supplyN.toFixed(2);
  document.getElementById('balSupplyP').textContent = supplyP.toFixed(2);
  document.getElementById('balSupplyK').textContent = supplyK.toFixed(2);
  document.getElementById('balSupplyTotal').textContent = (supplyN + supplyP + supplyK).toFixed(2);
  document.getElementById('balDiffN').textContent = (diffN >= 0 ? '+' : '') + diffN.toFixed(2);
  document.getElementById('balHarvestVal').textContent = harvestKg;
  document.getElementById('balOutN').textContent = outN.toFixed(2);
  document.getElementById('balOutP').textContent = outP.toFixed(2);
  document.getElementById('balOutK').textContent = outK.toFixed(2);
  document.getElementById('balOutTotal').textContent = (outN + outP + outK).toFixed(2);
  document.getElementById('nExportRatio').textContent = nExportRatio.toFixed(1);

  document.getElementById('barNVal').textContent = supplyN.toFixed(2);
  document.getElementById('barPVal').textContent = supplyP.toFixed(2);
  document.getElementById('barKVal').textContent = supplyK.toFixed(2);

  const pRatio = fert.n > 0 ? (fert.p / fert.n) * 100 : 0;
  const kRatio = fert.n > 0 ? (fert.k / fert.n) * 100 : 0;
  document.getElementById('barP').style.width = `${Math.min(pRatio, 100)}%`;
  document.getElementById('barK').style.width = `${Math.min(kRatio, 100)}%`;

  // テーブル反映
  document.getElementById('resSolar').textContent = totalRsDaily.toFixed(2);
  document.getElementById('resPAR').textContent = totalParDaily.toFixed(2);
  document.getElementById('resPARTotal').textContent = totalParTotal.toFixed(2);
  document.getElementById('resAbsorbedParTotal').textContent = absorbedParTotal.toFixed(2);
  document.getElementById('resTemp').textContent = avgTemp.toFixed(1);
  document.getElementById('sourceTemp').textContent = weather.isApiSuccess && manualTemp === "" ? "API予報" : "設定値";
  document.getElementById('resHum').textContent = avgHum.toFixed(1);
  document.getElementById('resLAI').textContent = lai.toFixed(1);
  document.getElementById('resAbsorbedRatio').textContent = Math.round(absorbedRatio * 100);
  document.getElementById('resArea').textContent = houseArea;
  document.getElementById('resTotalPlants').textContent = totalPlants;
  document.getElementById('resDensity').textContent = (totalPlants / houseArea).toFixed(2);
  document.getElementById('resFlowRate').textContent = flowRate.toFixed(1);

  document.getElementById('output').style.display = 'block';
}

function exportParamsJSON() {
  const params = {
    lat: document.getElementById('lat').value,
    lon: document.getElementById('lon').value,
    houseArea: document.getElementById('houseArea').value,
    totalPlantsInput: document.getElementById('totalPlantsInput').value,
    flowRate: document.getElementById('flowRate').value,
    intervalDays: document.getElementById('intervalDays').value,
    lai: document.getElementById('lai').value,
    fertilizerType: document.getElementById('fertilizerType').value,
    harvestKg: document.getElementById('harvestKg').value,
    manualSolarRad: document.getElementById('manualSolarRad').value,
    temperature: document.getElementById('temperature').value,
    humidity: document.getElementById('humidity').value
  };

  const blob = new Blob([JSON.stringify(params, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cucumber_params_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importParamsJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.lat !== undefined) document.getElementById('lat').value = data.lat;
      if (data.lon !== undefined) document.getElementById('lon').value = data.lon;
      if (data.houseArea !== undefined) document.getElementById('houseArea').value = data.houseArea;
      if (data.totalPlantsInput !== undefined) document.getElementById('totalPlantsInput').value = data.totalPlantsInput;
      if (data.flowRate !== undefined) document.getElementById('flowRate').value = data.flowRate;
      if (data.intervalDays !== undefined) document.getElementById('intervalDays').value = data.intervalDays;
      if (data.lai !== undefined) document.getElementById('lai').value = data.lai;
      if (data.fertilizerType !== undefined) document.getElementById('fertilizerType').value = data.fertilizerType;
      if (data.harvestKg !== undefined) document.getElementById('harvestKg').value = data.harvestKg;
      if (data.manualSolarRad !== undefined) document.getElementById('manualSolarRad').value = data.manualSolarRad;
      if (data.temperature !== undefined) document.getElementById('temperature').value = data.temperature;
      if (data.humidity !== undefined) document.getElementById('humidity').value = data.humidity;

      updatePlantDensity();
      alert('設定パラメータを正常にインポートしました。「🚀 計算実行」を押してください。');
    } catch (err) {
      alert('JSONファイルの読み込み解析に失敗しました。');
    }
  };
  reader.readAsText(file);
}

function downloadSummaryPNG() {
  const outputElem = document.getElementById('output');
  if (!outputElem || outputElem.style.display === 'none') {
    alert('計算結果が表示されていません。');
    return;
  }
  html2canvas(outputElem, { scale: 2, backgroundColor: '#ffffff' }).then((canvas) => {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `cucumber_summary_${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  });
}
