import { createServerFn } from "@tanstack/react-start";
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { GazeProvider } from "@/components/gaze";
import { FlockMark } from "@/components/mark";
import appCss from "../styles.css?url";

const APP_NAME = "Flok";

const fetchSessionUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const u = await getSessionUser();
  return u ? { id: u.id, email: u.email } : null;
});

export const Route = createRootRoute({
  beforeLoad: async () => ({ sessionUser: await fetchSessionUser() }),
  notFoundComponent: NotFound,
  head: () => {
    const host = import.meta.env.VITE_PUBLIC_HOSTNAME as string | undefined;
    const ogImage = host ? `https://${host}/og.jpg` : undefined;
    const xBanner = host
      ? `https://og.grok.me/v1/banner.png?host=${encodeURIComponent(host)}&title=${encodeURIComponent(APP_NAME)}&color=0A0B0C`
      : undefined;
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: APP_NAME },
        {
          name: "description",
          content: "The public home for a Grok Bot flock.",
        },
        { name: "apple-mobile-web-app-title", content: APP_NAME },
        { name: "theme-color", content: "#0a0b0d" },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:type", content: "website" },
        { property: "og:title", content: APP_NAME },
        {
          property: "og:description",
          content: "The public home for a Grok Bot flock.",
        },
        ...(ogImage
          ? [
              { property: "og:image", content: ogImage },
              { property: "og:image:width", content: "1200" },
              { property: "og:image:height", content: "630" },
            ]
          : []),
        ...(xBanner
          ? [
              { property: "x:game:image", content: xBanner },
              { property: "x:game:image:width", content: "1200" },
              { property: "x:game:image:height", content: "264" },
            ]
          : []),
      ],
      links: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com" },
        { rel: "preconnect", href: "https://api.fontshare.com" },
        {
          rel: "stylesheet",
          href: "https://api.fontshare.com/v2/css?f[]=clash-grotesk@600,700&display=swap",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap",
        },
        { rel: "stylesheet", href: appCss },
        { rel: "manifest", href: "/__grok/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      ],
    };
  },
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-bg text-fg">
        <PreviewHostBridge />
        <AuthProvider>
          <GazeProvider>
            <Outlet />
          </GazeProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <FlockMark className="size-7" />
      <h1 className="mt-6 text-4xl font-medium">No flock here</h1>
      <p className="mt-3 text-fg-muted">That page is not on Flok.</p>
      <Link
        to="/"
        className="mt-8 inline-flex h-11 w-fit items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-fg no-underline"
      >
        Back to Flok
      </Link>
    </main>
  );
}
