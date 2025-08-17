// src/lib/pdfText.ts
export async function extractPdfText(bytes: Buffer) {
    // Try v3 ESM entry first; fall back to v4 top-level
    let pdfjs: any;
    try {
      pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs"); // v3 path
    } catch {
      pdfjs = await import("pdfjs-dist"); // v4
    }
  
    // IMPORTANT: run without a worker in Node
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(bytes),
      disableWorker: true,        // <- fixes “fake worker failed”
    });
  
    const pdf = await loadingTask.promise;
  
    let text = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it.str ?? "").join(" ") + "\n\n";
    }
    return text.trim();
  }
  