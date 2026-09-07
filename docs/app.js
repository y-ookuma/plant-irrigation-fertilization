import { loadEnv } from "../src/env_loader.js";
import { calcCucumberLAI } from "../src/lai_cucumber.js";
import { calcIrrigationFromEnv } from "../src/irrigation.js";
import { calcNPK } from "../src/fertilization.js";

// 折れ線グラフ
function drawLineGraph(id, data, label) {
  const width = document.getElementById(id).clientWidth;
  const height = 200;
  const svg = d3.select(`#${id}`).attr("width", width).attr("height", height);
  svg.selectAll("*").remove();

  const x = d3.scaleLinear().domain([0, data.length - 1]).range([30, width - 10]);
  const y = d3.scaleLinear().domain([0, d3.max(data)]).range([height - 30, 10]);

  const line = d3.line()
    .x((d, i) => x(i))
    .y(d => y(d));

  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg.append("text")
    .attr("x", 10)
    .attr("y", 15)
    .text(label)
    .attr("font-size", "12px");
}

// NPK複合グラフ
function drawNPKGraph(id, Ndata, Pdata, Kdata) {
  const width = document.getElementById(id).clientWidth;
  const height = 240;
  const svg = d3.select(`#${id}`).attr("width", width).attr("height", height);
  svg.selectAll("*").remove();

  const x = d3.scaleLinear().domain([0, Ndata.length - 1]).range([30, width - 10]);
  const maxY = Math.max(d3.max(Ndata), d3.max(Pdata), d3.max(Kdata));
  const y = d3.scaleLinear().domain([0, maxY]).range([height - 30, 10]);

  const line = d3.line()
    .x((d, i) => x(i))
    .y(d => y(d));

  svg.append("path").datum(Ndata).attr("fill", "none").attr("stroke", "red").attr("stroke-width", 2).attr("d", line);
  svg.append("path").datum(Pdata).attr("fill", "none").attr("stroke", "blue").attr("stroke-width", 2).attr("d", line);
  svg.append("path").datum(Kdata).attr("fill", "none").attr("stroke", "green").attr("stroke-width", 2).attr("d", line);

  svg.append("text").attr("x", 10).attr("y", 15).text("N（窒素）").attr("fill", "red");
  svg.append("text").attr("x", 80).attr("y", 15).text("P（リン酸）").attr("fill", "blue");
  svg.append("text").attr("x", 170).attr("y", 15).text("K（カリ）").attr("fill", "green");
}

// 収量予測グラフ
function drawYieldGraph(id, data, label) {
  const width = document.getElementById(id).clientWidth;
  const height = 200;
  const svg = d3.select(`#${id}`).attr("width", width).attr("height", height);
  svg.selectAll("*").remove();

  const x = d3.scaleLinear().domain([0, data.length - 1]).range([30, width - 10]);
  const y = d3.scaleLinear().domain([0, d3.max(data)]).range([height - 30, 10]);

  const line = d3.line()
    .x((d, i) => x(i))
    .y(d => y(d));

  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "purple")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg.append("text")
    .attr("x", 10)
    .attr("y", 15)
    .text(label)
    .attr("font-size", "12px");
}

// NPKテーブル更新
function updateNPKTable(N, P, K) {
  const tbody = document.querySelector("#npkTable tbody");
  tbody.innerHTML = `
    <tr>
      <td>${N.toFixed(2)}</td>
      <td>${P.toFixed(2)}</td>
      <td>${K.toFixed(2)}</td>
    </tr>
  `;
}

document.getElementById("calcGraph").onclick = async () => {

  const crop = document.getElementById("crop").value;

  const cropFactor = {
    cucumber: 1.0,
    tomato: 0.85,
    pepper: 0.75,
    strawberry: 0.55
  }[crop];

  const env = await loadEnv();
  const leafAges = [10, 15, 20, 25];
  const LAI = calcCucumberLAI(leafAges);

  const temp = parseFloat(document.getElementById("temp").value) || null;
  const rh = parseFloat(document.getElementById("rh").value) || null;
  const plant_density = parseFloat(document.getElementById("density").value);
  const ground_area = parseFloat(document.getElementById("area").value);

  const result = calcIrrigationFromEnv(LAI, env, {
    temp,
    rh,
    plant_density,
    ground_area,
    leaching: 1.1,
    crop_factor: cropFactor
  });

  const fert = calcNPK(result.ET, crop);

  const sw = env.shortwave.slice(0, 24);
  const tArr = env.temp.slice(0, 24);
  const irrArr = Array(24).fill(result.irrigation_per_plant);
  const Ndata = Array(24).fill(fert.N);
  const Pdata = Array(24).fill(fert.P);
  const Kdata = Array(24).fill(fert.K);
  const yieldData = Array(24).fill(fert.Y);

  drawLineGraph("graphSW", sw, "短波放射 (W/m2)");
  drawLineGraph("graphT", tArr, "気温 (℃)");
  drawLineGraph("graphIrr", irrArr, "潅水量 (L/株/day)");
  drawNPKGraph("graphNPK", Ndata, Pdata, Kdata);
  drawYieldGraph("graphYield", yieldData, "収量予測 (kg/株/day)");
  updateNPKTable(fert.N, fert.P, fert.K);

  document.getElementById("output").textContent =
    `作物: ${crop}
LAI: ${LAI.toFixed(2)}
DLI: ${result.DLI.toFixed(1)} mol/m2/day
気温: ${result.T.toFixed(1)} ℃
湿度: ${result.RH.toFixed(1)} %
VPD: ${result.VPD.toFixed(2)} kPa
ET: ${result.ET.toFixed(2)} L/m2/day
潅水量: ${result.irrigation_per_plant.toFixed(2)} L/株/day

--- 収量予測モデル ---
収量推定: ${fert.Y.toFixed(2)} kg/株/day

--- 収量比例施肥 ---
N: ${fert.N.toFixed(2)} g/株/day
P: ${fert.P.toFixed(2)} g/株/day
K: ${fert.K.toFixed(2)} g/株/day`;
};

// CSV保存
document.getElementById("csvBtn").onclick = () => {
  const row = document.querySelector("#npkTable tbody tr");
  if (!row) return;
  const N = row.children[0].textContent;
  const P = row.children[1].textContent;
  const K = row.children[2].textContent;

  const rows = [["N","P","K"], [N, P, K]];
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "npk施肥量.csv";
  a.click();
};

// PNG保存
document.getElementById("pngBtn").onclick = () => {
  const svg = document.getElementById("graphNPK");
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement("canvas");
  canvas.width = svg.clientWidth;
  canvas.height = svg.clientHeight;
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
    const png = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = png;
    a.download = "npk施肥量グラフ.png";
    a.click();
  };
  img.src = "data:image/svg+xml;base64," + btoa(svgData);
};
