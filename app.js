import { loadEnv } from "./src/env_loader.js";
import { calcCucumberLAI } from "./src/lai_cucumber.js";
import { calcIrrigationFromEnv } from "./src/irrigation.js";
import { calcNPK } from "./src/fertilization.js";

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
function updateN
