import { Navigate } from "react-router-dom";
import PublicHomePage from "../../pages/Public/PublicHomePage";

// Keep the public website available to visitors, but never make a signed-in
// colleague go through its sign-in journey again. ProtectedRoute validates the
// stored session before the workspace is shown and returns invalid sessions to
// /login.
export default function RootLanding() {
    return localStorage.getItem("access_token")
        ? <Navigate to="/admin/dashboard" replace />
        : <PublicHomePage />;
}
