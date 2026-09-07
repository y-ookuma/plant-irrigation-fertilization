<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>キュウリ潅水・施肥計算アプリ</title>
  <style>
    body { font-family: sans-serif; max-width: 650px; margin: 20px auto; padding: 15px; line-height: 1.5; color: #333; }
    .card { border: 1px solid #ccc; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #fafafa; }
    label { display: block; margin-top: 10px; font-weight: bold; }
    input, select { width: 100%; padding: 8px; margin-top: 4px; box-sizing: border-box; }
    input[readonly] { background-color: #e9ecef; color: #495057; cursor: not-allowed; }
    button { background: #28a745; color: white; border: none; padding: 12px; width: 100%; border-radius: 4px; font-size: 16px; cursor: pointer; margin-top: 15px; }
    button:hover { background: #218838; }
    .result { background: #e9f7ef; border-left: 5px solid #28a745; padding: 15px; margin-top: 20px; }
    .note { font-size: 0.85em; color: #666; font-weight: normal; }
    .highlight { font-weight: bold; color: #155724; font-size: 1.1em; border-top: 1px solid #c3e6cb; padding-top: 10px; margin-top: 15px; }
    .harvest-section { background: #eef6fc; border-left: 5px solid #17a2b8; padding: 15px; margin-top: 15px; border-radius: 4px; }
    .info-box { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; margin-top: 20px; font-size: 0.9em; }
    .info-box h4 { margin-top: 0; color: #495057; border-bottom: 2px solid #28a745; padding-bottom: 5px; }
    .info-box ul { padding-left: 20px; margin-bottom: 0; }
  </style>
</head>
<body>

  <h2>キュウリ 潅水・施肥量計算機</h2>

  <div class="card">
    <h3>1. 位置情報設定</h3>
    <label>緯度 (Latitude):
      <input type="number" step="any" id="lat" value="35.6895">
    </label>
    <label>経度 (Longitude):
      <input type="number" step="any" id="lon" value="139.6917">
    </label>
    <button type="button" onclick="getCurrentLocation()">現在地から緯度経度を取得</button>
  </div>

  <div class="card">
    <h3>2. 栽培パラメータ</h3>
    
    <label>ハウス面積 (m²):
      <input type="number" step="1" id="houseArea" value="1000" oninput="updatePlantDensity()" onchange="updatePlantDensity()" required>
    </label>

    <label>総株数 (本):
      <input type="number" step="1" id="totalPlantsInput" value="3000" oninput="updatePlantDensity()" onchange="updatePlantDensity()" required>
    </label>

    <label>株数密度 (本/m²) <span class="note">※自動計算</span>:
      <input type="number" id="plantDensity" value="3.00" readonly>
    </label>

    <label>LAI (葉面積指数 m²/m²) <span class="note">※育苗期: 0.5〜1.0 / 収穫期: 3.0〜4.5</span>:
      <input type="number" step="0.1" id="lai" value="3.5" required>
    </label>

    <label>使用液肥銘柄:
      <select id="fertilizerType">
        <option value="black">トミー液肥ブラック (N:10% - P:4% - K:6%)</option>
        <option value="green">トミー液肥グリーン (N:6% - P:8% - K:8%)</option>
      </select>
    </label>

    <label>本日のハウス全体のコンテナ/収穫量 (kg) <span class="note">※任意入力（乾物NPK計算用）</span>:
      <input type="number" step="0.1" id="harvestKg" placeholder="例: 150">
    </label>
  </div>

  <div class="card">
    <h3>3. 気象パラメータ</h3>

    <label>平均気温 (°C) <span class="note">※未指定時はOpen-Meteoから自動取得</span>:
      <input type="number" step="0.1" id="temperature" placeholder="自動取得">
    </label>

    <label>平均湿度 (%) <span class="note">※未指定時はOpen-Meteoから自動取得</span>:
      <input type="number" step="0.1" id="humidity" placeholder="自動取得">
    </label>
  </div>

  <button type="button" onclick="calculateWaterAndFertilizer()">計算実行</button>

  <div id="output" class="result" style="display:none;">
    <h3>計算結果</h3>
    <p><strong>適用環境データ:</strong></p>
    <ul>
      <li>日射量: <span id="resSolar"></span> MJ/m²</li>
      <li>気温: <span id="resTemp"></span> °C (<span id="sourceTemp"></span>)</li>
      <li>湿度: <span id="resHum"></span> % (<span id="sourceHum"></span>)</li>
      <li>LAI: <span id="resLAI"></span></li>
      <li>総株数: <span id="resTotalPlants"></span> 株</li>
    </ul>

    <p><strong>【単位面積・1株あたり管理量 (1日)】</strong></p>
    <ul>
      <li><strong>必要潅水量:</strong> <span id="resWaterM2"></span> L/m² (<span id="resWaterPlant"></span> L/株)</li>
      <li><strong>1株あたり施肥目安量 (成分量):</strong>
        <ul>
          <li>窒素 (N): <span id="resN"></span> g/株</li>
          <li>リン酸 (P): <span id="resP"></span> g/株</li>
          <li>カリウム (K): <span id="resK"></span> g/株</li>
        </ul>
      </li>
    </ul>

    <p class="highlight"><strong>【ハウス全体での1日合計管理量】</strong></p>
    <ul>
      <li><strong>総潅水量:</strong> <span id="resTotalWaterL"></span> L (<span id="resTotalWaterTon"></span> m³/t)</li>
      <li><strong>総施肥量 (純成分量):</strong>
        <ul>
          <li>窒素 (N): <span id="resTotalN"></span> kg</li>
          <li>リン酸 (P): <span id="resTotalP"></span> kg</li>
          <li>カリウム (K): <span id="resTotalK"></span> kg</li>
        </ul>
      </li>
      <li><strong>選択液肥使用量 (<span id="resFertName"></span>):</strong>
        <ul>
          <li>必要液肥量: <strong style="color: #155724;"><span id="resFertL"></span> L</strong> （約 <span id="resFertKg"></span> kg）</li>
          <li>希釈倍率目安: 約 <span id="resDilution"></span> 倍（潅水量に対して）</li>
        </ul>
      </li>
    </ul>

    <!-- 収穫物乾物NPK持ち出し量計算領域 -->
    <div id="harvestResult" class="harvest-section" style="display:none;">
      <p style="margin-top:0; font-weight:bold; color:#0c5460;">【収穫物からの乾物NPK持ち出し量】</p>
      <ul>
        <li>本日収穫量: <strong><span id="resHarvestKg"></span> kg</strong> （生重）</li>
        <li>推定乾物重: <strong><span id="resDryMatterKg"></span> kg</strong> （乾物率 4.0% 換算）</li>
        <li><strong>果実持ち出し養成分量:</strong>
          <ul>
            <li>窒素 (N): <strong><span id="resHarvestN"></span> kg</strong> (乾物中 3.0%)</li>
            <li>リン酸 (P): <strong><span id="resHarvestP"></span> kg</strong> (乾物中 1.0%)</li>
            <li>カリウム (K): <strong><span id="resHarvestK"></span> kg</strong> (乾物中 4.5%)</li>
          </ul>
        </li>
      </ul>
    </div>

    <!-- 根拠解説インフォメーション -->
    <div class="info-box">
      <h4>💡 計算式の根拠・モデル仕様</h4>
      <ul>
        <li><strong>受光量・蒸散計算（光の吸収モデル）:</strong><br>
          キュウリ群落の葉が光を遮る割合（受光率）を「消光係数 0.7」と「LAI（葉面積指数）」から算出しています。<br>
          <code>受光率 = 1 - (2.718 の -0.7 × LAI 乗)</code><br>
          この受光率に日射量（MJ/m²）を掛け合わせた「作物受け取りエネルギー」に対し、基本蒸散効率として <strong>1 MJ あたり 0.35 L/m²</strong> の水を必要量として計算します。
        </li>
        <li><strong>気象補正（気温と湿度の影響）:</strong><br>
          日平均気温が <strong>25 ℃</strong> を超える場合は、1 ℃ 上がるごとに <strong>2% 増量</strong> します。<br>
          日平均湿度が <strong>50 %</strong> を下回る（空気が乾燥する）場合は、1 % 下がるごとに <strong>0.5% 増量</strong> して乾燥ストレスを補正します。
        </li>
        <li><strong>施肥濃度（窒素基準）:</strong><br>
          養液土耕における標準的な施肥基準（目標窒素濃度 <strong>150 ppm = 0.15 g/L</strong>）を適用し、潅水量に応じた窒素・リン酸・カリの必要純成分量を算出しています。
        </li>
        <li><strong>液肥換算:</strong><br>
          選択した液肥の窒素（N）保証成分量をもとに、目標窒素量を満たすために必要な液肥原液の量（Lおよびkg）を自動計算します（原液の比重は 1.2 g/mL として換算）。
        </li>
        <li><strong>収穫物持ち出しNPK量:</strong><br>
          キュウリ果実の標準乾物率を <strong>4%</strong>（水分 96%）、乾物中の成分含有量を <strong>N: 3.0%、P: 1.0%、K: 4.5%</strong> と定めて果実によるハウス外への養分持ち出し量を試算します。
        </li>
      </ul>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
