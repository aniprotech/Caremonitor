import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SwitchComponents from "../../components/SwitchComponent/SwitchComponent";
import Login from "./Login";
import RegisterBusiness from "./RegisterBusiness";
import AuthNotification from "./AuthNotification";
import { _post } from "../../utils/ApiService";
import { showError, showSuccess } from "../../utils/toaster";
import { isNotEmpty } from "../../utils/common";
import { toast } from "sonner";
import { decryptData, encryptData } from "../../utils/cryptoHelpers";
import { waitFor } from "../../utils/debounce";
import DotLoader from "../../components/Loader/DotLoader";
import useAuthStore from "../../stores/authStore";
import SeoMeta from "../../components/Common/SeoMeta";

const AuthIndex = () => {
    const [activeComponent, setActiveComponent] = useState("Login");
    const [mode, setMode] = useState("");
    const [email, setEmail] = useState("");
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(false);
    const [mfa, setMfa] = useState(null);
    const [mfaCode, setMfaCode] = useState("");

    const { setUserData } = useAuthStore();

    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);
    const token = searchParams.get("token");
    const accessToken = localStorage.getItem("access_token");

    useEffect(() => {
        if (!token && isNotEmpty(accessToken)) {
            try {
                const decrypted = decryptData(accessToken);
                if (isNotEmpty(decrypted)) {
                    const from = location.state?.from?.pathname || "/admin/teams";
                    navigate(from, { replace: true });
                }
            } catch (e) {
                navigate("/login", { replace: true });
            }
        }
    }, []);

    const hasRunRef = useRef(null);

    useEffect(() => {
        if (!token || hasRunRef.current === token) return;
        hasRunRef.current = token;

        if (isNotEmpty(token)) {
            setLoading(true);
            localStorage.removeItem("access_token");
            setUserData(null);
            let email, password;
            try {
                const decodedToken = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
                [email, password] = decodedToken.split(":");
                if (!email || !password) throw new Error("Invalid login link");
            } catch {
                setLoading(false);
                showError("Invalid login link. Please request a new link.");
                navigate("/login", { replace: true });
                return;
            }

            const loginFromToken = async () => {
                try {
                    const response = await _post("/api/auth/get-token", {
                        email,
                        password,
                        deviceName: navigator.userAgentData?.platform || navigator.platform || "Web browser",
                    });

                    toast.dismiss();
                    const result = response?.data?.results?.data;
                    if (result?.mfaRequired) {
                        setMfa(result);
                        setLoading(false);
                        return;
                    }
                    const accessToken = result?.accessToken;
                    if (!accessToken || response?.data?.error) {
                        throw new Error("The server did not return a valid session.");
                    }
                    const eData = encryptData(accessToken);
                    localStorage.setItem("access_token", eData);

                    setUserData(response?.data?.results?.data);
                    setData(response?.data?.results?.data);

                    await waitFor(1000);
                    setLoading(false);
                    navigate("/admin/teams", { replace: true });
                } catch (error) {
                    localStorage.removeItem("access_token");
                    setUserData(null);
                    showError(error?.response?.data?.message || error.message || "Unable to sign in. Please request a new link.");
                    setLoading(false);
                    navigate("/login", { replace: true });
                }
            };

            loginFromToken();
        }
    }, [token]);

    const verifyMfa = async (event) => {
        event.preventDefault();
        setLoading(true);
        try {
            const response = await _post("/api/auth/mfa/verify", { challengeToken: mfa.challengeToken, code: mfaCode, deviceName: navigator.userAgentData?.platform || navigator.platform || "Web browser" });
            const result = response?.data?.results?.data;
            if (!result?.accessToken) throw new Error("The server did not return a valid session.");
            localStorage.setItem("access_token", encryptData(result.accessToken));
            setUserData(result);
            setMfa(null);
            navigate("/admin/teams", { replace: true });
        } catch (error) {
            showError(error?.response?.data?.message || "The authentication code was not accepted.");
        } finally { setLoading(false); }
    };

    return (
        <div className="relative">
            <SeoMeta title="Sign in | Caremonitor by Aniprotech" description="Secure sign in for authorised Caremonitor users." path="/login" index={false} />
            <div>{loading ? <DotLoader loading={loading} /> : ""}</div>
            <SwitchComponents active={activeComponent}>
                <Login
                    name="Login"
                    data={data}
                    setData={setData}
                    mode={mode}
                    setMode={setMode}
                    setActiveComponent={setActiveComponent}
                    setEmail={setEmail}
                    email={email}
                />
                <RegisterBusiness
                    name="RegisterBusiness"
                    setActiveComponent={setActiveComponent}
                    setEmail={setEmail}
                />
                <AuthNotification
                    name="AuthNotification"
                    data={data}
                    setData={setData}
                    mode={mode}
                    setMode={setMode}
                    setActiveComponent={setActiveComponent}
                    setEmail={setEmail}
                    email={email}
                />
            </SwitchComponents>
            {mfa && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"><form onSubmit={verifyMfa} className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl"><h2 className="text-2xl font-semibold text-slate-900">Authentication code</h2><p className="mt-2 text-sm text-slate-600">Enter the six-digit code from your authenticator app to finish signing in.</p><input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" value={mfaCode} onChange={(event)=>setMfaCode(event.target.value.replace(/\D/g,""))} className="mt-5 w-full rounded-lg border px-4 py-3 text-center text-2xl tracking-[0.35em]" aria-label="Six-digit authentication code"/><button disabled={loading||mfaCode.length!==6} className="mt-4 w-full rounded-lg bg-customTextNavy px-4 py-3 font-semibold text-white disabled:opacity-50">{loading?"Verifying…":"Verify and sign in"}</button></form></div>}
        </div>
    );
};

export default AuthIndex;
