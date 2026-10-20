import { useEffect, useRef } from "react";
import { useFormikContext } from "formik";

// Drafts stay in session storage, so a browser refresh in this tab can recover
// work without publishing incomplete clinical information as a final record.
export const readFormDraft = (key) => {
    try {
        const value = sessionStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    } catch {
        return null;
    }
};

export const clearFormDraft = (key) => {
    try { sessionStorage.removeItem(key); } catch { /* storage can be unavailable */ }
};

export const saveFormDraft = (key, values) => {
    try {
        sessionStorage.setItem(key, JSON.stringify({ values, savedAt: new Date().toISOString() }));
        return true;
    } catch {
        return false;
    }
};

export default function FormDraftAutosave({ storageKey, enabled = true, onStatusChange }) {
    const { values, dirty } = useFormikContext();
    const lastSaved = useRef("");

    useEffect(() => {
        if (!enabled || !dirty) return undefined;
        const serialised = JSON.stringify(values);
        // Formik keeps `dirty` true after the first change. Do not repeatedly
        // save or announce an unchanged draft on every parent re-render.
        if (serialised === lastSaved.current) return undefined;
        const timer = window.setTimeout(() => {
            const saved = saveFormDraft(storageKey, values);
            if (saved) lastSaved.current = serialised;
            onStatusChange?.(saved ? "Draft saved" : "Draft could not be saved in this browser");
        }, 700);
        return () => window.clearTimeout(timer);
    }, [enabled, dirty, onStatusChange, storageKey, values]);

    return null;
}
