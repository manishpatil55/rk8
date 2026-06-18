"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * Accessible replacement for native confirm()/prompt() in the admin queues.
 * Built on <dialog>.showModal() — the platform hands us a focus trap, Escape-to-
 * cancel, backdrop, background inertness, and focus restoration for free, so the
 * a11y floor is correct without a hand-rolled trap. Promise-based: confirm()
 * resolves the entered text on confirm ("" when there's no input) or null on
 * cancel, which maps onto the imperative `if (x === null) return` call sites.
 */

export interface ConfirmInput {
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** red confirm affordance for destructive actions (takedown / ban) */
  danger?: boolean;
  /** show a text field; its trimmed value is what the promise resolves to */
  input?: ConfirmInput;
}

type Pending = ConfirmOptions & { resolve: (value: string | null) => void };

export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  const confirm = useCallback((opts: ConfirmOptions) => {
    setValue("");
    return new Promise<string | null>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  // drive the native dialog open/closed in step with `pending`
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (pending && !d.open) {
      d.showModal();
      // focus the field when prompting, else the confirm button
      requestAnimationFrame(() =>
        (pending.input ? inputRef.current : confirmRef.current)?.focus(),
      );
    } else if (!pending && d.open) {
      d.close();
    }
  }, [pending]);

  const settle = useCallback(
    (result: string | null) => {
      setPending((p) => {
        p?.resolve(result);
        return null;
      });
    },
    [],
  );

  const onConfirm = useCallback(() => {
    if (!pending) return;
    const v = value.trim();
    if (pending.input?.required && !v) {
      inputRef.current?.focus();
      return; // block confirm on an empty required field
    }
    settle(pending.input ? v : "");
  }, [pending, value, settle]);

  const dialog = (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={pending?.body ? bodyId : undefined}
      onCancel={(e) => {
        e.preventDefault(); // Escape: resolve null rather than just closing
        settle(null);
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) settle(null); // backdrop click
      }}
      className="notch-tr m-auto w-[calc(100vw-2rem)] max-w-md border bg-surface p-5 text-text backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {pending && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm();
          }}
          className="flex flex-col gap-3"
        >
          <p id={titleId} className="hud-label text-cp-yellow">
            /// {pending.title}
          </p>
          {pending.body && (
            <p id={bodyId} className="font-mono text-sm text-dim">
              {pending.body}
            </p>
          )}
          {pending.input && (
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={pending.input.placeholder}
              maxLength={pending.input.maxLength ?? 500}
              aria-label={pending.input.placeholder ?? pending.title}
              className="rk8-input w-full"
            />
          )}
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              className="rk8-btn-ghost"
              onClick={() => settle(null)}
            >
              {pending.cancelLabel ?? "cancel"}
            </button>
            <button
              ref={confirmRef}
              type="submit"
              className={
                pending.danger
                  ? "rk8-btn-ghost rk8-btn-danger"
                  : "rk8-btn-primary"
              }
            >
              {pending.confirmLabel ?? "confirm"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );

  return { confirm, dialog };
}
