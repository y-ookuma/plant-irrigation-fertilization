// 株数密度(本/m²)のリアルタイム自動計算
function updatePlantDensity() {
  const houseArea = parseFloat(document.getElementById('houseArea').value);
  const totalPlants = parseFloat(document.getElementById('totalPlantsInput').value);
  const densityInput = document.getElementById('plantDensity');

  if (!isNaN(houseArea) && houseArea > 0 && !isNaN(totalPlants) && totalPlants > 0) {
    const density = totalPlants / houseArea;
    densityInput.value = density.toFixed(2);
  } else {
    densityInput.value = '';
  }
}

// 現在地取得
function getCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        document.getElementById('lat').value = position.coords.latitude.toFixed(4);
        document.getElementById('lon').value = position.coords.longitude.toFixed(4);
        alert('現在地を取得しました');
      },
      (error) => {
        alert('位置情報の取得に失敗しました: ' + error.message);
      }
    );
  } else {
    alert('お使いのブラウザは位置情報に対応していません');
  }
}

// 日付フォーマットヘルパー (YYYY/MM/DD)
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

// PNG画像ダウンロード機能
function downloadSummaryPNG() {
  const outputElement = document.getElementById('output');
  const pngBtn = document.querySelector('.btn-png');

  if (typeof html2canvas === 'undefined') {
    alert('画像キャプチャライブラリの読み込みに失敗しています。インターネット接続をご確認ください。');
    return;
  }

  pngBtn.style.visibility = 'hidden';

  html2canvas(outputElement, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true
  }).then(canvas => {
    pngBtn.style.visibility = 'visible';

    const link = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    link.download = `cucumber_irrigation_summary_${today}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }).catch(err => {
    pngBtn.style.visibility = 'visible';
    alert('画像の生成に失敗しました: ' + err.message);
  });
}

// JSONエクスポート/インポート機能
function exportParamsJSON() {
  const params = {
    version: "1.4",
    exportedAt: new Date().toISOString(),
    location: {
      latitude: parseFloat(document.getElementById('lat').value) || 0,
      longitude: parseFloat(document.getElementById('lon').value) || 0
    },
    cultivation: {
      houseArea: parseFloat(document.getElementById('houseArea').value) || 0,
      totalPlants: parseFloat(document.getElementById('totalPlantsInput').value) || 0,
      flowRate: parseFloat(document.getElementById('flowRate').value) || 0,
      intervalDays: parseInt(document.getElementById('intervalDays').value, 10) || 1,
      lai: parseFloat(document.getElementById('lai').value) || 0,
      fertilizerType: document.getElementById('fertilizerType').value,
      harvestKg: document.getElementById('harvestKg').value !== "" ? parseFloat(document.getElementById('harvestKg').value) : null
    },
    weatherOverride: {
      temperature: document.getElementById('temperature').value !== "" ? parseFloat(document.getElementById('temperature').value) : null,
      humidity: document.getElementById('humidity').value !== "" ? parseFloat(document.getElementById('humidity').value) : null
    }
  };

  const jsonStr = JSON.stringify(params, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const today = new Date().toISOString().split('T')[0];
  const a = document.createElement("a");
  a.href = url;
  a.download = `cucumber_params_${today}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importParamsJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);

      if (data.location) {
        if (data.location.latitude !== undefined) document.getElementById('lat').value = data.location.latitude;
        if (data.location.longitude !== undefined) document.getElementById('lon').value = data.location.longitude;
      }

      if (data.cultivation) {
        if (data.cultivation.houseArea !== undefined) document.getElementById('houseArea').value = data.cultivation.houseArea;
        if (data.cultivation.totalPlants !== undefined) document.getElementById('totalPlantsInput').value = data.cultivation.totalPlants;
        if (data.cultivation.flowRate !== undefined) document.getElementById('flowRate').value = data.cultivation.flowRate;
        if (data.cultivation.intervalDays !== undefined) document.getElementById('intervalDays').value = data.cultivation.intervalDays;
        if (data.cultivation.lai !== undefined) document.getElementById('lai').value = data.cultivation.lai;
        if (data.cultivation.fertilizerType !== undefined) document.getElementById('fertilizerType').value = data.cultivation.fertilizerType;
        if (data.cultivation.harvestKg !== undefined && data.cultivation.harvestKg !== null) {
          document.getElementById('harvestKg').value = data.cultivation.harvestKg;
        } else {
          document.getElementById('harvestKg').value = "";
        }
      }

      if (data.weatherOverride) {
        document.getElementById('temperature').value = data.weatherOverride.temperature !== null ? data.weatherOverride.temperature : "";
        document.getElementById('humidity').value = data.weatherOverride.humidity !== null ? data.weatherOverride.humidity : "";
      }

      updatePlantDensity();
      alert("設定パラメータをJSONから正常に復元しました。");
    } catch (err) {
      alert("JSONファイルの読み込みに失敗しました: " + err.message);
    }
  };
  reader.readAsText(file);
}

