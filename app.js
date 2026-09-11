// =========================================================================
// キュウリ 潅水・施肥量計算機 (app.js)
// Copyright (c) 2026 y-ookuma
// Licensed under the BSD 3-Clause License.
// =========================================================================

// 初期化処理
document.addEventListener('DOMContentLoaded', () => {
  updatePlantDensity();
  initializeIrrigationDates();
  autoFetchLocation();
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
 * ページ読み込み時に現在地（ブラウザのGeolocation API）を自動取得し、
 * 内部の緯度経度（非表示項目）に設定するとともに、座標と地名（市区町村・大字まで）を画面に表示する。
 * 入力や取得ボタンは提供せず、常に自動取得のみで完結する。
 */
function autoFetchLocation() {
  const coordsEl = document.getElementById('locationCoords');
  const nameEl = document.getElementById('locationName');

  if (!navigator.geolocation) {
    const lat = document.getElementById('lat').value;
    const lon = document.getElementById('lon').value;
    coordsEl.textContent = `📍 座標: 緯度 ${lat} / 経度 ${lon} (取得非対応・既定値使用)`;
    nameEl.textContent = "地名: お使いのブラウザは位置情報取得に対応していません（既定値: 東京都）";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      document.getElementById('lat').value = lat.toFixed(6);
      document.getElementById('lon').value = lon.toFixed(6);
      coordsEl.textContent = `📍 座標: 緯度 ${lat.toFixed(4)} / 経度 ${lon.toFixed(4)}`;

      // 逆ジオコーディングAPI（Nominatim）を使用して地名（市区町村・大字相当まで）を取得
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1&accept-language=ja`);
        if (response.ok) {
          const data = await response.json();
          const placeName = formatPlaceNameToOaza(data.address);
          nameEl.textContent = `地名: ${placeName || "取得した座標周辺"}`;
        } else {
          nameEl.textContent = "地名: 取得に失敗しました";
        }
      } catch (err) {
        console.warn("逆ジオコーディング取得エラー:", err);
        nameEl.textContent = "地名: 取得エラー";
      }
    },
    (error) => {
      const lat = document.getElementById('lat').value;
      const lon = document.getElementById('lon').value;
      coordsEl.textContent = `📍 座標: 緯度 ${lat} / 経度 ${lon} (取得失敗・既定値使用)`;
      nameEl.textContent = `地名: 位置情報の取得に失敗しました（${error.message}）既定値（東京都）を使用します`;
    }
  );
}

/**
 * Nominatimの住所要素（addressdetails）から「都道府県＋市区町村＋大字（字・字相当）」までの地名を組み立てる。
 * 丁目・番地・道路名・建物名などそれ以降の詳細情報は含めない。
 */
function formatPlaceNameToOaza(address) {
  if (!address) return "";
  const parts = [];
  if (address.state) parts.push(address.state);

  const cityLevel = address.city || address.town || address.village || address.city_district;
  if (cityLevel) parts.push(cityLevel);

  const oazaLevel = address.suburb || address.neighbourhood || address.hamlet || address.quarter;
  if (oazaLevel && oazaLevel !== cityLevel) parts.push(oazaLevel);

  return parts.join('');
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
    irrigationStartDate: document.getElementById('irrigationStartDate').value,
    irrigationEndDate: document.getElementById('irrigationEndDate').value,
    lai: document.getElementById('lai').value,
    fertilizerType: document.getElementById('fertilizerType').value,
    harvestKg: document.getElementById('harvestKg').value,
    manualSolarRad: document.getElementById('manualSolarRad').value
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
      if (data.irrigationStartDate !== undefined) document.getElementById('irrigationStartDate').value = data.irrigationStartDate;
      if (data.irrigationEndDate !== undefined) document.getElementById('irrigationEndDate').value = data.irrigationEndDate;
      if (data.lai !== undefined) document.getElementById('lai').value = data.lai;
      if (data.fertilizerType !== undefined) document.getElementById('fertilizerType').value = data.fertilizerType;
      if (data.harvestKg !== undefined) document.getElementById('harvestKg').value = data.harvestKg;
      if (data.manualSolarRad !== undefined) document.getElementById('manualSolarRad').value = data.manualSolarRad;
      initializeIrrigationDates();

      updatePlantDensity();
      alert("設定パラメータを正常に読み込みました。");
    } catch (err) {
      alert("JSONファイルの解析に失敗しました: " + err.message);
    }
  };
  reader.readAsText(file);
}

/**
 * Open-Meteo APIから指定期間の気象予報・実績データを非同期取得する。
 * PARの直達光・散乱光分離モデル算定のため、日別データ（daily）に加え、
 * 時間別（hourly）の直達日射（direct_radiation）・散乱日射（diffuse_radiation）も取得する。
 * （Open-Meteoの daily パラメータには直達/散乱の分離集計値が存在しないため、
 *   hourly値を日単位で積算してMJ/m²に変換し、分離モデルの入力として利用する）
 */
async function fetchWeatherForecast(lat, lon, startDate, endDate) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=shortwave_radiation_sum,temperature_2m_mean,relative_humidity_2m_mean&hourly=direct_radiation,diffuse_radiation&timezone=Asia/Tokyo&start_date=${startDate}&end_date=${endDate}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("気象データの取得に失敗しました (HTTP Status: " + response.status + ")");
  }
  const data = await response.json();
  return { daily: data.daily, hourly: data.hourly };
}

/**
 * 時間別（hourly, 単位: W/m²）の直達日射・散乱日射データを、日付ごとに積算し
 * MJ/m²/日の値へ変換する。
 * W/m² は1時間分の平均放射照度であるため、1時間分の積算値は「W/m² × 3600秒」で
 * J/m²（=Wh/m²×3600）となり、これを1,000,000で割ることでMJ/m²に変換する。
 */
function aggregateHourlyRadiationToDailyMJ(hourly) {
  const directByDate = {};
  const diffuseByDate = {};
  if (!hourly || !hourly.time || !hourly.direct_radiation || !hourly.diffuse_radiation) {
    return { directByDate, diffuseByDate };
  }
  for (let i = 0; i < hourly.time.length; i++) {
    const dateKey = hourly.time[i].split('T')[0];
    const directVal = hourly.direct_radiation[i];
    const diffuseVal = hourly.diffuse_radiation[i];
    if (!(dateKey in directByDate)) directByDate[dateKey] = 0;
    if (!(dateKey in diffuseByDate)) diffuseByDate[dateKey] = 0;
    if (directVal !== null && directVal !== undefined) directByDate[dateKey] += directVal;
    if (diffuseVal !== null && diffuseVal !== undefined) diffuseByDate[dateKey] += diffuseVal;
  }
  // W/m²(1時間値)の日合計 → MJ/m²/日 に変換 (× 3600 / 1,000,000)
  for (const d in directByDate) directByDate[d] = directByDate[d] * 3600 / 1000000;
  for (const d in diffuseByDate) diffuseByDate[d] = diffuseByDate[d] * 3600 / 1000000;
  return { directByDate, diffuseByDate };
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
    const irrigationStartDate = document.getElementById('irrigationStartDate').value;
    const irrigationEndDate = document.getElementById('irrigationEndDate').value;
    const manualTemperature = document.getElementById('temperature').value;
    const manualHumidity = document.getElementById('humidity').value;
    const lai = parseFloat(document.getElementById('lai').value) || 3.5;
    const fertType = document.getElementById('fertilizerType').value;
    const harvestKg = parseFloat(document.getElementById('harvestKg').value) || 0;

    const manualSolar = document.getElementById('manualSolarRad').value;

    // 潅水期間の検証（開始日・終了日は本日を基準に前後14日間）
    const today = new Date();
    const todayStr = formatDateISO(today);
    const minAllowedDate = addDays(today, -14);
    const maxAllowedDate = addDays(today, 14);

    if (!irrigationStartDate || !irrigationEndDate) {
      throw new Error("潅水期間の開始日と終了日を選択してください。");
    }
    if (irrigationStartDate < formatDateISO(minAllowedDate) || irrigationStartDate > formatDateISO(maxAllowedDate) ||
        irrigationEndDate < formatDateISO(minAllowedDate) || irrigationEndDate > formatDateISO(maxAllowedDate)) {
      throw new Error("開始日・終了日は本日を基準に前後14日間の範囲で選択してください。");
    }
    if (irrigationStartDate > irrigationEndDate) {
      throw new Error("終了日は開始日以降の日付を選択してください。");
    }

    const startDateStr = irrigationStartDate;
    const endDateStr = irrigationEndDate;
    const startObj = parseISODateLocal(startDateStr);
    const endObj = parseISODateLocal(endDateStr);
    const intervalDays = Math.floor((endObj - startObj) / 86400000) + 1;

    let avgSolar = 15.0;
    let avgTemp = 22.0;
    let avgHum = 70.0;
    let sourceTempLabel = "Open-Meteo予測平均";

    // 潅水期間の日付リスト
    const dateList = [];
    for (let i = 0; i < intervalDays; i++) {
      const d = addDays(startObj, i);
      dateList.push(formatDateISO(d));
    }

    let solarDaily = [];
    let tempDaily = [];
    let humDaily = [];
    let directDaily = [];   // 直達日射 (MJ/m²/日、分離モデル用)
    let diffuseDaily = [];  // 散乱日射 (MJ/m²/日、分離モデル用)
    let parModelUsed = "flat"; // "split"(直達43%/散乱57%の分離モデル) or "flat"(簡易係数0.48・フォールバック)

    // 短波放射だけ手動指定できる。平均気温・平均湿度は常にOpen-Meteoから取得する。
    let weatherData = null;
    try {
      weatherData = await fetchWeatherForecast(lat, lon, startDateStr, endDateStr);
      const dailyData = weatherData.daily;

      if (dailyData && dailyData.time && dailyData.time.length > 0) {
        if (manualSolar === "") {
          const rawSolar = dailyData.shortwave_radiation_sum || [];
          const convertSolar = (v) => (v !== null && v > 1000) ? v / 1000000 : v;
          solarDaily = rawSolar.map(v => v !== null ? convertSolar(v) : null);
        }

        tempDaily = (dailyData.temperature_2m_mean || []).map(v => v !== null ? v : null);
        humDaily = (dailyData.relative_humidity_2m_mean || []).map(v => v !== null ? v : null);

        const solars = solarDaily.filter(v => v !== null && v !== undefined);
        const temps = tempDaily.filter(v => v !== null && v !== undefined);
        const hums = humDaily.filter(v => v !== null && v !== undefined);

        if (solars.length > 0) avgSolar = solars.reduce((a, b) => a + b, 0) / solars.length;
        if (temps.length > 0) avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
        if (hums.length > 0) avgHum = hums.reduce((a, b) => a + b, 0) / hums.length;

        // 欠測日は期間平均値で補完
        solarDaily = solarDaily.map(v => v !== null && v !== undefined ? v : avgSolar);
        tempDaily = tempDaily.map(v => v !== null && v !== undefined ? v : avgTemp);
        humDaily = humDaily.map(v => v !== null && v !== undefined ? v : avgHum);

        if (manualSolar !== "") sourceTempLabel = manualSolar && manualTemperature !== '' && manualHumidity !== ''
        ? "短波放射・気温・湿度を手動指定"
        : manualSolar
          ? "短波放射を手動指定・気温/湿度はOpen-Meteo"
          : (manualTemperature !== '' || manualHumidity !== '')
            ? "気温/湿度を手動指定・短波放射はOpen-Meteo"
            : "Open-Meteo" ;

        // APIの返却日付を使用
        if (dailyData.time && dailyData.time.length === dateList.length) {
          for (let i = 0; i < dateList.length; i++) dateList[i] = dailyData.time[i];
        }

        const { directByDate, diffuseByDate } = aggregateHourlyRadiationToDailyMJ(weatherData.hourly);
        directDaily = dateList.map(d => (d in directByDate) ? directByDate[d] : null);
        diffuseDaily = dateList.map(d => (d in diffuseByDate) ? diffuseByDate[d] : null);

        if (directDaily.some(v => v !== null) || diffuseDaily.some(v => v !== null)) {
          parModelUsed = (manualSolar === "") ? "split" : "flat";
        }
      } else {
        throw new Error("気象データが空です");
      }
    } catch (err) {
      console.warn("気象API取得エラーのためデフォルト値を使用します: ", err.message);
      sourceTempLabel = "通信エラー(デフォルト値使用)";
      if (manualSolar === "") solarDaily = dateList.map(() => avgSolar);
      else solarDaily = dateList.map(() => avgSolar);
      tempDaily = dateList.map(() => avgTemp);
      humDaily = dateList.map(() => avgHum);
      directDaily = dateList.map(() => null);
      diffuseDaily = dateList.map(() => null);
      parModelUsed = "flat";
    }

    // 2. PAR（光合成有効放射）および群落受光率の計算
    // 直達日射(43%)・散乱日射(57%)を分離してPARを算出する分離モデルを基本とする。
    // 直達/散乱データが取得できない日（手動入力時・API欠測時）は、簡易係数(Rs×0.48)にフォールバックする。
    const DIRECT_PAR_COEF = 0.43;
    const DIFFUSE_PAR_COEF = 0.57;
    const FLAT_PAR_COEF = 0.48;

    const parDaily = dateList.map((d, i) => {
      const dVal = directDaily[i];
      const fVal = diffuseDaily[i];
      if (dVal !== undefined && dVal !== null && fVal !== undefined && fVal !== null) {
        return dVal * DIRECT_PAR_COEF + fVal * DIFFUSE_PAR_COEF;
      }
      // その日だけ直達/散乱データが無い場合は簡易係数でフォールバック
      return solarDaily[i] * FLAT_PAR_COEF;
    });

    const k = 0.7; // 消光係数
    const absorbedRatio = (1 - Math.exp(-k * lai)) * 100; // 受光率 (%)
    const absorbedParDaily = parDaily.map(v => v * (absorbedRatio / 100));

    // 表示用の期間平均値（1日あたり）
    const parTotal = parDaily.reduce((a, b) => a + b, 0) / parDaily.length;
    const absorbedPar = absorbedParDaily.reduce((a, b) => a + b, 0) / absorbedParDaily.length;

    // 期間（intervalDays日分）の積算値。液肥使用量など他の指標が期間合計で
    // 出力されているのに合わせ、日射・PAR・吸収PARも期間積算で扱う。
    const solarPeriodTotal = solarDaily.reduce((a, b) => a + b, 0);
    const parPeriodTotal = parDaily.reduce((a, b) => a + b, 0);
    const absorbedParPeriodTotal = absorbedParDaily.reduce((a, b) => a + b, 0);

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
    document.getElementById('summaryModeLabel').textContent = `${intervalDays}日分`;
    document.getElementById('summaryPeriodDates').textContent = `${startDateStr} 〜 ${endDateStr}`;
    document.getElementById('summaryPeriodDays').textContent = intervalDays;
    document.getElementById('summaryCreatedDate').textContent = formatDateJapanese(today);

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

    // 日射受光図は、液肥使用量など他の指標と同様に「期間(intervalDays日分)の積算値」で表示する。
    // （日平均値は参考として小さく併記）
    const periodNote = intervalDays > 1 ? `（${intervalDays}日分 積算）` : '（積算）';
    document.getElementById('svgSolarTitle').textContent = `全天日射 (Rs) ${periodNote}`;
    document.getElementById('svgParTitle').textContent = `PAR (光合成有効放射) ${periodNote}`;
    document.getElementById('svgTranspPeriodNote').textContent = ` ${periodNote}`;

    document.getElementById('svgSolarVal').textContent = solarPeriodTotal.toFixed(1);
    document.getElementById('svgSolarAvg').textContent = avgSolar.toFixed(1) + ' MJ/m²/日';
    document.getElementById('svgParVal').textContent = parPeriodTotal.toFixed(1);
    document.getElementById('svgLaiVal').textContent = lai.toFixed(1);
    document.getElementById('svgAbsorbedRatio').textContent = Math.round(absorbedRatio);
    document.getElementById('svgTranspirationM2').textContent = totalTranspirationM2.toFixed(2);
    document.getElementById('svgAbsorbedPar').textContent = absorbedParPeriodTotal.toFixed(1);
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

    // 棒ゲージの幅を実際の数値(N・P・Kの給液量)に基づいて算出する。
    // これまでは数値表示だけ更新され、バーの幅がHTMLに固定値(100%/27%/133%)として
    // ハードコードされたままだったため、数値とグラフが一致していなかった。
    // N・P・Kのうち最大量を100%として、各成分の相対比でバーの長さを決定する。
    const maxSupply = Math.max(supplyN, supplyP, supplyK, 0.0001);
    document.getElementById('barN').style.width = Math.min(100, (supplyN / maxSupply) * 100).toFixed(1) + '%';
    document.getElementById('barP').style.width = Math.min(100, (supplyP / maxSupply) * 100).toFixed(1) + '%';
    document.getElementById('barK').style.width = Math.min(100, (supplyK / maxSupply) * 100).toFixed(1) + '%';

    document.getElementById('resSolar').textContent = avgSolar.toFixed(1);
    document.getElementById('resSolarTotal').textContent = solarPeriodTotal.toFixed(1);
    document.getElementById('resSolarDetail').textContent = `(設定・取得元: ${sourceTempLabel})`;
    document.getElementById('resPAR').textContent = parTotal.toFixed(1);
    document.getElementById('resPARTotal').textContent = parPeriodTotal.toFixed(1);
    document.getElementById('resParModelLabel').textContent = (parModelUsed === "split")
      ? "直達43%/散乱57% 分離モデル"
      : "簡易係数(Rs×0.48)フォールバック（直達/散乱データ欠測時・手動入力時）";

    const directAvgDisplay = directDaily.filter(v => v !== null && v !== undefined);
    const diffuseAvgDisplay = diffuseDaily.filter(v => v !== null && v !== undefined);
    const directAvg = directAvgDisplay.length > 0 ? directAvgDisplay.reduce((a, b) => a + b, 0) / directAvgDisplay.length : 0;
    const diffuseAvg = diffuseAvgDisplay.length > 0 ? diffuseAvgDisplay.reduce((a, b) => a + b, 0) / diffuseAvgDisplay.length : 0;
    document.getElementById('resDirectAvg').textContent = directAvg.toFixed(1);
    document.getElementById('resDiffuseAvg').textContent = diffuseAvg.toFixed(1);
    document.getElementById('resDirectDiffuseDaily').innerHTML = dateList
      .map((d, i) => {
        const dv = directDaily[i], fv = diffuseDaily[i];
        if (dv === null || dv === undefined || fv === null || fv === undefined) {
          return `${formatDateShort(d)}: データ欠測のため簡易係数(0.48)で代替`;
        }
        return `${formatDateShort(d)}: 直達 ${dv.toFixed(1)} / 散乱 ${fv.toFixed(1)} MJ/m²/日`;
      })
      .join('<br>');
    document.getElementById('resAbsorbedParAvg').textContent = absorbedPar.toFixed(1);
    document.getElementById('resAbsorbedParTotal').textContent = absorbedParPeriodTotal.toFixed(1);
    document.getElementById('resTranspAvg').textContent = transpirationM2Daily.toFixed(2);
    document.getElementById('resTranspTotal').textContent = totalTranspirationM2.toFixed(2);
    document.getElementById('resTranspTotalL').textContent = Math.round(totalTranspirationL).toLocaleString();
    document.getElementById('resTemp').textContent = avgTemp.toFixed(1);
    document.getElementById('sourceTemp').textContent = sourceTempLabel;
    document.getElementById('resHum').textContent = avgHum.toFixed(1);

    // 潅水(日分)の日数ぶん、日付ごとの内訳を表示
    document.getElementById('resSolarDaily').innerHTML = dateList
      .map((d, i) => `${formatDateShort(d)}: ${solarDaily[i].toFixed(1)} MJ/m²/日`)
      .join('<br>');

    document.getElementById('resPARDaily').innerHTML = dateList
      .map((d, i) => `${formatDateShort(d)}: ${parDaily[i].toFixed(1)} MJ/m²/日`)
      .join('<br>');

    document.getElementById('resParTotalDaily').innerHTML = dateList
      .map((d, i) => `${formatDateShort(d)}: PAR ${parDaily[i].toFixed(1)} MJ/m² (吸収PAR ${absorbedParDaily[i].toFixed(1)} MJ/m²)`)
      .join('<br>');

    document.getElementById('resTempHumDaily').innerHTML = dateList
      .map((d, i) => `${formatDateShort(d)}: ${tempDaily[i].toFixed(1)} °C / ${humDaily[i].toFixed(1)} %`)
      .join('<br>');
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

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function parseISODateLocal(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateJapanese(date) {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

function initializeIrrigationDates() {
  const startEl = document.getElementById('irrigationStartDate');
  const endEl = document.getElementById('irrigationEndDate');
  if (!startEl || !endEl) return;

  const today = new Date();
  const minDate = formatDateISO(addDays(today, -14));
  const maxDate = formatDateISO(addDays(today, 14));

  startEl.min = minDate;
  startEl.max = maxDate;
  endEl.min = minDate;
  endEl.max = maxDate;

  const currentStart = startEl.value;
  const currentEnd = endEl.value;

  if (!currentStart || currentStart < minDate || currentStart > maxDate) {
    startEl.value = formatDateISO(today);
  }
  if (!currentEnd || currentEnd < minDate || currentEnd > maxDate) {
    endEl.value = formatDateISO(addDays(today, 2));
  }

  const syncEndMin = () => {
    endEl.min = startEl.value || minDate;
    if (endEl.value < endEl.min) endEl.value = endEl.min;
  };
  const syncStartMax = () => {
    startEl.max = endEl.value || maxDate;
    if (startEl.value > startEl.max) startEl.value = startEl.max;
  };

  startEl.onchange = syncEndMin;
  endEl.onchange = syncStartMax;
  syncEndMin();
  syncStartMax();
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

/**
 * "YYYY-MM-DD" 形式の日付文字列を "M/D" 形式の短い表示用文字列に変換する
 */
function formatDateShort(dateStr) {
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
  }
  return dateStr;
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
