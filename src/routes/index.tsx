import { createFileRoute } from "@tanstack/react-router";
import { serveOriginal } from "@/lib/original-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bütçe" },
      { name: "description", content: "Bütçe — kişisel gelir, gider, hesap ve borç takibi." },
      { property: "og:title", content: "Bütçe" },
      { property: "og:description", content: "Bütçe — kişisel gelir, gider, hesap ve borç takibi." },
    ],
  }),
  server: { handlers: { GET: () => serveOriginal() } },
  component: () => null,
});
