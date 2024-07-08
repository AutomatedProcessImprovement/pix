import type { File } from "./files";

export type Asset = {
  id: string;
  creation_time: string;
  modification_time?: string;
  deletion_time?: string;
  name: string;
  description?: string;
  type: string;
  project_id: string;
  files_ids: string[];
  users_ids: string[];
  processing_requests_ids?: string[];
  files?: File[];
};

export enum AssetType {
  EVENT_LOG = "event_log",
  PROCESS_MODEL = "process_model",
  SIMULATION_MODEL = "simulation_model",
  SIMOD_CONFIGURATION = "simod_configuration",
  OPTIMOS_CONFIGURATION = "optimos_configuration",
  OPTIMOS_REPORT = "optimos_report",
  ZIP_FILE = "zip_file",
}

export function assetTypeToString(type: AssetType): string {
  switch (type) {
    case AssetType.EVENT_LOG:
      return "Event Log";
    case AssetType.PROCESS_MODEL:
      return "Process Model";
    case AssetType.SIMULATION_MODEL:
      return "Simulation Model";
    case AssetType.SIMOD_CONFIGURATION:
      return "Discovery Configuration";
    case AssetType.OPTIMOS_CONFIGURATION:
      return "Optimos Configuration";
    case AssetType.OPTIMOS_REPORT:
      return "Optimos Report";
    case AssetType.ZIP_FILE:
      return "Zip File";
    default:
      throw new Error(`Unknown asset type ${type}`);
  }
}

export async function getAssetsForProject(projectId: string, token: string): Promise<Asset[]> {
  const params = new URLSearchParams({ project_id: projectId });
  const url = `assets/?${params}`;
  const u = new URL(url, window.ENV.BACKEND_BASE_URL_PUBLIC);
  const response = await fetch(u, {
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: window.location.origin,
    },
  });
  const data = await response.json();
  return data as Asset[];
}

export async function createAsset(filesIds: string[], name: string, type: AssetType, projectId: string, token: string) {
  const url = `assets/`;
  const payload = {
    name: name,
    type: type,
    project_id: projectId,
    files_ids: filesIds,
  };
  const u = new URL(url, window.ENV.BACKEND_BASE_URL_PUBLIC);
  const response = await fetch(u, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Origin: window.location.origin,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return data as Asset;
}

export async function getAsset(assetId: string, token: string, lazy: boolean = true) {
  const params = new URLSearchParams({ lazy: lazy.toString() }); // NOTE: if false, the call returns the asset with its files as objects, not just ids
  const url = `assets/${assetId}?${params}`;
  const u = new URL(url, window.ENV.BACKEND_BASE_URL_PUBLIC);
  const response = await fetch(u, {
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: window.location.origin,
    },
  });
  const data = await response.json();
  return data as Asset;
}

export type AssetPatchIn = {
  name?: string;
  description?: string;
  type?: string;
  project_id?: string;
  files_ids?: string[];
  users_ids?: string[];
  processing_requests_ids?: string[];
};

export async function patchAsset(assetUpdate: AssetPatchIn, assetId: string, token: string) {
  const url = `assets/${assetId}`;
  const u = new URL(url, window.ENV.BACKEND_BASE_URL_PUBLIC);
  const response = await fetch(u, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Origin: window.location.origin,
    },
    body: JSON.stringify(assetUpdate),
  });
  const data = await response.json();
  return data as Asset;
}

export async function deleteAsset(assetId: string, token: string) {
  const url = `assets/${assetId}`;
  const u = new URL(url, window.ENV.BACKEND_BASE_URL_PUBLIC);
  const response = await fetch(u, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: window.location.origin,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to delete asset ${assetId}`);
  }
  console.log(`Deleted asset ${assetId}`);
}
