import { useEffect, useState } from "react";
import type { Asset } from "~/services/assets";
import { getAssetsForProject } from "~/services/assets";

export function useInputAssets(projectId: string, token?: string): [boolean, Asset[]] {
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  useEffect(() => {
    if (!token) return;
    getAssetsForProject(projectId, token).then((assets) => {
      setAssets(assets.filter((asset) => asset.type === "simulation_model"));
      setIsLoading(false);
    });
  });

  return [isLoading, assets];
}
