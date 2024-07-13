import { createContext } from "react";
import type { Asset } from "~/services/assets";
import type { BpmnData } from "./components/prosimos/bpmn";

export const SelectedAssetsContext = createContext<Asset[]>([]);
export const SetSelectedAssetsContext = createContext<(_: Asset[]) => void>((_) => {});
export const BpmnDataContext = createContext<BpmnData | null>(null);
export const AssetsContext = createContext<[Asset[], (_: Asset[]) => void]>([[], (_) => {}]);
