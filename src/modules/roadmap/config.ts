import { z } from "zod";

export const roadmapConfigSchema = z.object({
  ROADMAP_SHIP_SECRET: z.string().optional(),
  ROADMAP_FROM_EMAIL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
});

export type RoadmapConfig = z.infer<typeof roadmapConfigSchema>;
