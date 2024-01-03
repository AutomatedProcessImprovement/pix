import { Form, useNavigation } from "@remix-run/react";
import { useState } from "react";
import type { Asset } from "~/services/assets";
import { AssetType } from "~/services/assets";
import { AssetCard } from "./AssetCard";
import { ProcessingAppSection } from "./ProcessingAppSection";
import { useSelectedInputAsset } from "./useSelectedInputAsset";

export default function SetupSimod() {
  // Simod requires one event log and, optionally, a process model
  const eventLog = useSelectedInputAsset(AssetType.EVENT_LOG);
  const processModel = useSelectedInputAsset(AssetType.PROCESS_MODEL);

  const [selectedInputAssetsIdsRef, setSelectedInputAssetsIdsRef] = useState<string[]>([]);
  async function handleClick(_e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    const selectedAssets = [eventLog, processModel].filter((asset) => asset !== null) as Asset[];
    const assetsIds = selectedAssets.map((asset) => asset.id);
    setSelectedInputAssetsIdsRef(assetsIds);
  }

  const navigation = useNavigation();

  return (
    <ProcessingAppSection heading="Discovery Configuration">
      {!eventLog && (
        <p className="my-4 py-2 prose prose-md prose-slate max-w-lg">
          Select a event log and, optionally, a process model from the input assets on the left.
        </p>
      )}
      {eventLog && (
        <Form method="post" className="flex flex-col items-center w-full my-4">
          <input type="hidden" name="selectedInputAssetsIds" value={selectedInputAssetsIdsRef.join(",")} />
          <SimodConfiguration eventLog={eventLog} processModel={processModel} />
          <button
            className="mt-8 mb-6 w-2/3 xl:w-1/3 text-lg"
            type="submit"
            disabled={eventLog === null || navigation.state === "submitting"}
            onClick={handleClick}
          >
            Start discovery
          </button>
        </Form>
      )}
    </ProcessingAppSection>
  );
}

function SimodConfiguration({ eventLog, processModel }: { eventLog: Asset; processModel: Asset | null }) {
  return (
    <div className="flex flex-col items-center space-y-3 p-4 border-4 border-slate-200 bg-slate-50 rounded-xl">
      <AssetCard asset={eventLog} isActive={false} isInteractive={false} />
      {processModel && <AssetCard asset={processModel} isActive={false} isInteractive={false} />}
    </div>
  );
}
