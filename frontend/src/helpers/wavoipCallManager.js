import { CallingSound } from "./callingSound";
import WavoipInstance from "wavoip-api";
import config from "../services/config";

function initializeWavoipCallManager() {
  window.wavoipCallingSound = window.wavoipCallingSound || new CallingSound();
  window.wavoipInstances = window.wavoipInstances || {};
}

async function getWavoipInstance(token, disconnect) {
  initializeWavoipCallManager();

  if (!window.wavoipInstances?.[token]?.ready) {
    const wavoipDevice = new WavoipInstance();
    const instance = await wavoipDevice.connect(token);
    window.wavoipInstances[token] = {
      instance,
      disconnect,
      ready: false
    };

    instance.socket.on("signaling", signal => {
      if (signal?.tag === "accept") {
        window.wavoipCallingSound.stop();
      }
      if (["terminate", "reject"].includes(signal?.tag)) {
        window.wavoipInstances[token].disconnect();
      }
    });

    instance.socket.on("disconnect", () => {
      window.wavoipInstances[token].ready = false;
    });

    instance.socket.on("connect", () => {
      window.wavoipInstances[token].ready = true;
    });

    return new Promise(resolve => {
      instance.socket.once("connect", () => {
        resolve(instance);
      });
    });
  }

  window.wavoipInstances[token].disconnect = disconnect;

  return window.wavoipInstances[token].instance;
}

export async function wavoipCall(ticket, disconnect) {
  if (!ticket.whatsapp?.wavoip?.token) {
    throw new Error("Wavoip token is missing in the ticket's WhatsApp data.");
  }

  const wavoipInstance = await getWavoipInstance(
    ticket.whatsapp.wavoip.token,
    disconnect
  );

  wavoipInstance
    .callStart({
      whatsappid: ticket.contact.number
    })
    .then(() => {
      window.wavoipCallingSound.start();
    });

  return wavoipInstance;
}

// Zap Komunick: Wavoip is a third-party service, off unless the installation
// sets WAVOIP_ENABLED=true in the frontend environment (config.json). Calls
// also need the microphone, which browsers only allow on https or localhost.
export function wavoipAvailable() {
  if (String(config.WAVOIP_ENABLED).toLowerCase() !== "true") {
    return false;
  }
  return (
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost"
  );
}
