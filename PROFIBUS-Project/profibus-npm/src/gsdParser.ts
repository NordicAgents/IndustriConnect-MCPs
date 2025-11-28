import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { XMLParser } from "fast-xml-parser";

export type GSDEntry = {
  filepath: string;
  metadata: Record<string, any>;
  io_config: Record<string, any>;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

export function loadGSD(filepath: string, basePath?: string): GSDEntry {
  let file = filepath;
  if (basePath && !file.startsWith("/")) {
    file = resolve(basePath, filepath);
  }
  const xml = readFileSync(file, "utf-8");
  const json = parser.parse(xml);
  const root = json?.GSD || json?.GSDML || json;
  const metadata = {
    manufacturer: root?.Manufacturer,
    type: root?.Type,
    ident_number: root?.IdentNumber,
  };
  const io_config = parseIO(root);
  return { filepath: file, metadata, io_config };
}

function parseIO(root: any) {
  const inputs = normalize(root?.Inputs?.Input);
  const outputs = normalize(root?.Outputs?.Output);
  return {
    input_length: inputs.reduce((sum, item) => sum + Number(item?.Length || 0), 0),
    output_length: outputs.reduce((sum, item) => sum + Number(item?.Length || 0), 0),
  };
}

function normalize<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
