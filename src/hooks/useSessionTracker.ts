import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

function parseUserAgent(ua: string) {
  let browser = "Unknown";
  let os = "Unknown";
  let deviceType = "desktop";

  if (/iPhone|iPad|iPod/.test(ua)) {
    os = "iOS";
    deviceType = /iPad/.test(ua) ? "tablet" : "mobile";
  } else if (/Android/.test(ua)) {
    os = "Android";
    deviceType = /Mobile/.test(ua) ? "mobile" : "tablet";
  } else if (/Windows/.test(ua)) {
    os = "Windows";
  } else if (/Mac OS X/.test(ua)) {
    os = "macOS";
  } else if (/Linux/.test(ua)) {
    os = "Linux";
  } else if (/CrOS/.test(ua)) {
    os = "ChromeOS";
  }

  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
  else if (/Firefox\//.test(ua)) browser = "Firefox";

  return { browser, os, deviceType };
}

export function useSessionTracker(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    const flag = `session_tracked_${userId}`;
    if (sessionStorage.getItem(flag)) return;
    // Set flag optimistically, remove on error to allow retry
    sessionStorage.setItem(flag, "1");

    const track = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          sessionStorage.removeItem(flag);
          return;
        }

        const ua = navigator.userAgent;
        const { browser, os, deviceType } = parseUserAgent(ua);
        const colorScheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

        await supabase.functions.invoke("track-session", {
          body: {
            device_type: deviceType,
            browser,
            os,
            screen_width: screen.width,
            screen_height: screen.height,
            color_scheme: colorScheme,
            user_agent: ua,
          },
        });
      } catch (err) {
        console.error("Session tracking failed:", err);
        // Remove flag so it can retry next time
        sessionStorage.removeItem(flag);
      }
    };

    track();
  }, [userId]);
}
