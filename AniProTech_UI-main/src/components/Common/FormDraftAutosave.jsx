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

export default function FormDraftAutosave({ storageKey, enabled = true, onStatusChange }) {
    const { values, dirty } = useFormikContext();

    useEffect(() => {
        if (!enabled || !dirty) return undefined;
        onStatusChange?.("Saving draft…");
        const timer = window.setTimeout(() => {
            try {
                sessionStorage.setItem(storageKey, JSON.stringify({ values, savedAt: new Date().toISOString() }));
                onStatusChange?.("Draft saved automatically");
            } catch {
                onStatusChange?.("Draft could not be saved in this browser");
            }
        }, 700);
        return () => window.clearTimeout(timer);
    }, [enabled, dirty, onStatusChange, storageKey, values]);

    return null;
}
