import { Rest } from "ably";
import { z } from "zod";

import {
  AblyRealtimeClient,
  NoopRealtimeClient,
  RealtimeClient,
} from "../core/realtime";

export const ablyConfigSchema = z.object({
  ABLY_API_KEY: z.string().optional(),
});

export function createRealtimeClient(config: {
  ABLY_API_KEY?: string;
}): RealtimeClient {
  const key = config.ABLY_API_KEY?.trim();
  if (!key) return new NoopRealtimeClient();
  return new AblyRealtimeClient(new Rest({ key }));
}
