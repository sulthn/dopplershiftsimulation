const graph_canvas = document.getElementById("graph-container");
let width = graph_canvas.clientWidth;
let height = graph_canvas.clientHeight;
const margin = { top: 20, right: 20, bottom: 20, left: 40 };
let innerWidth = width - margin.left - margin.right;
let innerHeight = height - margin.top - margin.bottom;


let xScale = d3.scaleLinear()
    .domain([0, 7])
    .range([0, innerWidth]);

let yScale = d3.scaleLinear()
    .domain([-1.1, 1.1]) // Slightly more than [-1, 1] for visibility
    .range([innerHeight, 0]);

const svg = d3.select("#graph-container")
    .append("svg")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

let line = d3.line()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y));

function generateData(freq) {
    const data = d3.range(-2, 9, 0.01).map(k => {
        const value = Math.sin(freq * k);
        return { x: k, y: value };
    });

    return data;
}

let dd = null;

function drawGraph(freq) {
    const line = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y));

    /*const area = d3.area()
        .x(function(d) { return xScale(d.x); })
        .y0(height)
        .y1(function(d) { return yScale(d.y); });*/

    dd = generateData(freq);
    const svg = d3.select("#graph-container");
    const path = svg.select("path");

    path.datum(dd).attr("d", line);
}

function setupGraph() {
    svg.append("path")
        .datum(generateData(1))
        .attr("d", line);
    drawGraph(4);

    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    svg.append("g")
        .attr("id", "xAxis")
        .attr("transform", `translate(0, ${innerHeight - yScale(0)})`)
        .call(xAxis);

    svg.append("g")
        .attr("id", "yAxis")
        .call(yAxis);
}

function resizeGraph() {
    console.log("rez");
    width = graph_canvas.clientWidth;
    height = graph_canvas.clientHeight;
    innerWidth = width - margin.left - margin.right;
    innerHeight = height - margin.top - margin.bottom;

    const element = d3.select("#graph-container").selectAll("svg");

    element.attr("width", width);
    element.attr("height", height);

    xScale = d3.scaleLinear()
        .domain([0, 7])
        .range([0, innerWidth]);

    yScale = d3.scaleLinear()
        .domain([-1.1, 1.1]) // Slightly more than [-1, 1] for visibility
        .range([innerHeight, 0]);

    const line = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y));

    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    svg.selectAll("#xAxis").call(xAxis).attr("transform", `translate(0, ${innerHeight - yScale(0)})`);
    svg.selectAll("#yAxis").call(yAxis);

    const ddd = d3.select("#graph-container");
    const path = ddd.select("path");

    path.datum(dd).attr("d", line);
}
