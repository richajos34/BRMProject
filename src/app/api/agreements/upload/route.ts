import OpenAI from "openai";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { AgreementZ } from "@/lib/schemas";
import { AgreementExtractionJSONSchema } from "@/lib/openaiSchemas";
import { addMonths, subDays, format } from "date-fns";
import { ExtractZ } from "@/lib/extractSchema";


// use Node runtime for pdf-parse
export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const form = await req.formData();
        const file = form.get("file") as File | null;
        if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

        // 1) read bytes + extract text
        const bytes = Buffer.from(await file.arrayBuffer());
        const pdfParse = (await import("pdf-parse")).default;
        const parsed = await pdfParse(bytes).catch(() => ({ text: "" as string }));
        const text = (parsed?.text || "").trim();

        // 2) upload raw file to Supabase Storage
        const sb = supabaseAdmin();
        const path = `uploads/${Date.now()}-${file.name}`;
        const { error: upErr } = await sb.storage
            .from(process.env.SUPABASE_BUCKET!)
            .upload(path, bytes, { contentType: file.type || "application/pdf", upsert: false });
        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

        // 3) call OpenAI with Structured Outputs
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const model = "gpt-4o-2024-08-06";

        const prompt = [
            "Extract renewal and notice details from this purchase agreement.",
            "Return ONLY JSON that matches the provided JSON Schema.",
            "If unknown, use null for dates and 0/false for numbers/booleans.",
            "",
            "TEXT:",
            text.slice(0, 180000)
        ].join("\n");

        const system = "You are a contracts extraction assistant. Output ONLY JSON that matches the schema.";
        const completion = await client.chat.completions.create({
            model,
            response_format: { type: "json_object" }, // forces JSON
            messages: [
                { role: "system", content: system },
                {
                    role: "user",
                    content: [
                        "Extract renewal and notice details from this purchase agreement.",
                        "If unknown, use null for dates and 0/false where appropriate.",
                        "",
                        "TEXT:",
                        text.slice(0, 180_000)
                    ].join("\n"),
                },
            ],
        });

        // raw JSON string from the model
        const raw = completion.choices[0]?.message?.content ?? "{}";

        // validate + coerce to a typed object
        const extracted = ExtractZ.parse(JSON.parse(raw));

        // now map to your payload as before
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
            return NextResponse.json({ error: "Validation failed", issues: parsedZ.error.issues }, { status: 400 });
        }
        const a = parsedZ.data;

        // derive end date if missing: effective + term - 1 day
        const endISO = a.endDate ?? (
            a.effectiveDate && a.termLengthMonths > 0
                ? format(subDays(addMonths(new Date(a.effectiveDate), a.termLengthMonths), 1), "yyyy-MM-dd")
                : null
        );

        // 5) insert agreement
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
                parse_status: "parsed"
            })
            .select("*")
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // 6) compute key_dates
        const kd: Array<{ kind: string; occurs_on: string; description?: string; agreement_id: string }> = [];
        if (endISO) {
            kd.push({ kind: "TERM_END", occurs_on: endISO, description: "Term ends", agreement_id: inserted.id });
            if (a.autoRenews) {
                kd.push({ kind: "RENEWAL", occurs_on: endISO, description: "Auto-renew", agreement_id: inserted.id });
                if (a.noticeDays > 0) {
                    kd.push({
                        kind: "NOTICE_DEADLINE",
                        occurs_on: format(subDays(new Date(endISO), a.noticeDays), "yyyy-MM-dd"),
                        description: `${a.noticeDays} day notice`,
                        agreement_id: inserted.id
                    });
                }
            }
        }
        if (kd.length) await sb.from("key_dates").insert(kd);

        return NextResponse.json({ agreement: inserted });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Unexpected error" }, { status: 500 });
    }
}
