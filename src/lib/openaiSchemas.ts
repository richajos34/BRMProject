export const AgreementExtractionJSONSchema = {
    name: "AgreementExtraction",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        vendor: { type: "string" },
        agreementTitle: { type: "string" },
        effectiveDate: { anyOf: [{type:"string", pattern:"^\\d{4}-\\d{2}-\\d{2}$"}, {type:"null"}] },
        termLengthMonths: { type: "integer", minimum: 0 },
        endDate: { anyOf: [{type:"string", pattern:"^\\d{4}-\\d{2}-\\d{2}$"}, {type:"null"}] },
        autoRenews: { type: "boolean" },
        noticeDays: { type: "integer", minimum: 0 },
        explicitOptOutDate: { anyOf: [{type:"string", pattern:"^\\d{4}-\\d{2}-\\d{2}$"}, {type:"null"}] },
        renewalFrequencyMonths: { type: "integer", minimum: 0 }
      },
      required: ["vendor","agreementTitle","autoRenews","termLengthMonths","noticeDays","renewalFrequencyMonths"]
    },
    strict: true
  } as const;
  