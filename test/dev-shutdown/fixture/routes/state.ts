import { threadId } from "node:worker_threads";
import { defineEventHandler } from "h3";

export default defineEventHandler(() => ({
  threadId,
  id: process.env.NITRO_DEV_WORKER_ID,
}));
