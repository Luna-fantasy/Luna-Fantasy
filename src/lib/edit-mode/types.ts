export type PendingChange =
  | {
      type: 'translation';
      key: string;
      locale: string;
      value: string;
      original: string;
    }
  | {
      type: 'image';
      id: string;
      source: 'r2' | 'public';
      file: File;
      previewUrl: string;
      dbCollection?: string;
      dbId?: string;
      dbField?: string;
    }
  | {
      type: 'db_field';
      collection: string;
      id: string;
      field: string;
      value: string;
      original: string;
    };

export interface EditModeContextValue {
  editMode: boolean;
  locale: string;
  changes: Map<string, PendingChange>;
  addChange: (key: string, change: PendingChange) => void;
  removeChange: (key: string) => void;
  clearChanges: () => void;
}
