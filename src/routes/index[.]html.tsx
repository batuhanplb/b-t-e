import { createFileRoute } from "@tanstack/react-router";
import { serveOriginal } from "@/lib/original-page";

export const Route = createFileRoute("/index.html")({
  server: { handlers: { GET: () => serveOriginal() } },
});
