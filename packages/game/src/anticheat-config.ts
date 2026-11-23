// REDACTED: donnée remplacée car trop risquée à publier (piratage, abus, triche).
// Les noms des réglages sont visibles ; leurs valeurs ne le sont pas.
import { z } from "zod";

/** Seuils anti-triche (section 7). Clé `anticheat` de game_config ; ces valeurs sont les défauts. */
export const antiCheatConfigSchema = z.object({
  min_walk_kmh: z.number().default(0 /* REDACTED */),
  max_walk_kmh: z.number().default(0 /* REDACTED */),
  min_speed_share: z.number().default(0 /* REDACTED */),
  jump_m: z.number().default(0 /* REDACTED */),
  jump_window_s: z.number().default(0 /* REDACTED */),
  max_accuracy_m: z.number().default(0 /* REDACTED */),
  max_gap_s: z.number().default(0 /* REDACTED */),
  cadence_min: z.number().default(0 /* REDACTED */),
  cadence_max: z.number().default(0 /* REDACTED */),
  step_len_min_m: z.number().default(0 /* REDACTED */),
  step_len_max_m: z.number().default(0 /* REDACTED */),
  min_points: z.number().default(0 /* REDACTED */),
  min_valid_seconds: z.number().default(0 /* REDACTED */),
  review_below: z.number().default(0 /* REDACTED */),
  reject_below: z.number().default(0 /* REDACTED */),
  pen_speed: z.number().default(0 /* REDACTED */),
  pen_cadence: z.number().default(0 /* REDACTED */),
  pen_no_steps: z.number().default(0 /* REDACTED */),
  pen_step_len: z.number().default(0 /* REDACTED */),
  pen_perfect: z.number().default(0 /* REDACTED */),
  pen_jumps: z.number().default(0 /* REDACTED */),
  pen_device: z.number().default(0 /* REDACTED */),
});
export type AntiCheatConfig = z.infer<typeof antiCheatConfigSchema>;
