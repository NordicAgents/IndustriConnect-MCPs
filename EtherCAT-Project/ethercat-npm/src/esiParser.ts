import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { XMLParser } from "fast-xml-parser";

export type ESIEntry = {
  filepath: string;
  metadata: Record<string, any>;
  object_dictionary: Array<Record<string, any>>;
  pdos: {
    tx: Array<Record<string, any>>;
    rx: Array<Record<string, any>>;
  };
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

export function loadESI(filepath: string, basePath?: string): ESIEntry {
  let file = filepath;
  if (basePath && !file.startsWith("/")) {
    file = resolve(basePath, filepath);
  }
  const xml = readFileSync(file, "utf-8");
  const json = parser.parse(xml);
  const root = json?.EtherCATInfo || json;
  const metadata = {
    vendor: root?.Vendor?.Name,
    name: root?.Descriptions?.Devices?.Device?.Type,
    revision: root?.Descriptions?.Devices?.Device?.RevisionNo,
  };
  const object_dictionary = parseObjectDictionary(root);
  const pdos = parsePdos(root);
  return { filepath: file, metadata, object_dictionary, pdos };
}

function parseObjectDictionary(root: any): Array<Record<string, any>> {
  const objects = root?.Descriptions?.Devices?.Device?.Dictionary?.Object;
  if (!objects) return [];
  const array = Array.isArray(objects) ? objects : [objects];
  return array.map((obj: any) => ({
    index: obj?.Index,
    name: obj?.Name,
    type: obj?.Type,
    subindexes: normalizeArray(obj?.SubItem).map((sub: any) => ({
      subindex: sub?.SubIndex,
      name: sub?.Name,
      bit_length: sub?.BitLen,
    })),
  }));
}

function parsePdos(root: any) {
  const pdos = { tx: [] as Array<Record<string, any>>, rx: [] as Array<Record<string, any>> };
  const profiles = normalizeArray(root?.Descriptions?.Devices?.Device?.Sm);
  // Fallback: look directly at TxPdo/RxPdo elements
  for (const direction of ["TxPdo", "RxPdo"]) {
    const entries = normalizeArray(root?.Descriptions?.Devices?.Device?.Pdo?.[direction]);
    const mapped = entries.map((pdo: any) => ({
      index: pdo?.Index,
      name: pdo?.Name,
      entries: normalizeArray(pdo?.Entry).map((entry: any) => ({
        index: entry?.Index,
        subindex: entry?.SubIndex,
        bit_length: entry?.BitLen,
        name: entry?.Name,
      })),
    }));
    (direction === "TxPdo" ? pdos.tx : pdos.rx).push(...mapped);
  }
  return pdos;
}

function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
