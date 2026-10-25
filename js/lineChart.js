// A small SVG line chart with a hover/tap tooltip. Points with a null value
// (weeks with nothing logged) are skipped; the line joins the ones around them.
const LineChart = (() => {
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const HEIGHT = 220;
  const MIN_WIDTH = 280;
  const MARGIN = { top: 20, right: 44, bottom: 30, left: 44 };
  const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

  function svgElement(tag, attributes = {}) {
    const node = document.createElementNS(SVG_NAMESPACE, tag);
    for (const [name, value] of Object.entries(attributes)) {
      node.setAttribute(name, String(value));
    }
    return node;
  }

  function textElement(x, y, className, anchor, text) {
    const node = svgElement("text", { x, y, class: className, "text-anchor": anchor });
    node.textContent = text;
    return node;
  }

  // A round step (1, 2, 2.5 or 5 times a power of ten) that splits `range` into about `count` parts.
  function niceStep(range, count) {
    const rough = range / count;
    const power = 10 ** Math.floor(Math.log10(rough));
    const multiple = [1, 2, 2.5, 5, 10].find((option) => option * power >= rough);
    return multiple * power;
  }

  function yTicks(values) {
    let low = Math.min(...values);
    let high = Math.max(...values);
    if (low === high) {
      low -= Math.max(5, low * 0.1);
      high += Math.max(5, high * 0.1);
    }
    const step = niceStep(high - low, 3);
    const start = Math.max(0, Math.floor(low / step) * step);
    const end = Math.ceil(high / step) * step;
    const ticks = [];
    for (let tick = start; tick <= end + step / 2; tick += step) {
      ticks.push(tick);
    }
    return ticks;
  }

  // points: [{ label, longLabel, value }]; formatValue turns a number into display text.
  // The chart is drawn at the container's real width so text stays full size on phones.
  function draw(container, points, formatValue) {
    const WIDTH = Math.max(container.clientWidth, MIN_WIDTH);
    const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
    const values = points.map((point) => point.value).filter((value) => value !== null);
    const ticks = yTicks(values);
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const xFor = (index) => MARGIN.left + (index / Math.max(points.length - 1, 1)) * PLOT_WIDTH;
    const yFor = (value) => MARGIN.top + (1 - (value - yMin) / (yMax - yMin)) * PLOT_HEIGHT;

    const svg = svgElement("svg", {
      viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
      class: "line-chart",
      "aria-hidden": "true",
    });

    for (const tick of ticks) {
      const y = yFor(tick);
      svg.append(
        svgElement("line", { x1: MARGIN.left, x2: WIDTH - MARGIN.right, y1: y, y2: y, class: "chart-grid" }),
        textElement(MARGIN.left - 8, y + 4, "chart-axis", "end", formatValue(tick, { short: true })),
      );
    }

    // Label every few weeks so the dates don't crowd, always including the latest.
    // Short charts label every point; longer ones every few so dates don't overlap.
    let labelEvery = WIDTH < 420 ? 4 : 3;
    if (points.length <= 5) {
      labelEvery = 1;
    }
    points.forEach((point, index) => {
      if ((points.length - 1 - index) % labelEvery === 0) {
        svg.append(textElement(xFor(index), HEIGHT - 8, "chart-axis", "middle", point.label));
      }
    });

    const plotted = points
      .map((point, index) => ({ ...point, x: xFor(index), index }))
      .filter((point) => point.value !== null)
      .map((point) => ({ ...point, y: yFor(point.value) }));

    if (plotted.length > 1) {
      const path = plotted.map((point, i) => `${i === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
      svg.append(svgElement("path", { d: path, class: "chart-line" }));
    }
    for (const point of plotted) {
      svg.append(svgElement("circle", { cx: point.x, cy: point.y, r: 4, class: "chart-dot" }));
    }

    // The latest value, labeled at the end of the line.
    const last = plotted[plotted.length - 1];
    const endText = formatValue(last.value, { short: true });
    svg.append(textElement(last.x + 10, last.y + 4, "chart-end-label", "start", endText));

    // Hover layer: a crosshair and highlighted dot for the nearest week.
    const crosshair = svgElement("line", {
      y1: MARGIN.top,
      y2: MARGIN.top + PLOT_HEIGHT,
      class: "chart-crosshair",
    });
    const focusDot = svgElement("circle", { r: 6, class: "chart-dot chart-focus" });
    crosshair.style.display = "none";
    focusDot.style.display = "none";
    svg.append(crosshair, focusDot);

    const tooltip = UI.el("div", { class: "chart-tooltip", hidden: true });
    const wrapper = UI.el("div", { class: "chart-wrapper" }, svg, tooltip);

    function showPoint(clientX) {
      const box = svg.getBoundingClientRect();
      const svgX = ((clientX - box.left) / box.width) * WIDTH;
      const index = Math.round(((svgX - MARGIN.left) / PLOT_WIDTH) * (points.length - 1));
      const point = points[Math.min(Math.max(index, 0), points.length - 1)];
      const x = xFor(points.indexOf(point));
      crosshair.setAttribute("x1", x);
      crosshair.setAttribute("x2", x);
      crosshair.style.display = "";
      if (point.value === null) {
        focusDot.style.display = "none";
        tooltip.replaceChildren(UI.el("strong", {}, point.longLabel), UI.el("span", {}, "Nothing logged"));
      } else {
        focusDot.setAttribute("cx", x);
        focusDot.setAttribute("cy", yFor(point.value));
        focusDot.style.display = "";
        const valueText = UI.el("span", {}, formatValue(point.value));
        tooltip.replaceChildren(UI.el("strong", {}, point.longLabel), valueText);
      }
      tooltip.hidden = false;
      const left = (x / WIDTH) * box.width;
      tooltip.style.left = `${Math.min(Math.max(left, 70), box.width - 70)}px`;
    }

    function hidePoint() {
      crosshair.style.display = "none";
      focusDot.style.display = "none";
      tooltip.hidden = true;
    }

    svg.addEventListener("pointermove", (event) => showPoint(event.clientX));
    svg.addEventListener("pointerdown", (event) => showPoint(event.clientX));
    svg.addEventListener("pointerleave", hidePoint);

    container.replaceChildren(wrapper);
  }

  return { draw };
})();
