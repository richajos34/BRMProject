import { z } from "zod";

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

export const AgreementZ = z.object({
  vendor: z.string().min(1),
  title: z.string().min(1),
  effectiveDate: IsoDate,
  termLengthMonths: z.number().int().min(0).default(0),
  endDate: IsoDate,
  autoRenews: z.boolean().default(false),
  noticeDays: z.number().int().min(0).default(0),
  explicitOptOutDate: IsoDate,
  renewalFrequencyMonths: z.number().int().min(0).default(12),
  sourceFileName: z.string(),
  sourceFilePath: z.string(),
  modelName: z.string().optional()
});
export type AgreementInput = z.infer<typeof AgreementZ>;
