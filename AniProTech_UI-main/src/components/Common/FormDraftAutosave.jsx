import { useEffect } from "react";
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

    useEffect(() => {
        if (!enabled || !dirty) return undefined;
        onStatusChange?.("Saving draft…");
        const timer = window.setTimeout(() => {
            onStatusChange?.(saveFormDraft(storageKey, values) ? "Draft saved automatically" : "Draft could not be saved in this browser");
        }, 700);
        return () => window.clearTimeout(timer);
    }, [enabled, dirty, onStatusChange, storageKey, values]);

    return null;
}
