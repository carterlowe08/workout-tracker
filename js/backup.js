// Backup and restore: download all app data as a JSON file, and load such a
// file back in (on this browser or another phone) to replace the data here.
(() => {
  const BACKUP_APP = "workout-tracker";
  const BACKUP_VERSION = 1;
  // A running rest countdown only makes sense on the device that started it.
  const SKIPPED_KEYS = ["restTimer"];
  const backupKeys = Object.entries(Store.KEYS).filter(([name]) => !SKIPPED_KEYS.includes(name));

  const downloadButton = document.getElementById("backup-download");
  const restoreInput = document.getElementById("backup-file");
  const status = document.getElementById("backup-status");

  function describe(data) {
    const count = (value) => (Array.isArray(value) ? value.length : Object.keys(value || {}).length);
    return [
      UI.plural(count(data.workouts), "workout"),
      UI.plural(count(data.foodLog), "food"),
      UI.plural(count(data.checkIns), "check-in"),
    ].join(", ");
  }

  // Opened from its home screen icon, where iPhones don't handle downloads well.
  const openedFromIcon = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  function reportSaved(data) {
    status.textContent = `Backup saved (${describe(data)}). Keep the file somewhere safe, like your cloud storage.`;
    UI.showToast("Backup saved");
  }

  // The phone's share sheet, with Save to Files. False when it can't be used.
  async function shareBackup(file, data) {
    if (!openedFromIcon || !navigator.canShare?.({ files: [file] })) {
      return false;
    }
    try {
      await navigator.share({ files: [file] });
      reportSaved(data);
      return true;
    } catch (error) {
      if (error.name !== "AbortError") {
        return false;
      }
      status.textContent = "Backup not saved.";
      return true;
    }
  }

  async function downloadBackup() {
    const data = Object.fromEntries(backupKeys.map(([name, key]) => [name, Store.read(key, null)]));
    const backup = { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
    const file = new File([JSON.stringify(backup, null, 2)], `sisu-backup-${UI.todayKey()}.json`, {
      type: "application/json",
    });
    if (await shareBackup(file, data)) {
      return;
    }
    const link = UI.el("a", {
      href: URL.createObjectURL(file),
      download: file.name,
    });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    reportSaved(data);
  }

  // Returns the backup's data if the file is a backup from this app, otherwise null.
  function parseBackup(text) {
    try {
      const backup = JSON.parse(text);
      const isBackup = backup && backup.app === BACKUP_APP && typeof backup.data === "object" && backup.data;
      return isBackup ? backup : null;
    } catch {
      return null;
    }
  }

  async function restoreBackup() {
    const file = restoreInput.files[0];
    restoreInput.value = "";
    if (!file) {
      return;
    }
    const backup = parseBackup(await file.text());
    if (!backup) {
      status.textContent =
        `"${file.name}" isn't a Sisu backup. Pick the .json file from Download backup.`;
      UI.showToast("That file isn't a backup from this app.", true);
      return;
    }
    const savedOn = new Date(backup.exportedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const question =
      `Replace everything in this browser with the backup from ${savedOn} ` +
      `(${describe(backup.data)})? Data here that isn't in the backup will be lost.`;
    if (!(await UI.ask(question, { confirmLabel: "Restore", danger: true }))) {
      return;
    }
    for (const [name, key] of backupKeys) {
      const value = backup.data[name];
      // Something the backup doesn't have is cleared here, not saved as null.
      const saved = value === undefined || value === null ? Store.remove(key) : Store.write(key, value);
      if (!saved) {
        UI.showSaveError();
        return;
      }
    }
    status.textContent = "Backup restored. Reloading…";
    UI.showToast("Backup restored");
    setTimeout(() => location.reload(), 1200);
  }

  downloadButton.addEventListener("click", downloadBackup);
  restoreInput.addEventListener("change", restoreBackup);
})();
