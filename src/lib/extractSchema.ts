import { z } from "zod";

export const ExtractZ = z.object({
  vendor: z.string(),
  agreementTitle: z.string(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  termLengthMonths: z.number().int().nonnegative().default(0),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  autoRenews: z.boolean(),
  noticeDays: z.number().int().nonnegative().default(0),
  explicitOptOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  renewalFrequencyMonths: z.number().int().nonnegative().default(12),
});
export type ExtractOutput = z.infer<typeof ExtractZ>;
