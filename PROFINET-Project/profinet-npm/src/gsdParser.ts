import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { XMLParser } from "fast-xml-parser";

export type GSDModule = {
  id?: string;
  name?: string;
  slots?: Array<{
    subslot_number?: string;
    input_size?: string;
    output_size?: string;
  }>;
};

export type GSDEntry = {
  filepath: string;
  metadata: Record<string, any>;
  modules: GSDModule[];
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
  const root = json?.GSDML || json;
  const metadata = {
    device_id: root?.ID,
    name: root?.Name,
    vendor: root?.Vendor,
    version: root?.Version,
  };
  const modules = extractModules(root);
  return {
    filepath: file,
    metadata,
    modules,
  };
}

function extractModules(root: any): GSDModule[] {
  const list: GSDModule[] = [];
  const modules = root?.DeviceAccessPointList?.DeviceAccessPointItem?.ModuleList?.ModuleItem;
  if (!modules) return list;
  const array = Array.isArray(modules) ? modules : [modules];
  for (const module of array) {
    const subslots = module?.SubslotList?.SubslotItem;
    const slots = !subslots
      ? []
      : (Array.isArray(subslots) ? subslots : [subslots]).map((item: any) => ({
          subslot_number: item?.SubslotNumber,
          input_size: item?.InputUseableBytes,
          output_size: item?.OutputUseableBytes,
        }));
    list.push({
      id: module?.ID,
      name: module?.Name,
      slots,
    });
  }
  return list;
}
