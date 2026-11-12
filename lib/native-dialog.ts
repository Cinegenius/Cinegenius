type DialogOptions = {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
};
type PromptOptions = DialogOptions & { minLength: number; maxLength: number; validationMessage: string };

let activeDialog: (() => void) | null = null;

export function dismissNativeDialog() { activeDialog?.(); }

/** Native modal semantics keep background controls inert and focus inside the dialog. */
function showDialog(options: DialogOptions, prompt?: PromptOptions): Promise<string | null> {
  activeDialog?.();
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const dialog = document.createElement("dialog");
    dialog.className = "fixed inset-x-0 bottom-auto top-3 z-[100] mx-auto my-0 flex w-[calc(100%_-_1.5rem)] max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-bg-primary p-0 text-text-primary shadow-2xl backdrop:bg-black/75";
    const form = document.createElement("form");
    form.noValidate = true;
    form.className = "flex min-h-0 flex-col";
    const content = document.createElement("div");
    content.className = "min-h-0 space-y-3 overflow-y-auto overscroll-contain p-4 sm:p-5";
    const title = document.createElement("h2");
    title.id = "native-action-dialog-title";
    title.className = "whitespace-pre-wrap break-words text-base font-semibold [overflow-wrap:anywhere]";
    title.textContent = options.message;
    dialog.setAttribute("aria-labelledby", title.id);
    dialog.setAttribute("aria-modal", "true");
    content.append(title);
    const field = prompt ? document.createElement("textarea") : null;
    const error = document.createElement("p");
    error.id = "native-action-dialog-error";
    error.className = "text-sm text-crimson-light";
    error.setAttribute("role", "alert");
    error.hidden = true;
    if (field && prompt) {
      field.rows = 3;
      field.maxLength = prompt.maxLength;
      field.required = true;
      field.setAttribute("aria-labelledby", title.id);
      field.setAttribute("aria-describedby", error.id);
      field.className = "min-h-24 w-full resize-y rounded-lg border border-border bg-bg-secondary p-3 text-base text-text-primary outline-none focus:border-gold";
      content.append(field, error);
    }
    const actions = document.createElement("div");
    actions.className = "flex shrink-0 flex-wrap justify-end gap-2 border-t border-border p-4";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = options.cancelLabel;
    cancel.className = "min-h-11 rounded-lg border border-border px-4 text-sm text-text-secondary";
    const confirm = document.createElement("button");
    confirm.type = "submit";
    confirm.textContent = options.confirmLabel;
    confirm.className = "min-h-11 rounded-lg bg-gold px-4 text-sm font-semibold text-bg-primary";
    actions.append(cancel, confirm);
    form.append(content, actions);
    dialog.append(form);
    const viewport = window.visualViewport;
    const update = () => {
      dialog.style.top = `max(${(viewport?.offsetTop ?? 0) + 12}px, env(safe-area-inset-top, 0px))`;
      dialog.style.maxHeight = `calc(${Math.max(0, (viewport?.height ?? window.innerHeight) - 24)}px - env(safe-area-inset-bottom, 0px))`;
    };
    let finished = false;
    const finish = (value: string | null) => {
      if (finished) return;
      finished = true;
      if (activeDialog === dismiss) activeDialog = null;
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("popstate", dismiss);
      dialog.close();
      dialog.remove();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      resolve(value);
    };
    const dismiss = () => finish(null);
    activeDialog = dismiss;
    cancel.addEventListener("click", dismiss);
    dialog.addEventListener("cancel", event => { event.preventDefault(); dismiss(); });
    dialog.addEventListener("close", dismiss);
    form.addEventListener("submit", event => {
      event.preventDefault();
      const value = field?.value.trim() ?? "";
      if (prompt && value.length < prompt.minLength) {
        error.textContent = prompt.validationMessage;
        error.hidden = false;
        field?.setAttribute("aria-invalid", "true");
        field?.focus();
        return;
      }
      finish(value);
    });
    document.body.style.overflow = "hidden";
    document.body.append(dialog);
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("popstate", dismiss);
    dialog.showModal();
    // Opening a reason dialog should not cover its context with the software keyboard.
    cancel.focus();
  });
}

export async function confirmDialog(options: DialogOptions): Promise<boolean> {
  return (await showDialog(options)) !== null;
}

export function promptDialog(options: PromptOptions): Promise<string | null> {
  return showDialog(options, options);
}
