import { useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { accountLinks, navLinks } from "../../constants";
import { useClickOutside } from "../../hooks/use-click-outside";
import useAuthStore from "../../stores/authStore";
import { _get, _post } from "../../utils/ApiService";

const Navbar = () => {
    const { userData, setUserData } = useAuthStore();

    const [toggleMenu, setToggleMenu] = useState(false);
    const [isSticky, setIsSticky] = useState(true);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const profileRef = useRef(null);
    const profileBtnRef = useRef(null);
    useClickOutside([profileRef, profileBtnRef], () => setShowProfileDropdown(false));
    useEffect(() => {
        if (!["ADMIN", "SUPERADMIN"].includes(userData?.user?.role) || userData?.organisation) return;
        _get("/api/account").then(({ data }) => {
            const account = data?.results?.data;
            if (account?.organisation) setUserData({ ...userData, organisation: { name: account.organisation.name, logoPath: account.organisation.logo_path || "" } });
        }).catch(() => {});
    }, [userData?.user?.role]);
    const organisationName = userData?.organisation?.name || "Ani-Tech Elderly Care";

    return (
        <nav
            className={`sticky top-0 z-50 bg-customNavy text-white shadow-md transition-transform duration-300 ${
                isSticky ? "translate-y-0" : "-translate-y-full"
            }`}
        >
            <div className="mx-auto flex items-center justify-between px-2 py-2.5 lg:px-6">
                {/* Left side: Hamburger + Logo + Nav */}
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => setToggleMenu(!toggleMenu)}
                        className="lg:hidden"
                        aria-label="Toggle Menu"
                    >
                        <div className="space-y-1">
                            <span
                                className={`block h-0.5 w-6 transform bg-white transition duration-300 ${toggleMenu ? "translate-y-1.5 rotate-45" : ""}`}
                            />
                            <span className={`block h-0.5 w-6 bg-white transition-opacity duration-300 ${toggleMenu ? "opacity-0" : ""}`} />
                            <span
                                className={`block h-0.5 w-6 transform bg-white transition duration-300 ${toggleMenu ? "-translate-y-1.5 -rotate-45" : ""}`}
                            />
                        </div>
                    </button>

                    {/* Logo */}
                    <Link to="/">
                        <img
                            src={userData?.organisation?.logoPath ? `${(import.meta.env.VITE_APP_BASE_LIVE_URL || "https://backend.aniprotech.com").replace(/\/$/, "")}/${userData.organisation.logoPath.replace(/^\//, "")}` : "/brand-logo.png"}
                            alt={userData?.organisation?.logoPath ? `${organisationName} logo` : "AniProTech"}
                            className="h-10 w-auto max-w-36 object-contain"
                        />
                    </Link>

                    {/* Desktop Nav Links */}
                    <div className="hidden space-x-6 text-sm text-white lg:flex">
                        {navLinks?.map(({ path, label }) =>
                                <Link
                                    key={path}
                                    to={path}
                                    className={`rounded px-2.5 py-2 transition ${
                                        location.pathname.startsWith(path)
                                            ? "bg-customActiveBg text-white"
                                            : "text-white hover:bg-customActiveBg/40"
                                    }`}
                                >
                                    {label}
                                </Link>
                        )}
                        {userData?.user?.isPlatformAdmin && <Link to="/admin/platform" className={`rounded px-2.5 py-2 transition ${location.pathname.startsWith("/admin/platform")?"bg-customActiveBg":"hover:bg-customActiveBg/40"}`}>Platform admin</Link>}
                    </div>
                </div>

                {/* Right Side Info (Visible on all screen sizes) */}
                <div className="flex items-center space-x-4">
                    <div className="relative">
                        <button
                            ref={profileBtnRef}
                            onClick={() => setShowProfileDropdown((prev) => !prev)}
                            className="flex items-center space-x-2 rounded-lg px-3 py-1 transition hover:bg-white/10"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                                {userData?.user?.firstName?.slice(0, 1)}
                            </div>
                            <div className="flex flex-col items-start text-sm leading-tight text-white">
                                <span className="">{userData?.user?.firstName + " " + userData?.user?.lastName}</span>
                                <span className="text-[11px] text-white/70">
                                    {userData?.user?.role && userData.user.role.charAt(0).toUpperCase() + userData.user.role.slice(1).toLowerCase()}
                                </span>
                            </div>
                        </button>
                        
                        {/* Profile Dropdown */}
                        {showProfileDropdown && (
                            <div
                                ref={profileRef}
                                className="absolute right-0 z-50 mt-2 w-72 origin-top-right scale-100 transform rounded-xl border border-customBlue/70 bg-white py-4 text-sm text-gray-800 shadow-xl transition-all duration-200"
                            >
                                <div className="flex flex-col items-center border-b px-4 pb-4 text-center">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-xl text-gray-600">
                                        {userData?.user?.firstName?.slice(0, 1)}
                                    </div>
                                    <div className="mt-2">{userData?.user?.firstName + " " + userData?.user?.lastName}</div>
                                    <div className="text-xs text-gray-500">{userData?.user?.email}</div>
                                    <div className="mt-1 rounded bg-customHoverGrey px-2 py-0.5 text-xs text-gray-700">
                                        {userData?.user?.role &&
                                            userData.user.role.charAt(0).toUpperCase() + userData.user.role.slice(1).toLowerCase()}
                                    </div>
                                </div>

                                <div className="mt-2 max-h-[30vh] space-y-2 overflow-y-auto px-4">
                                    {accountLinks?.map((item) => (
                                        <div
                                            key={item.label}
                                            onClick={() => {
                                                setShowProfileDropdown(false);
                                                navigate(item.to);
                                            }}
                                            className="cursor-pointer rounded px-2 py-2 hover:bg-customHoverGrey"
                                        >
                                            {item.label}
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-3 border-t px-4 pt-3">
                                    <button
                                        className="w-full text-left text-sm font-semibold text-customTextNavy hover:underline"
                                        onClick={async () => {
                                            try {
                                                await _post("/api/auth/logout");
                                            } finally {
                                                localStorage.removeItem("access_token");
                                                useAuthStore.getState().setUserData(null);
                                                localStorage.removeItem("userInfo");
                                                navigate("/login", { replace: true });
                                            }
                                        }}
                                    >
                                        Log out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Dropdown Overlay */}
            <div
                className={`absolute left-0 right-0 top-full z-50 w-full origin-top transform bg-[#011639] px-6 transition-all duration-300 lg:hidden ${
                    toggleMenu ? "scale-y-100 pb-6 pt-4" : "h-0 scale-y-0 overflow-hidden"
                }`}
            >
                {/* Mobile Nav Links */}
                <div className="flex flex-col space-y-2">
                    {userData?.user?.isPlatformAdmin && <Link to="/admin/platform" onClick={()=>setToggleMenu(false)} className="rounded px-2 py-2 text-white transition hover:bg-customBlue/60">Platform admin</Link>}
                    {navLinks.map(({ path, label }) =>
                            <Link
                                key={path}
                                to={path}
                                onClick={() => setToggleMenu(false)}
                                className={`rounded px-2 py-1.5 transition ${
                                    location.pathname.startsWith(path)
                                        ? "bg-customBlue bg-opacity-70 text-white"
                                        : "text-white hover:bg-customBlue/40"
                                }`}
                            >
                                {label}
                            </Link>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
