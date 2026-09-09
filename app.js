// =========================================================================
// キュウリ 潅水・施肥量計算機 (app.js)
// Copyright (c) 2026 y-ookuma
// Licensed under the BSD 3-Clause License.
// =========================================================================

// 初期化処理
document.addEventListener('DOMContentLoaded', () => {
  updatePlantDensity();
});

/**
 * ハウス面積と総株数から株数密度（本/m² および 本/坪）を自動計算して画面に反映する
 */
function updatePlantDensity() {
  const houseArea = parseFloat(document.getElementById('houseArea').value) || 0;
  const totalPlants = parseFloat(document.getElementById('totalPlantsInput').value) || 0;

  if (houseArea > 0 && totalPlants > 0) {
    const densityM2 = totalPlants / houseArea;
    const densityTsubo = densityM2 * 3.305785; // 1坪 = 3.305785 m²
    document.getElementById('plantDensity').value = densityM2.toFixed(2);
    document.getElementById('plantDensityTsubo').value = densityTsubo.toFixed(2);
  } else {
    document.getElementById('plantDensity').value = '0.00';
    document.getElementById('plantDensityTsubo').value = '0.00';
  }
}

/**
 * 現在地（ブラウザのGeolocation API）を取得して緯度経度フォームに設定し、逆ジオコーディングで地名を表示する
 */
function getCurrentLocation() {
  if (!navigator.geolocation) {
    alert("お使いのブラウザは位置情報取得に対応していません。");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      document.getElementById('lat').value = lat.toFixed(4);
      document.getElementById('lon').value = lon.toFixed(4);

      // 逆ジオコーディングAPI（Nominatim）を使用して地名を取得
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ja`);
        if (response.ok) {
          const data = await response.json();
          const placeName = data.display_name || "取得した座標周辺";
          document.getElementById('locationName').textContent = `地名: ${placeName}`;
        } else {
          document.getElementById('locationName').textContent = "地名: 取得に失敗しました";
        }
      } catch (err) {
        console.warn("逆ジオコーディング取得エラー:", err);
        document.getElementById('locationName').textContent = "地名: 取得エラー";
      }
    },
    (error) => {
      alert("位置情報の取得に失敗しました: " + error.message);
    }
  );
}

/**
 * ファイル選択ダイアログをプログラムから起動する
 */
function triggerImportJSON() {
  document.getElementById('jsonFileInput').click();
}

/**
 * 設定パラメータをJSONファイルとしてエクスポート（保存）する
 */
function exportParamsJSON() {
  const params = {
    lat: document.getElementById('lat').value,
    lon: document.getElementById('lon').value,
    locationName: document.getElementById('locationName').textContent,
    houseArea: document.getElementById('houseArea').value,
    totalPlants: document.getElementById('totalPlantsInput').value,
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
  a.download = `cucumber_irrigation_params_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * JSONファイルから設定パラメータをインポート（読み込み）する
 */
function importParamsJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.lat !== undefined) document.getElementById('lat').value = data.lat;
      if (data.lon !== undefined) document.getElementById('lon').value = data.lon;
      if (data.locationName !== undefined) document.getElementById('locationName').textContent = data.locationName;
      if (data.houseArea !== undefined) document.getElementById('houseArea').value = data.houseArea;
      if (data.totalPlants !== undefined) document.getElementById('totalPlantsInput').value = data.totalPlants;
      if (data.flowRate !== undefined) document.getElementById('flowRate').value = data.flowRate;
      if (data.intervalDays !== undefined) document.getElementById('intervalDays').value = data.intervalDays;
      if (data.lai !== undefined) document.getElementById('lai').value = data.lai;
      if (data.fertilizerType !== undefined) document.getElementById('fertilizerType').value = data.fertilizerType;
      if (data.harvestKg !== undefined) document.getElementById('harvestKg').value = data.harvestKg;
      if (data.manualSolarRad !== undefined) document.getElementById('manualSolarRad').value = data.manualSolarRad;
      if (data.temperature !== undefined) document.getElementById('temperature').value = data.temperature;
      if (data.humidity !== undefined) document.getElementById('humidity').value = data.humidity;

      updatePlantDensity();
      alert("設定パラメータを正常に読み込みました。");
    } catch (err) {
      alert("JSONファイルの解析に失敗しました: " + err.message);
    }
  };
  reader.readAsText(file);
}

