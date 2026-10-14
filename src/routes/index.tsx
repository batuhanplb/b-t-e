import { createFileRoute } from "@tanstack/react-router";
import { serveOriginal } from "@/lib/original-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bütçe — Gelir ve gider takibi" },
      { name: "description", content: "Bütçe — kişisel gelir, gider, hesap ve borç takibi." },
      { property: "og:title", content: "Bütçe — Gelir ve gider takibi" },
      { property: "og:description", content: "Bütçe — kişisel gelir, gider, hesap ve borç takibi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  server: { handlers: { GET: () => serveOriginal() } },
  component: () => null,
});
