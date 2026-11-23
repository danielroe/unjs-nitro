import { threadId } from "node:worker_threads";
import { defineEventHandler } from "h3";

export default defineEventHandler(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return { threadId, id: process.env.NITRO_DEV_WORKER_ID };
});
