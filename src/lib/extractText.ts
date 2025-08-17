// src/lib/extractText.ts
const DBG = process.env.PDF_EXTRACT_DEBUG === "1";

function log(...args: any[]) {
  if (DBG) console.log("[extractText]", ...args);
}

export async function extractText(bytes: Buffer | Uint8Array): Promise<string> {
  // quick sanity: real PDFs start with "%PDF-"
  const head = Buffer.from(bytes).subarray(0, 5).toString();
  if (head !== "%PDF-") {
    log("Not a PDF header:", JSON.stringify(head));
  }

  // 1) try pdf-parse (fastest)
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const { text } = await pdfParse(Buffer.from(bytes));
    const clean = normalize(text || "");
    if (clean) {
      log("pdf-parse OK, len:", clean.length);
      return clean;
    }
  } catch (e) {
    log("pdf-parse error:", e);
  }

  // 2) fallback: pdf2json (more tolerant in Node, no workers)
  try {
    const { default: PDFParser } = await import("pdf2json");
    const parser = new (PDFParser as any)();

    const text = await new Promise<string>((resolve, reject) => {
      let acc = "";
      const onErr = (err: any) => reject(err?.parserError || err);
      const onReady = (pdfData: any) => {
        for (const page of pdfData?.formImage?.Pages || []) {
          for (const block of page.Texts || []) {
            for (const run of block.R || []) {
              // pdf2json encodes text runs as URI components
              const raw = run?.T ?? "";
              let part = "";
              try {
                part = decodeURIComponent(raw);
              } catch {
                // if decoding fails, keep the raw chunk
                part = String(raw);
              }
              acc += part + " ";
            }
          }
          acc += "\n";
        }
        resolve(normalize(acc));
      };

      parser.on("pdfParser_dataError", onErr);
      parser.on("pdfParser_dataReady", onReady);
      parser.parseBuffer(Buffer.from(bytes));
    });

    if (text) {
      log("pdf2json OK, len:", text.length);
      return text;
    }
  } catch (e) {
    log("pdf2json error:", e);
  }

  log("no text extracted");
  return "";
}

/** collapse weird spacing/newlines and trim */
function normalize(s: string): string {
  return s
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
