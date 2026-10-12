import type { SiteEditorDocument } from "@/types/sites";

export interface SiteVariableRow {
  id: string;
  name: string;
  value: string;
}

export interface SiteVariablesFormProps {
  document: SiteEditorDocument;
}
