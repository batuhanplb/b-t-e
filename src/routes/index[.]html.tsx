import { createFileRoute } from "@tanstack/react-router";
import { serveOriginal } from "@/lib/original-page";

export const Route = createFileRoute("/index.html")({
  head: () => ({ meta: [
    { title: "Bütçe — Kişisel finans defteri" },
    { name: "description", content: "Bütçe kişisel finans defteri: hesaplarınız, gelirleriniz ve ödemeleriniz." },
    { property: "og:title", content: "Bütçe — Kişisel finans defteri" },
    { property: "og:description", content: "Hesaplarınızı, gelirlerinizi ve ödemelerinizi Bütçe ile takip edin." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  server: { handlers: { GET: () => serveOriginal() } },
});
