import { useActionData } from "@remix-run/react";
import { useEffect, useState } from "react";
import type { Asset } from "~/services/assets";
import type { ProcessingRequest } from "~/services/processing_requests";
import type { ProcessingType } from "~/shared/processing_type";
import { AssetsContext, SelectedAssetsContext, SetSelectedAssetsContext } from "../contexts";
import type { action } from "../route";
import InputAssets from "./InputAssets";
import OutputAssets from "./OutputAssets";
import ProcessingSetup from "./ProcessingSetup";

export default function ProcessingApp({
  assets: initialAssets,
  processingType,
  processingRequests,
}: {
  assets: Asset[];
  processingType: ProcessingType;
  processingRequests: ProcessingRequest[];
}) {
  const assetState = useState<Asset[]>(initialAssets);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const actionData = useActionData<typeof action>();

  // useEffect(() => {
  //   setSelectedAssets([]);
  // }, [processingType, actionData?.shouldResetSelectedAssets]);

  return (
    <AssetsContext.Provider value={assetState}>
      <SetSelectedAssetsContext.Provider value={setSelectedAssets}>
        <SelectedAssetsContext.Provider value={selectedAssets}>
          <InputAssets />
          <ProcessingSetup processingType={processingType} />
          <OutputAssets processingRequests={processingRequests} />
        </SelectedAssetsContext.Provider>
      </SetSelectedAssetsContext.Provider>
    </AssetsContext.Provider>
  );
}
