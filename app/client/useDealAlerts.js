"use client";

import { useCallback, useEffect, useState } from "react";

// Signs this device up for deal alerts sent while the app is closed.
// status is "checking", "unsupported", "install-first" (iPhone, not added to
// the home screen), "unavailable" (no database or passcode), "blocked"
// (notifications refused), "off" or "on".
export function useDealAlerts() {
  const [status, setStatus] = useState("checking");
  const [publicKey, setPublicKey] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const iPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const installed = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone;
      if (!supported) return setStatus(iPhone && !installed ? "install-first" : "unsupported");
      try {
        const data = await (await fetch("/api/alerts/key", { cache: "no-store" })).json();
        if (cancelled) return;
        if (!data.enabled) return setStatus("unavailable");
        setPublicKey(data.publicKey);
        if (Notification.permission === "denied") return setStatus("blocked");
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) setStatus(subscription ? "on" : "off");
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const turnOn = useCallback(async () => {
    setMessage(null);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setStatus("blocked");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToBytes(publicKey),
      });
      const res = await fetch("/api/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription }),
      });
      if (!res.ok) throw new Error(`sign-up failed (${res.status})`);
      setStatus("on");
    } catch (err) {
      setMessage(`Couldn't turn alerts on: ${err.message}`);
    }
  }, [publicKey]);

  const turnOff = useCallback(async () => {
    setMessage(null);
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetch("/api/alerts/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch(() => {});
      await subscription.unsubscribe();
    }
    setStatus("off");
  }, []);

  const sendTest = useCallback(async () => {
    setMessage(null);
    try {
      const data = await (await fetch("/api/alerts/test", { method: "POST" })).json();
      setMessage(data.ok ? `Test sent to ${data.sent} ${data.sent === 1 ? "device" : "devices"}.` : data.message);
    } catch {
      setMessage("Couldn't send a test alert.");
    }
  }, []);

  return { status, message, turnOn, turnOff, sendTest };
}

// Push keys come as URL-safe base64; the browser wants bytes
function base64ToBytes(value) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}
