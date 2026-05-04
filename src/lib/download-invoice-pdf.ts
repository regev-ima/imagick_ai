import { supabase } from "@/integrations/supabase/client";

/**
 * Downloads an invoice as a PDF file directly (no new tab).
 * Fetches the HTML from the download-invoice edge function,
 * renders it off-screen, and converts to PDF via html2pdf.js.
 */
export async function downloadInvoicePdf(
  invoiceId: string,
  invoiceNumber: string,
): Promise<void> {
  // 1. Fetch invoice HTML from edge function
  const { data, error } = await supabase.functions.invoke("download-invoice", {
    body: { invoiceId },
  });

  if (error) throw new Error("Failed to fetch invoice");

  let htmlContent: string;
  if (typeof data === "string") {
    htmlContent = data;
  } else if (data instanceof Blob) {
    htmlContent = await data.text();
  } else if (data && typeof data === "object" && "error" in data) {
    throw new Error((data as { error: string }).error || "Failed to generate invoice");
  } else {
    htmlContent = String(data);
  }

  // 2. Parse HTML and extract styles + body
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");

  // 3. Create off-screen container (794px = A4 width at 96dpi)
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.background = "#ffffff";
  document.body.appendChild(container);

  // Inject styles
  doc.querySelectorAll("style").forEach((style) => {
    container.appendChild(document.adoptNode(style));
  });

  // Inject body content
  const wrapper = document.createElement("div");
  wrapper.innerHTML = doc.body.innerHTML;
  container.appendChild(wrapper);

  // 4. Wait a tick for styles to apply
  await new Promise((r) => setTimeout(r, 100));

  try {
    const html2pdf = (await import("html2pdf.js")).default;

    await html2pdf()
      .set({
        margin: [2, 0, 2, 0],
        filename: `${invoiceNumber}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          width: 794,
          windowWidth: 794,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
      })
      .from(wrapper)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}
