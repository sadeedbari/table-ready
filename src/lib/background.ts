import "server-only";
import { after } from "next/server";

/**
 * Keeps the server running until a notification (email or push) that was started has finished. Without this, a serverless
 * function can be frozen the moment the response is sent, and an email that was still being handed over is lost.
 * Outside a request (for example in a script) it simply lets the promise run on its own.
 */
export function bg(task: Promise<unknown>) {
  const safe = task.catch((e) => console.error("[background]", e));
  try {
    after(() => safe);
  } catch {
    void safe;
  }
}