// 計算メイン処理
async function calculateWaterAndFertilizer() {
  updatePlantDensity();

  const lat = document.getElementById('lat').value;
  const lon = document.getElementById('lon').value;
  const houseArea = parseFloat(document.getElementById('houseArea').value);
  const totalPlants = parseFloat(document.getElementById('totalPlantsInput').value);
  const plantDensity = parseFloat(document.getElementById('plantDensity').value);
  const flowRate = parseFloat(document.getElementById('flowRate').value);
  const intervalDays = parseInt(document.getElementById('intervalDays').value, 10) || 1;
  const lai = parseFloat(document.getElementById('lai').value);
  const fertilizerType = document.getElementById('fertilizerType').value;
  const harvestKgInput = document.getElementById('harvestKg').value;

  let inputTemp = document.getElementById('temperature').value;
  let inputHum = document.getElementById('humidity').value;

  if (isNaN(houseArea) || houseArea <= 0 || isNaN(totalPlants) || totalPlants <= 0 || isNaN(flowRate) || flowRate <= 0 || isNaN(lai) || lai <= 0) {
    alert('入力パラメータを正しく設定してください');
    return;
  }

  // 日付・期間の設定
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + (intervalDays - 1));

  let periodString = intervalDays === 1 ? formatDate(startDate) : `${formatDate(startDate)} 〜 ${formatDate(endDate)}`;

  // APIデータ用配列
  let dailySolarList = new Array(intervalDays).fill(15.0);
  let dailyTempList = new Array(intervalDays).fill(25.0);
  let isApiSuccess = false;

  try {
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=shortwave_radiation_sum,temperature_2m_mean&forecast_days=${intervalDays}&timezone=auto`;
    const response = await fetch(apiUrl);
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.daily && data.daily.shortwave_radiation_sum) {
        dailySolarList = data.daily.shortwave_radiation_sum;
        dailyTempList = data.daily.temperature_2m_mean;
        isApiSuccess = true;
      }
    }
  } catch (err) {
    console.warn("Open-Meteo取得エラー。デフォルト値で続行します:", err);
  }

  const finalHum = inputHum !== "" ? parseFloat(inputHum) : 65.0;

  // --- 【未来気象データ・PAR・蒸散の積算計算】 ---
  const k = 0.7;
  const lightInterceptionFraction = 1 - Math.exp(-k * lai);

  let accumulatedWaterPerM2 = 0;
  let totalSolarSum = 0;
  let totalTempSum = 0;

  for (let i = 0; i < intervalDays; i++) {
    const daySolar = dailySolarList[i] ?? 15.0;
    const dayTemp = inputTemp !== "" ? parseFloat(inputTemp) : (dailyTempList[i] ?? 25.0);

    totalSolarSum += daySolar;
    totalTempSum += dayTemp;

    const absorbedSolarDay = daySolar * lightInterceptionFraction;
    let dayWaterPerM2 = absorbedSolarDay * 0.35;

    if (dayTemp > 25) {
      dayWaterPerM2 *= (1 + (dayTemp - 25) * 0.02);
    }
    if (finalHum < 50) {
      dayWaterPerM2 *= (1 + (50 - finalHum) * 0.005);
    }

    accumulatedWaterPerM2 += dayWaterPerM2;
  }

  const avgSolar = totalSolarSum / intervalDays; // 短波放射 (Rs) 平均 (MJ/m²/日)
  const avgPar = avgSolar * 0.48;                // PAR 平均 (MJ/m²/日)
  const totalParSum = totalSolarSum * 0.48;       // 期間合計 PAR (MJ/m²)
  const absorbedParTotal = totalParSum * lightInterceptionFraction; // 作物が吸収した総PAR (MJ/m²)
  const avgTemp = totalTempSum / intervalDays;

  // 蒸散量・給水量・施肥計算値
  const transpirationM2 = accumulatedWaterPerM2; 
  const transpirationTotalL = transpirationM2 * houseArea; 
  const transpirationPerPlant = transpirationM2 / plantDensity; 

  const waterPerM2 = transpirationM2;
  const waterPerPlant = transpirationPerPlant;

  const nPerPlant = waterPerPlant * 0.15;
  const pPerPlant = waterPerPlant * 0.04;
  const kPerPlant = waterPerPlant * 0.20;

  const totalWaterL = transpirationTotalL;
  const totalNKg = (nPerPlant * totalPlants) / 1000;
  const totalPKg = (pPerPlant * totalPlants) / 1000;
  const totalKKg = (kPerPlant * totalPlants) / 1000;

  const totalMinutes = totalWaterL / flowRate;
  const minutes = Math.floor(totalMinutes);
  const seconds = Math.round((totalMinutes - minutes) * 60);
  const timeString = `${minutes}分${seconds}秒 (${totalMinutes.toFixed(1)}分)`;

  let nPercent = 0.10, pPercent = 0.04, kPercent = 0.06;
  let fertName = "トミー液肥ブラック";

  if (fertilizerType === "green") {
    nPercent = 0.06; pPercent = 0.08; kPercent = 0.08;
    fertName = "トミー液肥グリーン";
  } else if (fertilizerType === "okf1") {
    nPercent = 0.15; pPercent = 0.08; kPercent = 0.17;
    fertName = "OK-F-1";
  }

  const densityFert = 1.2;
  const fertRequiredKg = totalNKg / nPercent;
  const fertRequiredL = fertRequiredKg / densityFert;
  const dilutionRatio = Math.round(totalWaterL / fertRequiredL);

  const supplyNKg = fertRequiredKg * nPercent;
  const supplyPKg = fertRequiredKg * pPercent;
  const supplyKKg = fertRequiredKg * kPercent;
  const supplyTotalKg = supplyNKg + supplyPKg + supplyKKg;

  const harvestKg = parseFloat(harvestKgInput) || 0;
  const dryMatterKg = harvestKg * 0.04;

  const outNKg = dryMatterKg * 0.030;
  const outPKg = dryMatterKg * 0.010;
  const outKKg = dryMatterKg * 0.045;
  const outTotalKg = outNKg + outPKg + outKKg;

  const diffNKg = supplyNKg - outNKg;
  const nRatio = supplyNKg > 0 ? (outNKg / supplyNKg) * 100 : 0;

  // --- 【画面描画・視覚更新】 ---
  document.getElementById('summaryPeriodDates').innerText = periodString;
  document.getElementById('summaryPeriodDays').innerText = intervalDays;

  // 1. トップ指標カード
  document.getElementById('cardTotalTranspirationL').innerText = Math.round(transpirationTotalL).toLocaleString();
  document.getElementById('cardTranspirationM2').innerText = transpirationM2.toFixed(2);
  document.getElementById('cardTranspirationPlant').innerText = transpirationPerPlant.toFixed(2);

  document.getElementById('cardTotalWaterL').innerText = Math.round(totalWaterL).toLocaleString();
  document.getElementById('cardWaterM2').innerText = waterPerM2.toFixed(2);
  document.getElementById('cardWaterPlant').innerText = waterPerPlant.toFixed(2);
  document.getElementById('cardWaterTime').innerText = timeString;

  document.getElementById('cardFertL').innerText = fertRequiredL.toFixed(1);
  document.getElementById('cardFertName').innerText = fertName;
  document.getElementById('cardFertKg').innerText = fertRequiredKg.toFixed(1);
  document.getElementById('cardDilution').innerText = dilutionRatio.toLocaleString();

  document.getElementById('cardDryMatter').innerText = dryMatterKg.toFixed(2);
  document.getElementById('cardHarvestKg').innerText = harvestKg.toFixed(1);

  // 2. ☀️ 短波放射(Rs)・PAR・光吸収SVGダイアグラム更新
  document.getElementById('svgSolarVal').textContent = avgSolar.toFixed(1);
  document.getElementById('svgParVal').textContent = avgPar.toFixed(1);
  document.getElementById('svgLaiVal').textContent = lai.toFixed(1);
  document.getElementById('svgAbsorbedRatio').textContent = Math.round(lightInterceptionFraction * 100);
  document.getElementById('svgTranspirationM2').textContent = transpirationM2.toFixed(2);
  document.getElementById('svgTranspirationTotal').textContent = Math.round(transpirationTotalL).toLocaleString();
  document.getElementById('svgAbsorbedPar').textContent = absorbedParTotal.toFixed(1);
  document.getElementById('svgTranspirationPlant').textContent = transpirationPerPlant.toFixed(2);

  // 3. 養分収支SVGダイアグラム更新
  document.getElementById('balanceFertLabel').textContent = fertName;
  document.getElementById('balSupplyN').textContent = supplyNKg.toFixed(2);
  document.getElementById('balSupplyP').textContent = supplyPKg.toFixed(2);
  document.getElementById('balSupplyK').textContent = supplyKKg.toFixed(2);
  document.getElementById('balSupplyTotal').textContent = supplyTotalKg.toFixed(2);

  document.getElementById('balHarvestVal').textContent = harvestKg.toFixed(1);
  document.getElementById('balOutN').textContent = outNKg.toFixed(2);
  document.getElementById('balOutP').textContent = outPKg.toFixed(2);
  document.getElementById('balOutK').textContent = outKKg.toFixed(2);
  document.getElementById('balOutTotal').textContent = outTotalKg.toFixed(2);

  const diffSign = diffNKg >= 0 ? "+" : "";
  document.getElementById('balDiffN').textContent = `${diffSign}${diffNKg.toFixed(2)}`;
  document.getElementById('nExportRatio').textContent = nRatio.toFixed(1);

  // 4. 養分プログレスバー設定
  document.getElementById('barNVal').innerText = totalNKg.toFixed(2);
  document.getElementById('barPVal').innerText = totalPKg.toFixed(2);
  document.getElementById('barKVal').innerText = totalKKg.toFixed(2);

  const pWidth = Math.min(Math.round((totalPKg / totalNKg) * 100), 100);
  const kWidth = Math.min(Math.round((totalKKg / totalNKg) * 100), 100);
  document.getElementById('barP').style.width = pWidth + '%';
  document.getElementById('barK').style.width = kWidth + '%';

  // 5. 📋 適用環境・設備データ（テーブル内テキスト更新）
  const tempSourceStr = inputTemp !== "" ? "手動指定" : (isApiSuccess ? `${intervalDays}日間予報平均` : "デフォルト");
  
  document.getElementById('resSolar').innerText = avgSolar.toFixed(1);
  document.getElementById('resSolarTotal').innerText = totalSolarSum.toFixed(1);
  document.getElementById('resPAR').innerText = avgPar.toFixed(1);
  document.getElementById('resPARTotal').innerText = totalParSum.toFixed(1);
  
  document.getElementById('resTemp').innerText = avgTemp.toFixed(1);
  document.getElementById('sourceTemp').innerText = tempSourceStr;
  document.getElementById('resHum').innerText = finalHum.toFixed(1);
  
  document.getElementById('resLAI').innerText = lai.toFixed(1);
  document.getElementById('resAbsorbedRatio').innerText = Math.round(lightInterceptionFraction * 100);
  
  document.getElementById('resArea').innerText = houseArea.toLocaleString();
  document.getElementById('resTotalPlants').innerText = totalPlants.toLocaleString();
  document.getElementById('resDensity').innerText = plantDensity.toFixed(2);
  
  document.getElementById('resFlowRate').innerText = flowRate.toFixed(1);

  document.getElementById('output').style.display = 'block';
}

// 初期ロード処理
document.addEventListener('DOMContentLoaded', () => {
  updatePlantDensity();
});
