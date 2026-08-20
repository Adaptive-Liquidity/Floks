import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/$handle")({
  component: () => <Outlet />,
});
