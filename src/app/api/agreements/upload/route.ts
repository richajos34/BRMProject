import { ExtractZ } from "@/lib/extractSchema";
import { AgreementZ } from "@/lib/schemas";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { addMonths, format, subDays } from "date-fns";
import { NextResponse } from "next/server";


export const runtime = "nodejs";

/**
 * POST /api/agreements/upload
 *
 * Ingests a PDF, stores it in Supabase Storage, invokes OpenRouter for structured
 * field extraction, validates/normalizes the model output, persists an Agreement,
 * and seeds initial key dates (term end, renewal, notice).
 *
 * @param {Request} req - Next.js Request object. Must include header "x-user-id".
 * @returns {Promise<NextResponse>} JSON payload with created agreement or error.
 */
export async function POST(req: Request) {
  try {

    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    // Convert to base64 for model input
    const bytes = Buffer.from(await file.arrayBuffer());
    const base64Pdf = bytes.toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64Pdf}`;
    console.log(`Converted ${file.name} to base64 for OpenRouter processing`);

    const sb = supabaseAdmin();
    const path = `${userId}/uploads/${Date.now()}-${file.name}`;
    const { error: upErr } = await sb.storage
      .from(process.env.SUPABASE_BUCKET!)
      .upload(path, bytes, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    //Call OpenRouter (OpenAI-compatible) to extract contract fields
    const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";
    const openRouterHeaders = {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY!}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "BRM Take-Home - Renewal Calendar",
    };

    const model = "openai/gpt-4o";

    const system =
      "You are a contracts extraction assistant. Output ONLY strict JSON that matches the user schema.";

    const userPrompt = [
      "Extract renewal and notice details from this purchase agreement.",
      "Return ONLY JSON with these fields:",
      "{",
      '  "vendor": string,',
      '  "agreementTitle": string,',
      '  "effectiveDate": string | null,   // yyyy-mm-dd',
      '  "endDate": string | null,        // yyyy-mm-dd',
      '  "termLengthMonths": number | null,',
      '  "autoRenews": boolean,',
      '  "noticeDays": number | null,',
      '  "explicitOptOutDate": string | null, // yyyy-mm-dd',
      '  "renewalFrequencyMonths": number | null',
      "}",
      "If unknown, return null for dates and 0/false for numbers/booleans as appropriate.",
    ].join("\n");

    const openRouterPayload = {
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            {
              type: "file",
              file: {
                filename: file.name,
                file_data: dataUrl
              }
            }
          ]
        },
      ],
      temperature: 0.1,
      plugins: [
        {
          id: 'file-parser',
          pdf: {
            engine: 'native'
          },
        },
      ],
    };

    const response = await fetch(openRouterUrl, {
      method: 'POST',
      headers: openRouterHeaders,
      body: JSON.stringify(openRouterPayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    //Validate model output with ExtractZ; normalize fields for DB
    const completion = await response.json();
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const extracted = ExtractZ.parse(JSON.parse(raw));
    const autoRenews = !!extracted.autoRenews;

    const modelFreq =
      (extracted as any).renewalFrequencyMonths ??
      (extracted as any).renewal_frequency_months;

    // If auto-renew is enabled, default to 12 months when model is silent/invalid.
    let finalRenewalFreq: number | null;
    if (autoRenews) {
      const n = typeof modelFreq === "number" && Number.isFinite(modelFreq) ? modelFreq : null;
      finalRenewalFreq = n && n > 0 ? n : 12;
    } else {
      finalRenewalFreq = null;
    }

    const payload = {
      vendor: extracted.vendor,
      title: extracted.agreementTitle,
      effectiveDate: extracted.effectiveDate,
      termLengthMonths: extracted.termLengthMonths ?? 0,
      endDate: extracted.endDate,
      autoRenews,
      noticeDays: extracted.noticeDays ?? 0,
      explicitOptOutDate: extracted.explicitOptOutDate,
      renewalFrequencyMonths: finalRenewalFreq,
      sourceFileName: file.name,
      sourceFilePath: path,
      modelName: model,
    };

    const parsedZ = AgreementZ.safeParse(payload);
    if (!parsedZ.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsedZ.error.issues },
        { status: 400 }
      );
    }

    //Compute end date if absent (effective + termMonths - 1 day)
    const a = parsedZ.data;
    const endISO =
      a.endDate ??
      (a.effectiveDate && a.termLengthMonths > 0
        ? format(
          subDays(
            addMonths(new Date(a.effectiveDate), a.termLengthMonths),
            1
          ),
          "yyyy-MM-dd"
        )
        : null);

    //Insert Agreement row
    const { data: inserted, error } = await sb
      .from("agreements")
      .insert({
        vendor: a.vendor,
        title: a.title,
        effective_on: a.effectiveDate ?? null,
        end_on: endISO ?? null,
        term_months: a.termLengthMonths,
        auto_renews: a.autoRenews,
        notice_days: a.noticeDays,
        explicit_opt_out_on: a.explicitOptOutDate ?? null,
        renewal_frequency_months: a.renewalFrequencyMonths,
        source_file_name: a.sourceFileName,
        source_file_path: a.sourceFilePath,
        model_name: a.modelName,
        parse_status: "parsed",
        user_id: userId,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const kd: Array<{
      kind: string;
      occurs_on: string;
      description?: string;
      agreement_id: string;
    }> = [];

    if (endISO) {
      kd.push({
        kind: "TERM_END",
        occurs_on: endISO,
        description: "Term ends",
        agreement_id: inserted.id,
      });

      if (a.autoRenews) {
        kd.push({
          kind: "RENEWAL",
          occurs_on: endISO,
          description: "Auto-renew",
          agreement_id: inserted.id,
        });

        if (a.noticeDays > 0) {
          kd.push({
            kind: "NOTICE_DEADLINE",
            occurs_on: format(
              subDays(new Date(endISO), a.noticeDays),
              "yyyy-MM-dd"
            ),
            description: `${a.noticeDays} day notice`,
            agreement_id: inserted.id,
          });
        }
      }
    }


    return NextResponse.json({ agreement: inserted });
  } catch (e: any) {
    const msg =
      e?.response?.data?.error?.message ||
      e?.message ||
      "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
