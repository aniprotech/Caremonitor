// Keep date fields keyboard-first. Native date inputs still expose their calendar
// button, but clicking the field itself must allow a user to type dd/mm/yyyy.
// Time inputs retain the convenient full-field picker behaviour.
export function activateDateTimePickers() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const input = target.closest('input[type="time"], input[type="datetime-local"]');
    if (!(input instanceof HTMLInputElement) || input.disabled || input.readOnly) return;
    try {
      input.showPicker?.();
    } catch {
      // Browser-native picker remains available when showPicker is unsupported.
    }
  });
}
