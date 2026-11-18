// Gives a <select> the same floating menu as the Progress card's title menu
// (checkmarks, large rows) in place of the phone's own picker. The select
// stays in the page, hidden, and keeps its value, options and events, so the
// page's code reads and sets it as before: picking an item sets the select's
// value and fires "input" and "change" on it.
const SelectMenu = (() => {
  const CHEVRON =
    '<svg class="field-menu-chevron" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>';
  const valueProperty = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  let openMenu = null;

  function enhance(select) {
    const wrapper = UI.el("span", { class: "field-menu" });
    const label = UI.el("span", { class: "field-menu-label" });
    // The trigger goes before the select so the surrounding <label> points at
    // it: tapping the field's name opens the menu too.
    const trigger = UI.el(
      "button",
      { type: "button", class: "field-menu-trigger", "aria-haspopup": "menu", "aria-expanded": "false" },
      label,
    );
    trigger.insertAdjacentHTML("beforeend", CHEVRON);
    const describedBy = select.getAttribute("aria-describedby");
    if (describedBy) {
      trigger.setAttribute("aria-describedby", describedBy);
    }
    const menu = UI.el("div", { class: "title-menu field-menu-list", role: "menu", hidden: true });
    select.replaceWith(wrapper);
    wrapper.append(trigger, select, menu);
    select.classList.add("visually-hidden");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    function refresh() {
      label.textContent = select.selectedOptions[0]?.textContent ?? "";
      trigger.disabled = select.options.length === 0;
    }

    // Page code sets select.value directly, which fires no event, so update
    // the shown text whenever the value is set.
    Object.defineProperty(select, "value", {
      configurable: true,
      get: () => valueProperty.get.call(select),
      set: (value) => {
        valueProperty.set.call(select, value);
        refresh();
      },
    });
    new MutationObserver(refresh).observe(select, { childList: true, subtree: true, attributes: true });

    function close({ returnFocus = false } = {}) {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      if (openMenu === close) {
        openMenu = null;
      }
      if (returnFocus) {
        trigger.focus();
      }
    }

    function open() {
      if (openMenu) {
        openMenu();
      }
      menu.replaceChildren(
        ...[...select.options].map((option, index) =>
          UI.el(
            "button",
            {
              type: "button",
              class: "title-menu-item",
              role: "menuitemradio",
              "aria-checked": String(index === select.selectedIndex),
              "data-index": index,
            },
            UI.el("span", {}, option.textContent),
            UI.el("span", { class: "title-menu-check", "aria-hidden": "true" }, "✓"),
          ),
        ),
      );
      menu.hidden = false;
      menu.style.left = "";
      trigger.setAttribute("aria-expanded", "true");
      openMenu = close;
      // Keep the menu on screen when the field sits on the right of a row.
      const overflow = menu.getBoundingClientRect().right - (document.documentElement.clientWidth - 16);
      if (overflow > 0) {
        menu.style.left = `${-overflow}px`;
      }
      const checked = menu.querySelector('[aria-checked="true"]') || menu.firstElementChild;
      checked?.focus();
      checked?.scrollIntoView({ block: "nearest" });
    }

    function choose(index) {
      if (index !== select.selectedIndex) {
        select.selectedIndex = index;
        refresh();
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      close({ returnFocus: true });
    }

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      if (menu.hidden) {
        open();
      } else {
        close();
      }
    });
    menu.addEventListener("click", (event) => {
      // Keeps the surrounding <label> from passing the tap on to the trigger.
      event.preventDefault();
      const item = event.target.closest(".title-menu-item");
      if (item) {
        choose(Number(item.dataset.index));
      }
    });
    menu.addEventListener("keydown", (event) => {
      const items = [...menu.querySelectorAll(".title-menu-item")];
      const index = items.indexOf(document.activeElement);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        items[(index + step + items.length) % items.length].focus();
      } else if (event.key === "Escape") {
        event.preventDefault();
        close({ returnFocus: true });
      } else if (event.key === "Tab") {
        close();
      }
    });
    document.addEventListener("click", (event) => {
      if (!menu.hidden && !wrapper.contains(event.target)) {
        close();
      }
    });
    // A sheet closed with its menu open shouldn't reopen with the menu showing.
    wrapper.closest("dialog")?.addEventListener("close", () => close());

    refresh();
    return { trigger, menu, open, close, refresh };
  }

  return { enhance };
})();
