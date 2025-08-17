import OpenAI from "openai";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { AgreementZ } from "@/lib/schemas";
import { ExtractZ } from "@/lib/extractSchema";
import { addMonths, subDays, format } from "date-fns";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // remove this once debugging is done
  // debugger;

  try {
    // 0) get file
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    // 1) bytes + extract text from PDF
    const bytes = Buffer.from(await file.arrayBuffer());
    // ESM-friendly import path for pdf-parse
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
    const parsed = await pdfParse(bytes).catch(() => ({ text: "" as string }));
    const text = (parsed?.text || "").trim();
    console.log(`Extracted ${text} from ${file.name}`);

    // 2) upload original file to Supabase Storage
    const sb = supabaseAdmin();
    const path = `uploads/${Date.now()}-${file.name}`;
    const { error: upErr } = await sb.storage
      .from(process.env.SUPABASE_BUCKET!)
      .upload(path, bytes, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // 3) call OpenRouter (OpenAI-compatible) to extract fields as JSON
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "BRM Take-Home - Renewal Calendar",
      },
    });

    const model = "openai/gpt-4o";

    const system =
      "You are a contracts extraction assistant. Output ONLY strict JSON that matches the user schema.";

    const user = [
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
      "TEXT:",
      text.slice(0, 180_000),
    ].join("\n");

    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" }, // force JSON
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.1,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    console.log(`OpenRouter response: ${raw}`);

    // 4) validate JSON with your Zod ExtractZ
    const extracted = ExtractZ.parse(JSON.parse(raw));

    // 5) map to DB payload and validate with AgreementZ
    const payload = {
      vendor: extracted.vendor,
      title: extracted.agreementTitle,
      effectiveDate: extracted.effectiveDate,
      termLengthMonths: extracted.termLengthMonths ?? 0,
      endDate: extracted.endDate,
      autoRenews: extracted.autoRenews,
      noticeDays: extracted.noticeDays ?? 0,
      explicitOptOutDate: extracted.explicitOptOutDate,
      renewalFrequencyMonths: extracted.renewalFrequencyMonths ?? 12,
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
    const a = parsedZ.data;

    // 6) derive end date if missing: effective + term - 1 day
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

    // 7) insert agreement
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
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 8) compute key_dates
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

    if (kd.length) {
      await sb.from("key_dates").insert(kd);
    }

    return NextResponse.json({ agreement: inserted });
  } catch (e: any) {
    // surface OpenRouter/OpenAI errors if present
    const msg =
      e?.response?.data?.error?.message ||
      e?.message ||
      "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
