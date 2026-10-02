"use client";

import { http } from "./http";

/** What the "avisos en este dispositivo" switch can show. */
export type PushState = "unsupported" | "unavailable" | "denied" | "off" | "on";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function supported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function applicationServerKey(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function getPushState(): Promise<PushState> {
  if (!supported()) return "unsupported";
  // The service worker only runs in production, and the server needs its keys: otherwise there is nothing to switch on.
  if (!PUBLIC_KEY || !(await registration())) return "unavailable";
  if (Notification.permission === "denied") return "denied";
  const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  return subscription && Notification.permission === "granted" ? "on" : "off";
}

/** Asks for permission and registers this device. Throws a message in Spanish when it cannot. */
export async function enablePush(): Promise<void> {
  if (!supported() || !PUBLIC_KEY) throw new Error("Este dispositivo no admite avisos");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("No diste permiso para mostrar avisos. Puedes activarlo en los ajustes del navegador.");
  const worker = await navigator.serviceWorker.ready;
  const subscription = (await worker.pushManager.getSubscription()) ?? (await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(PUBLIC_KEY) }));
  const { endpoint, keys } = subscription.toJSON();
  await http("/push/subscriptions", { json: { endpoint, keys } });
}

export async function disablePush(): Promise<void> {
  if (!supported()) return;
  const worker = await registration();
  const subscription = worker ? await worker.pushManager.getSubscription() : null;
  if (!subscription) return;
  await http("/push/subscriptions", { method: "DELETE", json: { endpoint: subscription.endpoint } }).catch(() => undefined);
  await subscription.unsubscribe();
}
