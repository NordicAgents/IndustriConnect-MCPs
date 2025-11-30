declare module "ethernet-ip" {
  export class Controller {
    connected: boolean;
    connect(host: string, slot?: number): Promise<void>;
    connect(host: string, slot: number, options: Record<string, any>): Promise<void>;
    disconnect(): Promise<void>;
    readTag(tag: Tag): Promise<void>;
    writeTag(tag: Tag): Promise<void>;
  }

  export class Tag<T = any> {
    constructor(name: string, program?: string | null, size?: number);
    name: string;
    value: T;
    type: string;
    path: string;
  }
}