/**
 * Open-Meteo APIから指定期間の気象予報・実績データを非同期取得する
 */
async function fetchWeatherForecast(lat, lon, startDate, endDate) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=shortwave_radiation_sum,temperature_2m_mean,relative_humidity_2m_mean&timezone=Asia/Tokyo&start_date=${startDate}&end_date=${endDate}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("気象データの取得に失敗しました (HTTP Status: " + response.status + ")");
  }
  const data = await response.json();
  return data.daily;
}

/**
 * メイン計算処理：気象データの取得、蒸散量・潅水量・液肥・養分バランスの算出とUIへの反映
 */
async function calculateWaterAndFertilizer() {
  try {
    // 1. 入力値の取得
    const lat = parseFloat(document.getElementById('lat').value);
    const lon = parseFloat(document.getElementById('lon').value);
    const houseArea = parseFloat(document.getElementById('houseArea').value) || 1000;
    const totalPlants = parseFloat(document.getElementById('totalPlantsInput').value) || 3000;
    const flowRate = parseFloat(document.getElementById('flowRate').value) || 50.0;
    const intervalDays = parseInt(document.getElementById('intervalDays').value) || 3;
    const lai = parseFloat(document.getElementById('lai').value) || 3.5;
    const fertType = document.getElementById('fertilizerType').value;
    const harvestKg = parseFloat(document.getElementById('harvestKg').value) || 0;

    const manualSolar = document.getElementById('manualSolarRad').value;
    const manualTemp = document.getElementById('temperature').value;
    const manualHum = document.getElementById('humidity').value;

    // 期間日付の算出 (今日から intervalDays 分)
    const today = new Date();
    const startDateStr = formatDateISO(today);
    const targetDateObj = new Date(today);
    targetDateObj.setDate(today.getDate() + (intervalDays - 1));
    const endDateStr = formatDateISO(targetDateObj);

    let avgSolar = 15.0;
    let avgTemp = 22.0;
    let avgHum = 70.0;
    let sourceTempLabel = "Open-Meteo予測平均";

    // 手動入力値があれば優先、なければOpen-Meteoから取得
    if (manualSolar !== "" && manualTemp !== "" && manualHum !== "") {
      avgSolar = parseFloat(manualSolar);
      avgTemp = parseFloat(manualTemp);
      avgHum = parseFloat(manualHum);
      sourceTempLabel = "手動指定値";
    } else {
      try {
        const dailyData = await fetchWeatherForecast(lat, lon, startDateStr, endDateStr);
        if (dailyData && dailyData.shortwave_radiation_sum && dailyData.shortwave_radiation_sum.length > 0) {
          const solars = dailyData.shortwave_radiation_sum.filter(v => v !== null);
          const temps = dailyData.temperature_2m_mean.filter(v => v !== null);
          const hums = dailyData.relative_humidity_2m_mean.filter(v => v !== null);

          if (solars.length > 0) avgSolar = solars.reduce((a, b) => a + b, 0) / solars.length;
          if (avgSolar > 1000) avgSolar = avgSolar / 1000000; 

          if (temps.length > 0) avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
          if (hums.length > 0) avgHum = hums.reduce((a, b) => a + b, 0) / hums.length;
        }
      } catch (err) {
        console.warn("気象API取得エラーのためデフォルト値を使用します: ", err.message);
        sourceTempLabel = "通信エラー(デフォルト値使用)";
      }
    }

    // 2. PAR（光合成有効放射）および群落受光率の計算
    const parTotal = avgSolar * 0.48; 
    const k = 0.7; // 消光係数
    const absorbedRatio = (1 - Math.exp(-k * lai)) * 100; // 受光率 (%)
    const absorbedPar = parTotal * (absorbedRatio / 100);

    // 3. 蒸散量計算
    let tempStressFactor = 1.0;
    if (avgTemp > 25) {
      tempStressFactor += (avgTemp - 25) * 0.03;
    }
    let humStressFactor = 1.0;
    if (avgHum < 60) {
      humStressFactor += (60 - avgHum) * 0.008;
    }

    const transpirationM2Daily = absorbedPar * 0.35 * tempStressFactor * humStressFactor;
    const totalTranspirationM2 = transpirationM2Daily * intervalDays;
    const totalTranspirationL = totalTranspirationM2 * houseArea;
    const transpirationPerPlant = totalTranspirationL / totalPlants;

    // 4. 給水量（潅水量）計算
    const totalWaterL = totalTranspirationL * 1.15;
    const waterM2 = totalWaterL / houseArea;
    const waterPerPlant = waterM2 / (totalPlants / houseArea);
    const requiredMinutes = totalWaterL / flowRate;
    const waterTimeStr = formatMinutesToTime(requiredMinutes);

    // 5. 液肥・施肥量計算
    const fertilizerSpecs = {
      black: { name: "トミー液肥ブラック", n: 0.10, p: 0.04, k: 0.06 },
      green: { name: "トミー液肥グリーン", n: 0.06, p: 0.08, k: 0.08 },
      okf1:  { name: "OK-F-1", n: 0.15, p: 0.08, k: 0.17 }
    };
    const currentFert = fertilizerSpecs[fertType] || fertilizerSpecs.black;

    const solarFactor = avgSolar / 15.0;
    const targetN_Kg = (houseArea * 0.0012 * intervalDays * solarFactor * (lai / 3.0)); 
    
    const fertWeightKg = targetN_Kg / currentFert.n;
    const fertLiters = fertWeightKg * 0.92;
    const dilutionRatio = totalWaterL / (fertLiters > 0 ? fertLiters : 1);

    // 6. 果実養分持ち出し量計算
    const dryMatterKg = harvestKg * 0.04;
    const outN = dryMatterKg * 0.03;
    const outP = dryMatterKg * 0.01;
    const outK = dryMatterKg * 0.045;

    const supplyN = fertWeightKg * currentFert.n;
    const supplyP = fertWeightKg * currentFert.p;
    const supplyK = fertWeightKg * currentFert.k;
    const supplyTotalNutrient = supplyN + supplyP + supplyK;
    const outTotalNutrient = outN + outP + outK;

    const diffN = supplyN - outN;
    const nExportRatioVal = supplyN > 0 ? (outN / supplyN) * 100 : 0;

    // 7. UIへの結果反映
    document.getElementById('summaryModeLabel').textContent = `${intervalDays}日分予測`;
    document.getElementById('summaryPeriodDates').textContent = `${startDateStr} 〜 ${endDateStr}`;
    document.getElementById('summaryPeriodDays').textContent = intervalDays;

    document.getElementById('cardTotalTranspirationL').textContent = Math.round(totalTranspirationL).toLocaleString();
    document.getElementById('cardTranspirationM2').textContent = totalTranspirationM2.toFixed(1);
    document.getElementById('cardTranspirationPlant').textContent = transpirationPerPlant.toFixed(2);

    document.getElementById('cardTotalWaterL').textContent = Math.round(totalWaterL).toLocaleString();
    document.getElementById('cardWaterM2').textContent = waterM2.toFixed(1);
    document.getElementById('cardWaterPlant').textContent = waterPerPlant.toFixed(2);
    document.getElementById('cardWaterTime').textContent = waterTimeStr;

    document.getElementById('cardFertL').textContent = fertLiters.toFixed(1);
    document.getElementById('cardFertName').textContent = currentFert.name;
    document.getElementById('cardFertKg').textContent = fertWeightKg.toFixed(1);
    document.getElementById('cardDilution').textContent = Math.round(dilutionRatio).toLocaleString();

    document.getElementById('cardDryMatter').textContent = dryMatterKg.toFixed(1);
    document.getElementById('cardHarvestKg').textContent = harvestKg.toFixed(1);

    document.getElementById('svgSolarVal').textContent = avgSolar.toFixed(1);
    document.getElementById('svgParVal').textContent = parTotal.toFixed(1);
    document.getElementById('svgLaiVal').textContent = lai.toFixed(1);
    document.getElementById('svgAbsorbedRatio').textContent = Math.round(absorbedRatio);
    document.getElementById('svgTranspirationM2').textContent = totalTranspirationM2.toFixed(2);
    document.getElementById('svgAbsorbedPar').textContent = absorbedPar.toFixed(1);
    document.getElementById('svgTranspirationPlant').textContent = transpirationPerPlant.toFixed(2);
    document.getElementById('svgTranspirationTotal').textContent = Math.round(totalTranspirationL).toLocaleString();

    document.getElementById('svgFertSolarFactor').textContent = solarFactor.toFixed(2);
    document.getElementById('svgFertTargetN').textContent = targetN_Kg.toFixed(2);
    document.getElementById('svgFertNameBadge').textContent = currentFert.name;
    document.getElementById('svgFertResultKg').textContent = fertWeightKg.toFixed(1);
    document.getElementById('svgFertResultL').textContent = fertLiters.toFixed(1);

    document.getElementById('balanceFertLabel').textContent = currentFert.name;
    document.getElementById('balSupplyN').textContent = supplyN.toFixed(2);
    document.getElementById('balSupplyP').textContent = supplyP.toFixed(2);
    document.getElementById('balSupplyK').textContent = supplyK.toFixed(2);
    document.getElementById('balSupplyTotal').textContent = supplyTotalNutrient.toFixed(2);

    document.getElementById('balDiffN').textContent = (diffN >= 0 ? "+" : "") + diffN.toFixed(2);
    document.getElementById('balHarvestVal').textContent = harvestKg.toFixed(1);
    document.getElementById('balOutN').textContent = outN.toFixed(2);
    document.getElementById('balOutP').textContent = outP.toFixed(2);
    document.getElementById('balOutK').textContent = outK.toFixed(2);
    document.getElementById('balOutTotal').textContent = outTotalNutrient.toFixed(2);
    document.getElementById('nExportRatio').textContent = nExportRatioVal.toFixed(1);

    document.getElementById('barFertNameDisplay').textContent = currentFert.name;
    document.getElementById('barFertLDisplay').textContent = fertLiters.toFixed(1);

    document.getElementById('barNVal').textContent = supplyN.toFixed(2);
    document.getElementById('barPVal').textContent = supplyP.toFixed(2);
    document.getElementById('barKVal').textContent = supplyK.toFixed(2);

    document.getElementById('resSolar').textContent = avgSolar.toFixed(1);
    document.getElementById('resSolarDetail').textContent = `(設定・取得元: ${sourceTempLabel})`;
    document.getElementById('resPAR').textContent = parTotal.toFixed(1);
    document.getElementById('resPARTotal').textContent = (parTotal * intervalDays).toFixed(1);
    document.getElementById('resAbsorbedParTotal').textContent = (absorbedPar * intervalDays).toFixed(1);
    document.getElementById('resTemp').textContent = avgTemp.toFixed(1);
    document.getElementById('sourceTemp').textContent = sourceTempLabel;
    document.getElementById('resHum').textContent = avgHum.toFixed(1);
    document.getElementById('resLAI').textContent = lai.toFixed(1);
    document.getElementById('resAbsorbedRatio').textContent = Math.round(absorbedRatio);
    document.getElementById('resArea').textContent = houseArea.toLocaleString();
    document.getElementById('resTotalPlants').textContent = totalPlants.toLocaleString();
    document.getElementById('resDensity').textContent = (totalPlants / houseArea).toFixed(2);
    document.getElementById('resFlowRate').textContent = flowRate.toFixed(1);

    document.getElementById('output').style.display = "block";
    document.getElementById('output').scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    alert("計算処理中にエラーが発生しました: " + error.message);
    console.error(error);
  }
}

function formatMinutesToTime(totalMinutes) {
  if (isNaN(totalMinutes) || totalMinutes <= 0) return "0分";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours > 0) {
    return `${hours}時間 ${minutes}分`;
  }
  return `${minutes}分`;
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function downloadSummaryPNG() {
  const targetElement = document.getElementById('output');
  if (!targetElement) return;

  html2canvas(targetElement, { scale: 2, useCORS: true }).then(canvas => {
    const link = document.createElement('a');
    link.download = `cucumber_irrigation_summary_${new Date().toISOString().slice(0,10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }).catch(err => {
    alert("PNG画像の生成に失敗しました: " + err.message);
  });
}
