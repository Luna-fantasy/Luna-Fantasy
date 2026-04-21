export interface R2Object {
  key: string;
  size: number;
  lastModified: string; // serialized from Date by API
  url: string;
}

export interface BrowseResult {
  folders: string[];
  objects: R2Object[];
  truncated: boolean;
}

export interface CanvasElementDef {
  id: string;
  label: string;
  type: 'circle' | 'text' | 'rect';
  props: string[];
  group: string;
}

export interface ColorKeyDef {
  key: string;
  label: string;
  default: string;
}

export interface CanvasTypeDef {
  id: string;
  label: string;
  bot: 'butler' | 'jester';
  width: number;
  height: number;
  backgroundUrl: string;
  elements: CanvasElementDef[];
  defaultLayout: Record<string, any>;
  colorKeys: ColorKeyDef[];
}

export type CanvasLayouts = Record<string, any>;
