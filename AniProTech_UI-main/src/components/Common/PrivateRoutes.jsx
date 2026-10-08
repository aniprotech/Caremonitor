import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { _post } from "../../utils/ApiService";
import { showError } from "../../utils/toaster";
import { toast } from "sonner";
import DotLoader from "../Loader/DotLoader";
import useAuthStore from "../../stores/authStore";
import { encryptData } from "../../utils/cryptoHelpers";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const ProtectedRoute = ({ children }) => {
    const [isAuth, setIsAuth] = useState(null);
    useEffect(() => {
        const token = localStorage.getItem("access_token");
        const handleValidateToken = async () => {
            if (!token) {
                setIsAuth(false);
                return;
            }

            try {
                const response = await _post("/api/auth/validate-token");

                if (response?.data?.error === false) {
                    const renewedToken = response?.data?.results?.data?.token;
                    if (renewedToken) localStorage.setItem("access_token", encryptData(renewedToken));
                    setIsAuth(true);
                } else {
                    localStorage.clear();
                    setIsAuth(false);
                }
            } catch (error) {
                console.error("Token validation failed:", error);
                localStorage.clear();
                setIsAuth(false);
                showError(error?.response?.data?.message || "Network Error, please try again later.");
                toast.dismiss();
            }
        };

        handleValidateToken();
        let ending = false;
        const endSession = async (message) => {
            if (ending) return;
            ending = true;
            try { await _post("/api/auth/logout"); } catch { /* the local session must still end */ }
            localStorage.removeItem("access_token");
            localStorage.removeItem("userInfo");
            useAuthStore.getState().setUserData(null);
            setIsAuth(false);
            showError(message);
        };
        const refresh = async () => {
            try {
                const response = await _post("/api/auth/validate-token");
                const renewedToken = response?.data?.results?.data?.token;
                if (renewedToken) localStorage.setItem("access_token", encryptData(renewedToken));
                // Renew the session in the background only.  Never remount the
                // application here: a remount clears in-progress form state.
            } catch {
                await endSession("Your session is no longer available. Please sign in again.");
            }
        };
        const heartbeat = window.setInterval(refresh, REFRESH_INTERVAL_MS);
        const handleVisibility = () => {
            if (document.visibilityState === "visible") void refresh();
        };
        const handleStorage = (event) => {
            if (event.key === "access_token" && !event.newValue) {
                useAuthStore.getState().setUserData(null);
                setIsAuth(false);
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("storage", handleStorage);
        return () => {
            window.clearInterval(heartbeat);
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("storage", handleStorage);
        };
    }, []);

    if (isAuth === null) {
        return (
            <div>
                {" "}
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100/20">
                    <div className="flex space-x-2">
                        {[0, 1, 2].map((dot) => (
                            <span
                                key={dot}
                                className={`h-4 w-4 rounded-full bg-customNavy animate-bounce`}
                                style={{
                                    animationDelay: `${dot * 0.2}s`,
                                }}
                            ></span>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!isAuth) {
        return (
            <Navigate
                to="/login"
                replace
            />
        );
    }

    return children;
};

export default ProtectedRoute;
