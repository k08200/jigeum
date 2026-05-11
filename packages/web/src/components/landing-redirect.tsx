"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getStoredAuthToken } from "../lib/api";

/** If user has a token, redirect to dashboard. Used on landing page. */
export default function LandingRedirect() {
  const router = useRouter();

  useEffect(() => {
    const token = getStoredAuthToken();
    if (token) {
      router.replace("/inbox");
    }
  }, [router]);

  return null;
}
