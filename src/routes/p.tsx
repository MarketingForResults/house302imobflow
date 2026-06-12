import { createFileRoute } from "@tanstack/react-router";
import { PartnerRegistration } from "./partner-registration";

export const Route = createFileRoute("/p")({
  component: PartnerRegistration,
});
