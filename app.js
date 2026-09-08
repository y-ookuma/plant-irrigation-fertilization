function updatePlantDensity() {
  const area = parseFloat(document.getElementById('houseArea').value) || 0;
  const plants = parseFloat(document.getElementById('totalPlantsInput').value) || 0;
  if (area > 0) {
    const density = plants / area;
    document.getElementById('plantDensity').value = density.toFixed(2);
  } else {
    document.getElementById('plantDensity').value = '0.00';
  }
}

function getCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        document.getElementById('lat').value = position.coords.latitude.toFixed(4);
        document.getElementById('lon').value = position.coords.longitude.toFixed(4);
        alert('現在地を取得しました。');
      },
      (error) => {
        alert('位置情報の取得に失敗しました: ' + error.message);
      }
    );
  } else {
    alert('お使いのブラウザは位置情報取得に対応していません。');
  }
}

function exportParamsJSON() {
  const params = {
    lat: document.getElementById('lat').value,
    lon: document.getElementById('lon').value,
    houseArea: document.getElementById('houseArea').value,
    totalPlantsInput: document.getElementById('totalPlantsInput').value,
    plantDensity: document.getElementById('plantDensity').value,
    flowRate: document.getElementById('flowRate').value,
    intervalDays: document.getElementById('intervalDays').value,
    lai: document.getElementById('lai').value,
    fertilizerType: document.getElementById('fertilizerType').value,
    harvestKg: document.getElementById('harvestKg').value,
    manualSolarRad: document.getElementById('manualSolarRad').value,
    temperature: document.getElementById('temperature').value,
    humidity: document.getElementById('humidity').value
  };

  const jsonString = JSON.stringify(params, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", url);
  dlAnchorElem.setAttribute("download", "cucumber_params.json");
  document.body.appendChild(dlAnchorElem);
  dlAnchorElem.click();
  
  setTimeout(() => {
    document.body.removeChild(dlAnchorElem);
    URL.revokeObjectURL(url);
  }, 1000);
}

function importParamsJSON(event) {
  const fileReader = new FileReader();
  if (event.target.files[0]) {
    fileReader.readAsText(event.target.files[0], "UTF-8");
    fileReader.onload = (e) => {
      try {
        const params = JSON.parse(e.target.result);
        for (const key in params) {
          if (document.getElementById(key)) {
            document.getElementById(key).value = params[key];
          }
        }
        updatePlantDensity();
        alert('設定をインポートしました。');
      } catch (err) {
        alert('JSONファイルの読み込みに失敗しました。');
      }
    };
  }
}

async function calculateWaterAndFertilizer() {
  const lat = parseFloat(document.getElementById('lat').value);
  const lon = parseFloat(document.getElementById('lon').value);
  const houseArea = parseFloat(document.getElementById('houseArea').value);
  const totalPlants = parseFloat(document.getElementById('totalPlantsInput').value);
  const plantDensity = parseFloat(document.getElementById('plantDensity').value);
  const flowRate = parseFloat(document.getElementById('flowRate').value);
  const intervalDays = parseInt(document.getElementById('intervalDays').value);
  const lai = parseFloat(document.getElementById('lai').value);
  const fertType = document.getElementById('fertilizerType').value;
  const plannedHarvestKg = parseFloat(document.getElementById('harvestKg').value) || 0;

  const manualSolar = parseFloat(document.getElementById('manualSolarRad').value);
  const manualTemp = parseFloat(document.getElementById('temperature').value);
  const manualHum = parseFloat(document.getElementById('humidity').value);

  const startDate = new Date();
  const endDate = new Date();
  if (intervalDays > 1) {
    endDate.setDate(startDate.getDate() + (intervalDays - 1));
  } else {
    endDate.setTime(startDate.getTime());
  }

  const formatDate = (d) => {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}/${mm}/${dd}`;
  };

  const periodDatesStr = `${formatDate(startDate)} 〜 ${formatDate(endDate)}`;
  document.getElementById('summaryPeriodDates').textContent = periodDatesStr;
  document.getElementById('summaryPeriodDays').textContent = intervalDays;
  document.getElementById('summaryModeLabel').textContent = intervalDays > 1 ? "未来予測" : "当日";

  let dailySolars = [];
  let tempSum = 0;
  let humSum = 0;
  let dataSource = "手動入力値";
  let dateList = [];

  for (let i = 0; i < intervalDays; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    dateList.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }

  const useManual = !isNaN(manualSolar) && !isNaN(manualTemp) && !isNaN(manualHum);

  if (useManual) {
    dataSource = "手動指定値";
    for (let i = 0; i < intervalDays; i++) {
      dailySolars.push(manualSolar);
    }
    tempSum = manualTemp * intervalDays;
    humSum = manualHum * intervalDays;
  } else {
    try {
      const sStr = startDate.toISOString().split('T')[0];
      const eStr = endDate.toISOString().split('T')[0];
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=shortwave_radiation_sum,temperature_2m_mean,relative_humidity_2m_mean&timezone=auto&start_date=${sStr}&end_date=${eStr}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data && data.daily && data.daily.shortwave_radiation_sum) {
        dataSource = intervalDays > 1 ? "Open-Meteo未来予測取得 (JST)" : "Open-Meteo当日取得 (JST)";
        const rawSolars = data.daily.shortwave_radiation_sum; 
        const rawTemps = data.daily.temperature_2m_mean;
        const rawHums = data.daily.relative_humidity_2m_mean;

        for (let i = 0; i < intervalDays; i++) {
          let val = rawSolars[i];
          if (val > 100) val = val / 1000;
          if (isNaN(val) || val <= 0) val = 15.0;
          dailySolars.push(val);

          tempSum += (rawTemps[i] !== undefined ? rawTemps[i] : 22.0);
          humSum += (rawHums[i] !== undefined ? rawHums[i] : 70.0);
        }
      } else {
        throw new Error("APIデータなし");
      }
    } catch (e) {
      console.warn("Open-Meteo取得失敗、フォールバック値を使用します:", e);
      dataSource = "標準推計値 (通信失敗時)";
      for (let i = 0; i < intervalDays; i++) {
        dailySolars.push(16.5);
      }
      tempSum = 23.0 * intervalDays;
      humSum = 68.0 * intervalDays;
    }
  }

  const avgTemp = tempSum / intervalDays;
  const avgHum = humSum / intervalDays;
  const totalSolar = dailySolars.reduce((acc, cur) => acc + cur, 0);
  const avgSolar = totalSolar / intervalDays;

  const avgPar = avgSolar * 0.48;
  const totalPar = totalSolar * 0.48;

  const k = 0.7;
  const absorbedRatio = (1 - Math.exp(-k * lai)) * 100;
  const absorbedParTotal = totalPar * (absorbedRatio / 100);

  let baseTranspirationM2 = absorbedParTotal * 0.35;

  let tempFactor = 1.0;
  if (avgTemp > 25) {
    tempFactor += (avgTemp - 25) * 0.03;
  } else if (avgTemp < 18) {
    tempFactor -= (18 - avgTemp) * 0.02;
  }

  let humFactor = 1.0;
  if (avgHum < 60) {
    humFactor += (60 - avgHum) * 0.005;
  } else if (avgHum > 80) {
    humFactor -= (avgHum - 80) * 0.003;
  }

  const transpirationM2 = Math.max(0.5, baseTranspirationM2 * tempFactor * humFactor);
  const totalTranspirationL = transpirationM2 * houseArea;
  const transpirationPlant = transpirationM2 / plantDensity;

  const totalWaterL = totalTranspirationL / 0.85;
  const waterM2 = totalWaterL / houseArea;
  const waterPlant = totalWaterL / totalPlants;
  const requiredMinutes = totalWaterL / flowRate;

  let fertName = "";
  let nRatio = 0, pRatio = 0, kRatio = 0;
  let fertDensityKgL = 1.2;

  if (fertType === 'black') {
    fertName = "トミー液肥ブラック";
    nRatio = 0.10; pRatio = 0.04; kRatio = 0.06;
  } else if (fertType === 'green') {
    fertName = "トミー液肥グリーン";
    nRatio = 0.06; pRatio = 0.08; kRatio = 0.08;
  } else if (fertType === 'okf1') {
    fertName = "OK-F-1";
    nRatio = 0.15; pRatio = 0.08; kRatio = 0.17;
  }

  const solarFertFactor = Math.max(0.8, avgSolar / 14);
  const targetSupplyN = (totalPlants * intervalDays * 0.65 / 1000) * solarFertFactor;
  const totalFertKg = targetSupplyN / nRatio;
  const totalFertL = totalFertKg / fertDensityKgL;
  const dilutionRatio = totalWaterL > 0 && totalFertL > 0 ? Math.round(totalWaterL / totalFertL) : 1000;

  const supplyN = totalFertKg * nRatio;
  const supplyP2O5 = totalFertKg * pRatio;
  const supplyK2O = totalFertKg * kRatio;
  const supplyTotalNutrient = supplyN + supplyP2O5 + supplyK2O;

  const dryMatterKg = plannedHarvestKg * 0.04;
  const outN = dryMatterKg * 0.03;
  const outP2O5 = dryMatterKg * 0.01;
  const outK2O = dryMatterKg * 0.045;
  const outTotalNutrient = outN + outP2O5 + outK2O;

  const nExportRatio = supplyN > 0 ? Math.round((outN / supplyN) * 100) : 0;
  const diffN = supplyN - outN;

  // DOM反映：カード・テーブル・バランス等
  document.getElementById('cardTotalTranspirationL').textContent = Math.round(totalTranspirationL).toLocaleString();
  document.getElementById('cardTranspirationM2').textContent = transpirationM2.toFixed(1);
  document.getElementById('cardTranspirationPlant').textContent = transpirationPlant.toFixed(2);

  document.getElementById('cardTotalWaterL').textContent = Math.round(totalWaterL).toLocaleString();
  document.getElementById('cardWaterM2').textContent = waterM2.toFixed(1);
  document.getElementById('cardWaterPlant').textContent = waterPlant.toFixed(2);
  document.getElementById('cardWaterTime').textContent = `${Math.floor(requiredMinutes)}分 (${(totalWaterL/flowRate).toFixed(1)}分)`;

  document.getElementById('cardFertL').textContent = totalFertL.toFixed(1);
  document.getElementById('cardFertName').textContent = fertName;
  document.getElementById('cardFertKg').textContent = totalFertKg.toFixed(1);
  document.getElementById('cardDilution').textContent = dilutionRatio.toLocaleString();

  document.getElementById('cardDryMatter').textContent = dryMatterKg.toFixed(1);
  document.getElementById('cardHarvestKg').textContent = plannedHarvestKg.toFixed(1);

  // SVGビジュアル（日射・PAR・蒸散・液肥根拠）への反映
  document.getElementById('svgSolarVal').textContent = avgSolar.toFixed(1);
  document.getElementById('svgParVal').textContent = avgPar.toFixed(1);
  document.getElementById('svgLaiVal').textContent = lai.toFixed(1);
  document.getElementById('svgAbsorbedRatio').textContent = Math.round(absorbedRatio);
  document.getElementById('svgTranspirationM2').textContent = transpirationM2.toFixed(2);
  document.getElementById('svgTranspirationTotal').textContent = Math.round(totalTranspirationL).toLocaleString();
  document.getElementById('svgAbsorbedPar').textContent = absorbedParTotal.toFixed(1);
  document.getElementById('svgTranspirationPlant').textContent = transpirationPlant.toFixed(2);

  // 追加した「選択液肥使用量の根拠」の各要素への反映
  document.getElementById('svgFertSolarFactor').textContent = solarFertFactor.toFixed(2);
  document.getElementById('svgFertTargetN').textContent = targetSupplyN.toFixed(2);
  document.getElementById('svgFertNameBadge').textContent = fertName;
  document.getElementById('svgFertResultKg').textContent = totalFertKg.toFixed(1);
  document.getElementById('svgFertResultL').textContent = totalFertL.toFixed(1);

  document.getElementById('balanceFertLabel').textContent = fertName;
  document.getElementById('balSupplyN').textContent = supplyN.toFixed(2);
  document.getElementById('balSupplyP').textContent = supplyP2O5.toFixed(2);
  document.getElementById('balSupplyK').textContent = supplyK2O.toFixed(2);
  document.getElementById('balSupplyTotal').textContent = supplyTotalNutrient.toFixed(2);

  document.getElementById('balHarvestVal').textContent = plannedHarvestKg.toFixed(1);
  document.getElementById('balOutN').textContent = outN.toFixed(2);
  document.getElementById('balOutP').textContent = outP2O5.toFixed(2);
  document.getElementById('balOutK').textContent = outK2O.toFixed(2);
  document.getElementById('balOutTotal').textContent = outTotalNutrient.toFixed(2);

  document.getElementById('balDiffN').textContent = (diffN >= 0 ? "+" : "") + diffN.toFixed(2);
  document.getElementById('nExportRatio').textContent = nExportRatio;

  const maxBarVal = Math.max(supplyN, supplyP2O5, supplyK2O, 0.1);
  document.getElementById('barNVal').textContent = supplyN.toFixed(2);
  document.getElementById('barN').style.width = `${Math.min(100, (supplyN / maxBarVal) * 100)}%`;

  document.getElementById('barPVal').textContent = supplyP2O5.toFixed(2);
  document.getElementById('barP').style.width = `${Math.min(100, (supplyP2O5 / maxBarVal) * 100)}%`;

  document.getElementById('barKVal').textContent = supplyK2O.toFixed(2);
  document.getElementById('barK').style.width = `${Math.min(100, (supplyK2O / maxBarVal) * 100)}%`;

  document.getElementById('resSolar').textContent = avgSolar.toFixed(2);
  
  let solarDetailHtml = "";
  if (intervalDays > 1) {
    solarDetailHtml = `<ul style="margin: 4px 0 0 0; padding-left: 18px; list-style-type: disc;">`;
    dailySolars.forEach((val, idx) => {
      solarDetailHtml += `<li>${dateList[idx]}: <strong>${val.toFixed(2)}</strong> MJ/m² (未来予測)</li>`;
    });
    solarDetailHtml += `</ul>`;
    solarDetailHtml += `<div style="font-weight: bold; margin-top: 4px; border-top: 1px dashed #bbb; padding-top: 2px; color: #1b5e20;">予測期間合計: ${totalSolar.toFixed(2)} MJ/m² (平均: ${avgSolar.toFixed(2)} MJ/m²/日)</div>`;
  } else {
    solarDetailHtml = `<div style="font-size: 0.85em; color: #666; margin-top: 2px;">当日データ (${dateList[0]})</div>`;
  }
  document.getElementById('resSolarDetail').innerHTML = solarDetailHtml;

  document.getElementById('resPAR').textContent = avgPar.toFixed(2);
  document.getElementById('resPARTotal').textContent = totalPar.toFixed(1);
  document.getElementById('resAbsorbedParTotal').textContent = absorbedParTotal.toFixed(1);
  document.getElementById('resTemp').textContent = avgTemp.toFixed(1);
  document.getElementById('sourceTemp').textContent = dataSource;
  document.getElementById('resHum').textContent = avgHum.toFixed(1);
  document.getElementById('resLAI').textContent = lai.toFixed(1);
  document.getElementById('resAbsorbedRatio').textContent = Math.round(absorbedRatio);
  document.getElementById('resArea').textContent = houseArea.toLocaleString();
  document.getElementById('resTotalPlants').textContent = totalPlants.toLocaleString();
  document.getElementById('resDensity').textContent = plantDensity.toFixed(2);
  document.getElementById('resFlowRate').textContent = flowRate.toFixed(1);

  document.getElementById('output').style.display = 'block';
  document.getElementById('output').scrollIntoView({ behavior: 'smooth' });
}

function downloadSummaryPNG() {
  const outputEl = document.getElementById('output');
  html2canvas(outputEl, { scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    link.download = 'cucumber_summary.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

window.onload = function() {
  updatePlantDensity();
};
