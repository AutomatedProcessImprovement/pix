import { useContext } from "react";
import UploadAssetButton from "~/components/asset-upload/UploadAssetButton";
import UploadAssetDialog from "~/components/asset-upload/UploadAssetDialog";
import type { Asset, AssetType } from "~/services/assets";
import { ProcessingType, processingTypeToAssetType } from "~/shared/processing_type";
import { AssetsContext, SelectedAssetsContext, SetSelectedAssetsContext } from "../contexts";
import { useProcessingType } from "../hooks/useProcessingType";
import { AssetCard } from "./AssetCard";
import { ProcessingAppSection } from "./ProcessingAppSection";

export default function InputAssets() {
  const setSelectedAssets = useContext(SetSelectedAssetsContext);
  const processingType = useProcessingType();
  const [assets] = useContext(AssetsContext);
  const selectedAssets = useContext(SelectedAssetsContext);

  function handleClick(asset: Asset) {
    switch (processingType) {
      case ProcessingType.Discovery:
      case ProcessingType.Optimization:
        // allow only one asset of each type to be selected at the same time
        if (selectedAssets.includes(asset)) {
          // if the asset is already selected, deselect it
          setSelectedAssets([...filterOutAssetType(selectedAssets, asset.type as AssetType)]);
        } else {
          setSelectedAssets([...filterOutAssetType(selectedAssets, asset.type as AssetType), asset]);
        }
        break;
      case ProcessingType.Simulation:
        // allow only one asset of each type to be selected at the same time
        if (selectedAssets.includes(asset)) {
          // if the asset is already selected, deselect it
          setSelectedAssets([...filterOutAssetType(selectedAssets, asset.type as AssetType)]);
        } else {
          setSelectedAssets([...filterOutAssetType(selectedAssets, asset.type as AssetType), asset]);
        }
        break;
      case ProcessingType.WaitingTime:
        if (selectedAssets.includes(asset)) setSelectedAssets([]);
        else setSelectedAssets([asset]);
        break;
    }
  }

  return (
    <ProcessingAppSection>
      <h2 className="text-xl text-slate-500 font-semibold mb-6">Input Assets</h2>
      {assets.length > 0 && (
        <div className="space-y-2 mb-6">
          {assets
            .sort((a, b) => {
              const aDate = new Date(a.creation_time);
              const bDate = new Date(b.creation_time);
              return aDate.getTime() - bDate.getTime();
            })
            .filter((assets: Asset) => assets.deletion_time === null)
            .map((asset: Asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                isActive={selectedAssets.includes(asset)}
                onClick={() => {
                  handleClick(asset);
                }}
              />
            ))}
        </div>
      )}
      <UploadAssetDialog
        trigger={<UploadAssetButton className="-ml-4" />}
        initialAssetType={processingTypeToAssetType(processingType)}
      />
    </ProcessingAppSection>
  );
}

function filterOutAssetType(assets: Asset[], assetType: AssetType) {
  return assets.filter((asset) => asset.type !== assetType);
}
