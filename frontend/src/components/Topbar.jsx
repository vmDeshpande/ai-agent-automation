"use client";

import { usePathname } from "next/navigation";
import { BiUser } from "react-icons/bi";

export default function Topbar() {
  const pathname = usePathname();

  const title =
    pathname
      .replace("/dashboard", "")
      .replace("/", "")
      .toUpperCase() || "DASHBOARD";

  return (
    <header className="h-14 px-6 flex items-center justify-between border-b border-base-300 bg-base-100">
      {/* Left: Page title */}
      <h2 className="text-sm font-medium tracking-wide opacity-80">
        {title}
      </h2>

      {/* Right: Profile dropdown */}
      <div className="dropdown dropdown-end">
        <label
          tabIndex={0}
          className="btn btn-ghost btn-sm flex items-center gap-2"
        >
          <BiUser className="text-lg" />
          <span className="hidden sm:inline text-sm">Profile</span>
        </label>

        <ul
          tabIndex={0}
          className="dropdown-content menu p-2 shadow bg-base-200 rounded-box w-44 text-sm"
        >
          <li>
            <a href="/dashboard/profile">My Profile</a>
          </li>
          <li>
            <a href="/dashboard/settings">Settings</a>
          </li>
          <li className="border-t border-base-300 mt-1 pt-1">
            <a
              onClick={() => {
                localStorage.removeItem("token");
                window.location.href = "/login";
              }}
              className="text-error"
            >
              Logout
            </a>
          </li>
        </ul>
      </div>
    </header>
  );
}
