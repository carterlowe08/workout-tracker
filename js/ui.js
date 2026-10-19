// Small helpers for building the page and giving the user feedback.
const UI = (() => {
  let toastTimer;

  // Creates an element. Attributes starting with "on" become event listeners;
  // children may be elements or strings (strings are inserted as plain text).
  function el(tag, attributes = {}, ...children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
      if (name === "class") {
        node.className = value;
      } else if (name.startsWith("on")) {
        node.addEventListener(name.slice(2), value);
      } else if (value === true) {
        node.setAttribute(name, "");
      } else if (value !== false && value !== null && value !== undefined) {
        node.setAttribute(name, value);
      }
    }
    node.append(...children.flat().filter((child) => child !== null && child !== undefined));
    return node;
  }

  // A circular gauge: the colored arc fills `fraction` (0 to 1) of the ring,
  // with a big number in the middle and a label and caption underneath.
  function ring({ fraction, value, unit, label, caption, color, size = "large" }) {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const filled = Math.min(Math.max(fraction, 0), 1);

    const svg = document.createElementNS(svgNamespace, "svg");
    svg.setAttribute("viewBox", "0 0 120 120");
    svg.setAttribute("class", "ring-svg");
    svg.setAttribute("aria-hidden", "true");
    for (const className of ["ring-track", "ring-progress"]) {
      const circle = document.createElementNS(svgNamespace, "circle");
      circle.setAttribute("cx", "60");
      circle.setAttribute("cy", "60");
      circle.setAttribute("r", String(radius));
      circle.setAttribute("class", className);
      svg.append(circle);
    }
    const progress = svg.lastChild;
    progress.style.stroke = color;
    progress.style.color = color;
    progress.style.strokeDasharray = String(circumference);
    progress.style.strokeDashoffset = String(circumference * (1 - filled));
    progress.style.opacity = filled > 0 ? "1" : "0";

    return el(
      "figure",
      { class: `ring ring-${size}`, role: "img", "aria-label": `${label}: ${value} ${unit}. ${caption || ""}` },
      el(
        "div",
        { class: "ring-dial" },
        svg,
        el(
          "div",
          { class: "ring-center" },
          el("span", { class: "ring-value" }, value),
          el("span", { class: "ring-unit" }, unit),
        ),
      ),
      el(
        "figcaption",
        {},
        el("span", { class: "ring-label" }, label),
        caption ? el("span", { class: "ring-caption" }, caption) : null,
      ),
    );
  }

  function showToast(message, isError = false) {
    let toast = document.getElementById("toast");
    if (!toast) {
      toast = el("div", { id: "toast", class: "toast", role: "status" });
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.classList.toggle("toast-error", isError);
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2500);
  }

  function showSaveError() {
    showToast("Couldn't save. Your browser may be blocking storage (private mode?).", true);
  }

  function formatDate(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function formatNumber(number) {
    return number.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }

  // "1 set", "3 sets".
  function plural(count, word) {
    return `${count} ${count === 1 ? word : `${word}s`}`;
  }

  function todayKey() {
    return WorkoutLogic.toDateKey(new Date());
  }

  return { el, ring, showToast, showSaveError, formatDate, formatNumber, plural, todayKey };
})();
