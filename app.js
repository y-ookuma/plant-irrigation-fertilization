// リアルタイムで株数密度(本/m²)を自動計算
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

async function calculateWaterAndFertilizer() {
  const lat = document.getElementById('lat').value;
  const lon = document.getElementById('lon').value;
  const houseArea = parseFloat(document.getElementById('houseArea').value);
  const totalPlants = parseFloat(document.getElementById('totalPlantsInput').value);
  const plantDensity = parseFloat(document.getElementById('plantDensity').value);
  const lai = parseFloat(document.getElementById('lai').value);

  let inputTemp = document.getElementById('temperature').value;
  let inputHum = document.getElementById('humidity').value;

  if (isNaN(houseArea) || houseArea <= 0) {
    alert('ハウス面積（m²）を正しく入力してください');
    return;
  }

  if (isNaN(totalPlants) || totalPlants <= 0) {
    alert('総株数（本）を正しく入力してください');
    return;
  }

  if (isNaN(plantDensity) || plantDensity <= 0) {
    alert('株数密度の計算に失敗しました。入力値を確認してください');
    return;
  }

  if (isNaN(lai) || lai <= 0) {
    alert('LAI（葉面積指数）を正しく入力してください');
    return;
  }

  // デフォルト気象値の設定
  let solarRadiationSum = 15.0;
  let fetchedTemp = 25.0;
  let fetchedHum = 65.0;

  try {
    // Open-Meteo API呼び出し (日射量・気温)
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=shortwave_radiation_sum,temperature_2m_mean&timezone=auto`;
    const response = await fetch(apiUrl);
    
    if (response.ok) {
      const data = await response.json();
      if (data.daily && data.daily.shortwave_radiation_sum) {
        solarRadiationSum = data.daily.shortwave_radiation_sum[0] ?? 15.0;
        fetchedTemp = data.daily.temperature_2m_mean[0] ?? 25.0;
      }
    }
  } catch (err) {
    console.warn("Open-Meteo取得失敗のため標準値を使用します", err);
  }

  const finalTemp = inputTemp !== "" ? parseFloat(inputTemp) : fetchedTemp;
  const sourceTemp = inputTemp !== "" ? "手動指定" : "Open-Meteo取得";

  const finalHum = inputHum !== "" ? parseFloat(inputHum) : fetchedHum;
  const sourceHum = inputHum !== "" ? "手動指定" : (inputHum !== "" ? "Open-Meteo取得" : "既定値(65%)");

  // --- 【計算ロジック】 ---
  const k = 0.7; // 消光係数
  const lightInterceptionFraction = 1 - Math.exp(-k * lai); // 受光率

  // 基本蒸散量（L/m²）
  let baseWaterPerM2 = solarRadiationSum * lightInterceptionFraction * 0.35;

  // 気温・湿度補正
  if (finalTemp > 25) {
    baseWaterPerM2 *= (1 + (finalTemp - 25) * 0.02);
  }
  if (finalHum < 50) {
    baseWaterPerM2 *= (1 + (50 - finalHum) * 0.005);
  }

  // 1株あたりの潅水量 (L/株)
  const waterPerPlant = baseWaterPerM2 / plantDensity;

  // 1株あたりの施肥量 (g/株)
  const nPerPlant = waterPerPlant * 0.15;
  const pPerPlant = waterPerPlant * 0.04;
  const kPerPlant = waterPerPlant * 0.20;

  // --- 【ハウス全体の計算】 ---
  const totalWaterL = baseWaterPerM2 * houseArea;     // 総潅水量 (L)
  const totalWaterTon = totalWaterL / 1000;           // 総潅水量 (t/m³)

  const totalNKg = (nPerPlant * totalPlants) / 1000;  // 総窒素量 (kg)
  const totalPKg = (pPerPlant * totalPlants) / 1000;  // 総リン酸量 (kg)
  const totalKKg = (kPerPlant * totalPlants) / 1000;  // 総カリウム量 (kg)

  // --- 画面描画 ---
  document.getElementById('resSolar').innerText = solarRadiationSum.toFixed(2);
  document.getElementById('resTemp').innerText = finalTemp.toFixed(1);
  document.getElementById('sourceTemp').innerText = sourceTemp;
  document.getElementById('resHum').innerText = finalHum.toFixed(1);
  document.getElementById('sourceHum').innerText = sourceHum;
  document.getElementById('resLAI').innerText = lai.toFixed(1);
  document.getElementById('resTotalPlants').innerText = totalPlants.toLocaleString();

  // 1株・単位面積あたり
  document.getElementById('resWaterM2').innerText = baseWaterPerM2.toFixed(2);
  document.getElementById('resWaterPlant').innerText = waterPerPlant.toFixed(2);
  document.getElementById('resN').innerText = nPerPlant.toFixed(2);
  document.getElementById('resP').innerText = pPerPlant.toFixed(2);
  document.getElementById('resK').innerText = kPerPlant.toFixed(2);

  // ハウス全体
  document.getElementById('resTotalWaterL').innerText = Math.round(totalWaterL).toLocaleString();
  document.getElementById('resTotalWaterTon').innerText = totalWaterTon.toFixed(2);
  document.getElementById('resTotalN').innerText = totalNKg.toFixed(2);
  document.getElementById('resTotalP').innerText = totalPKg.toFixed(2);
  document.getElementById('resTotalK').innerText = totalKKg.toFixed(2);

  // 結果エリアを表示
  document.getElementById('output').style.display = 'block';
}

// ページ読み込み時に株数密度の初期計算を実行
window.onload = updatePlantDensity;
