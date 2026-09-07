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
  const plantDensity = parseFloat(document.getElementById('plantDensity').value);
  const lai = parseFloat(document.getElementById('lai').value);

  let inputTemp = document.getElementById('temperature').value;
  let inputHum = document.getElementById('humidity').value;

  if (!plantDensity || plantDensity <= 0) {
    alert('株数（本/m²）を正しく入力してください');
    return;
  }

  if (!lai || lai <= 0) {
    alert('LAI（葉面積指数）を正しく入力してください');
    return;
  }

  try {
    // Open-Meteo API呼び出し
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=shortwave_radiation_sum,temperature_2m_mean,relative_humidity_2m_mean&timezone=auto`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!data.daily) {
      throw new Error('気象データの取得に失敗しました');
    }

    const solarRadiationSum = data.daily.shortwave_radiation_sum[0]; // MJ/m²
    const fetchedTemp = data.daily.temperature_2m_mean[0];            // °C
    const fetchedHum = data.daily.relative_humidity_2m_mean[0];             // %

    const finalTemp = inputTemp !== "" ? parseFloat(inputTemp) : fetchedTemp;
    const sourceTemp = inputTemp !== "" ? "手動指定" : "Open-Meteo取得";

    const finalHum = inputHum !== "" ? parseFloat(inputHum) : fetchedHum;
    const sourceHum = inputHum !== "" ? "手動指定" : "Open-Meteo取得";

    // --- 【LAIを組込んだ計算ロジック】 ---
    
    // 1. 光の吸光モデル (Beer-Lambertの法則) による群体受光係数
    // 消光係数 (k) はキュウリでおおむね 0.7 程度
    const k = 0.7;
    const lightInterceptionFraction = 1 - Math.exp(-k * lai); // 作物群落による日射受光率 (0〜1)

    // 受光量に応じた基本蒸散量（日射エネルギーからの水蒸発効率: 約 0.35 L / MJ）
    let baseWaterPerM2 = solarRadiationSum * lightInterceptionFraction * 0.35;

    // 2. 気温・湿度（VPD補正）
    if (finalTemp > 25) {
      baseWaterPerM2 *= (1 + (finalTemp - 25) * 0.02);
    }
    if (finalHum < 50) {
      baseWaterPerM2 *= (1 + (50 - finalHum) * 0.005);
    }

    // 株あたりの潅水量
    const waterPerPlant = baseWaterPerM2 / plantDensity;

    // 3. NPK施肥量計算（灌水中の養分濃度規定: N 150ppm, P2O5 40ppm, K2O 200ppm 想定）
    const nRatio = 0.15; // g/L
    const pRatio = 0.04; // g/L
    const kRatio = 0.20; // g/L

    const nPerPlant = waterPerPlant * nRatio;
    const pPerPlant = waterPerPlant * pRatio;
    const kPerPlant = waterPerPlant * kRatio;

    // --- 画面描画 ---
    document.getElementById('resSolar').innerText = solarRadiationSum.toFixed(2);
    document.getElementById('resTemp').innerText = finalTemp.toFixed(1);
    document.getElementById('sourceTemp').innerText = sourceTemp;
    document.getElementById('resHum').innerText = finalHum.toFixed(1);
    document.getElementById('sourceHum').innerText = sourceHum;
    document.getElementById('resLAI').innerText = lai.toFixed(1);

    document.getElementById('resWaterM2').innerText = baseWaterPerM2.toFixed(2);
    document.getElementById('resWaterPlant').innerText = waterPerPlant.toFixed(2);

    document.getElementById('resN').innerText = nPerPlant.toFixed(2);
    document.getElementById('resP').innerText = pPerPlant.toFixed(2);
    document.getElementById('resK').innerText = kPerPlant.toFixed(2);

    document.getElementById('output').style.display = 'block';

  } catch (err) {
    alert('エラーが発生しました: ' + err.message);
  }
}
