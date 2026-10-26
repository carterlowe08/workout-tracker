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

  // ----- "Are you sure?" questions -----
  // The app's own confirmation sheet, used instead of the browser's confirm().
  // Some browsers, including the one in the Claude app and some home-screen
  // apps, block confirm() and silently answer "no", which made buttons like
  // Delete do nothing. ask() resolves to true (confirmed) or false.

  let askSheet = null;
  let answerPending = null;

  function buildAskSheet() {
    const message = el("p", { class: "ask-message", id: "ask-message" });
    const cancelButton = el("button", { type: "button", class: "button-secondary" }, "Cancel");
    const confirmButton = el("button", { type: "button", class: "button" });
    const sheet = el(
      "dialog",
      { class: "sheet ask-sheet", role: "alertdialog", "aria-labelledby": "ask-message" },
      message,
      el("div", { class: "button-row ask-buttons" }, cancelButton, confirmButton),
    );
    cancelButton.addEventListener("click", () => answer(false));
    confirmButton.addEventListener("click", () => answer(true));
    // Escape and the dimmed area outside the sheet count as Cancel.
    sheet.addEventListener("cancel", (event) => {
      event.preventDefault();
      answer(false);
    });
    sheet.addEventListener("click", (event) => {
      if (event.target === sheet) {
        answer(false);
      }
    });
    document.body.append(sheet);
    return { sheet, message, confirmButton, cancelButton };
  }

  function answer(confirmed) {
    askSheet.sheet.close();
    const resolve = answerPending;
    answerPending = null;
    resolve?.(confirmed);
  }

  // ask("Delete this workout?", { confirmLabel: "Delete", danger: true })
  function ask(question, { confirmLabel = "OK", danger = false } = {}) {
    askSheet ||= buildAskSheet();
    if (answerPending) {
      answer(false); // A second question replaces one still open.
    }
    askSheet.message.textContent = question;
    askSheet.confirmButton.textContent = confirmLabel;
    askSheet.confirmButton.classList.toggle("danger", danger);
    askSheet.sheet.showModal();
    // Start on Cancel for risky actions, so a stray Enter doesn't delete anything.
    (danger ? askSheet.cancelButton : askSheet.confirmButton).focus();
    return new Promise((resolve) => {
      answerPending = resolve;
    });
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

  return { el, ask, showToast, showSaveError, formatDate, formatNumber, plural, todayKey };
})();
