import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { OgCardMarkup } from "@/lib/og-card";
import type { Flock, OgCluster } from "@/lib/types";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

const FONT_SERIF = new URL("./og-fonts/InstrumentSerif-Regular.ttf", import.meta.url);
const FONT_SANS = new URL("./og-fonts/IBMPlexSans-Regular.ttf", import.meta.url);
const FONT_MEDIUM = new URL("./og-fonts/IBMPlexSans-Medium.ttf", import.meta.url);
const WASM_FILE = new URL("./og-fonts/index_bg.wasm", import.meta.url);

const globalRef = globalThis as typeof globalThis & {
  __flokOgWasm__?: Promise<void>;
  __flokFonts__?: Promise<{ serif: ArrayBuffer; sans: ArrayBuffer; sansMedium: ArrayBuffer }>;
};

async function asBuffer(url: URL, fallbacks: string[]): Promise<ArrayBuffer> {
  try {
    const buf = await readFile(fileURLToPath(url));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } catch {
    /* fall through */
  }
  for (const path of fallbacks) {
    try {
      const buf = await readFile(path);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } catch {
      /* try next */
    }
  }
  throw new Error(`Missing asset ${url.pathname}`);
}

function fonts(): Promise<{ serif: ArrayBuffer; sans: ArrayBuffer; sansMedium: ArrayBuffer }> {
  globalRef.__flokFonts__ ??= Promise.all([
    asBuffer(FONT_SERIF, [
      join(here, "og-fonts/InstrumentSerif-Regular.ttf"),
      join(process.cwd(), "public/fonts/InstrumentSerif-Regular.ttf"),
    ]),
    asBuffer(FONT_SANS, [
      join(here, "og-fonts/IBMPlexSans-Regular.ttf"),
      join(process.cwd(), "public/fonts/IBMPlexSans-Regular.ttf"),
    ]),
    asBuffer(FONT_MEDIUM, [
      join(here, "og-fonts/IBMPlexSans-Medium.ttf"),
      join(process.cwd(), "public/fonts/IBMPlexSans-Medium.ttf"),
    ]),
  ]).then(([serif, sans, sansMedium]) => ({ serif, sans, sansMedium }));
  return globalRef.__flokFonts__;
}

function ensureWasm(): Promise<void> {
  globalRef.__flokOgWasm__ ??= (async () => {
    let wasm: Buffer | null = null;
    try {
      wasm = await readFile(fileURLToPath(WASM_FILE));
    } catch {
      try {
        wasm = await readFile(join(here, "og-fonts/index_bg.wasm"));
      } catch {
        const wasmPath = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
        wasm = await readFile(wasmPath);
      }
    }
    await initWasm(wasm);
  })();
  return globalRef.__flokOgWasm__;
}

export async function renderFlockCardPng(input: {
  flock: Flock;
  clusters: OgCluster[];
  nodeCount: number;
  host: string;
}): Promise<Uint8Array> {
  const [fontSet] = await Promise.all([fonts(), ensureWasm()]);
  const svg = await satori(
    OgCardMarkup({
      flock: input.flock,
      clusters: input.clusters,
      nodeCount: input.nodeCount,
      host: input.host,
    }),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Instrument Serif", data: fontSet.serif, weight: 400, style: "normal" },
        { name: "IBM Plex Sans", data: fontSet.sans, weight: 400, style: "normal" },
        { name: "IBM Plex Sans", data: fontSet.sansMedium, weight: 500, style: "normal" },
      ],
    },
  );
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  });
  return resvg.render().asPng();
}
