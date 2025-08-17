declare module "pdf-parse/lib/pdf-parse.js" {
    function pdfParse(
      data: Buffer | Uint8Array,
      options?: any
    ): Promise<{ text: string }>;
    export default pdfParse;
  }
  