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

  if (isNaN(plantDensity) || plantDensity <= 0) {
    alert('株数（本/m²）を数値で入力してください');
    return;
  }

  if (isNaN(lai) || lai <= 0) {
    alert('LAI（葉面積指数）を数値で入力してください');
    return;
  }

  try {
    // Open-Meteo API呼び出し (日射量・気温を取得)
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=shortwave_radiation_sum,temperature_2m_mean&timezone=auto`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`API通信エラー (Status: ${response.status})`);
    }

    const data = await response.json();

    if (!data.daily || !data.daily.shortwave_radiation_sum) {
      throw new Error('気象データが見つかりませんでした');
    }

    // 今日の気象データ取得 (1日目)
    const solarRadiationSum = data.daily.shortwave_radiation_sum[0] ?? 15.0; // 取得失敗時はデフォルト15.0
    const fetchedTemp = data.daily.temperature_2m_mean[0] ?? 25.0;            // 取得失敗時はデフォルト25.0
    const fetchedHum = 65.0; // 湿度のフォールバック用標準値 (65%)

    // 入力値優先判定
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

    // 1株あたりの潅水量
    const waterPerPlant = baseWaterPerM2 / plantDensity;

    // 施肥量 (g/株)
    const nPerPlant = waterPerPlant * 0.15;
    const pPerPlant = waterPerPlant * 0.04;
    const kPerPlant = waterPerPlant * 0.20;

    // --- 画面表示 ---
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

    // 結果エリアを表示
    document.getElementById('output').style.display = 'block';

  } catch (err) {
    console.error(err);
    alert('エラーが発生しました: ' + err.message);
  }
}
