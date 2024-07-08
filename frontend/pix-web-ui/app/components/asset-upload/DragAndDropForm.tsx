import { Transition } from "@headlessui/react";
import { DocumentArrowUpIcon } from "@heroicons/react/24/outline";
import { ArrowDownIcon } from "@heroicons/react/24/solid";
import { useFetcher } from "@remix-run/react";
import { useContext, useEffect, useRef, useState } from "react";
import EventLogColumnMappingDialog from "~/components/asset-upload/EventLogColumnMappingDialog";
import { EventLogColumnMapping } from "~/components/asset-upload/column_mapping";
import { AssetType, assetTypeToString, createAsset } from "~/services/assets";
import { unpackAndMatchZip } from "./zip_helper";
import { FileType, uploadFile } from "~/services/files";
import { UserContext } from "~/routes/contexts";
import { ProjectContext } from "~/routes/projects.$projectId/contexts";

export function DragAndDropForm({ assetType, close }: { assetType: AssetType; close: () => void }) {
  // DragAndDrop component is used to upload files to the server. It keeps track of three different asset types:
  // Event Log, Process Model, Simulation Model. All asset types have a corresponding drag and drop area and a hidden
  // input element to store the actual file. The Simulation Model consists of two assets, thus, it has two drag and drop
  // areas and two hidden input elements to store the Process Model and Simulation Model files.

  const user = useContext(UserContext);
  const project = useContext(ProjectContext);

  const fetcher = useFetcher();

  // These are used to store the actual files and are hidden from the user.
  const eventLogInputRef = useRef<any>(null);
  const processModelInputRef = useRef<any>(null);
  const simulationModelInputRef = useRef<any>(null);
  const simodConfigurationInputRef = useRef<any>(null);
  const optimosConfigurationInputRef = useRef<any>(null);

  // These are used only for UI purposes to update the state of drag and drop areas.
  const [eventLogFile, setEventLogFile] = useState<any>(null);
  const [processModelFile, setProcessModelFile] = useState<any>(null);
  const [simulationModelFile, setSimulationModelFile] = useState<any>(null);
  const [simodConfigurationFile, setSimodConfigurationFile] = useState<any>(null);
  const [optimosConfigurationFile, setOptimosConfigurationFile] = useState<any>(null);

  // Drag and drop areas' states
  const [eventLogDragActive, setEventLogDragActive] = useState<boolean>(false);
  const [processModelDragActive, setProcessModelDragActive] = useState<boolean>(false);
  const [simulationModelDragActive, setSimulationModelDragActive] = useState<boolean>(false);
  const [simodConfigurationDragActive, setSimodConfigurationDragActive] = useState<boolean>(false);
  const [optimosConfigurationDragActive, setOptimosConfigurationDragActive] = useState<boolean>(false);

  // Event log column mapping value, states, and effects
  const [eventLogColumnMappingEnabled, setEventLogColumnMappingEnabled] = useState<boolean>(false);
  const [eventLogColumnMappingFilledIn, setEventLogColumnMappingFilledIn] = useState<boolean>(false);
  const [eventLogColumnMapping, setEventLogColumnMapping] = useState<EventLogColumnMapping>(
    EventLogColumnMapping.default()
  );

  // Zip File, containing multiple files
  const [zipFile, setZipFile] = useState<any>(null);
  const [zipDragActive, setZipDragActive] = useState<boolean>(false);
  const zipInputRef = useRef<any>(null);

  // Submit button enabled state and effects
  const [submitEnabled, setSubmitEnabled] = useState<boolean>(false);
  useEffect(() => {
    if (fetcher.state === "submitting") {
      setSubmitEnabled(false);
      return;
    }

    switch (assetType) {
      case AssetType.EVENT_LOG:
        setEventLogColumnMappingEnabled(!!eventLogFile);
        setSubmitEnabled(!!eventLogFile && eventLogColumnMappingFilledIn);
        break;
      case AssetType.PROCESS_MODEL:
        setSubmitEnabled(!!processModelFile);
        break;
      case AssetType.SIMULATION_MODEL:
        setSubmitEnabled(!!processModelFile); // simulationModelFile is optional
        break;
      case AssetType.SIMOD_CONFIGURATION:
        setSubmitEnabled(!!simodConfigurationFile); // simodConfigurationFile is optional
        break;
      case AssetType.OPTIMOS_CONFIGURATION:
        setSubmitEnabled(!!optimosConfigurationFile);
        break;
      case AssetType.ZIP_FILE:
        setSubmitEnabled(!!zipFile);
        break;
    }
  }, [
    assetType,
    eventLogFile,
    processModelFile,
    simulationModelFile,
    simodConfigurationFile,
    optimosConfigurationFile,
    eventLogColumnMappingFilledIn,
    fetcher.state,
    close,
    zipFile,
  ]);

  // Close dialog on successful upload
  useEffect(() => {
    if (fetcher.state === "loading") {
      close();
    }
  }, [fetcher.state, close]);

  function getValidFileTypes(assetType: AssetType) {
    switch (assetType) {
      case AssetType.EVENT_LOG:
        return [".csv", ".gz"].join(", "); // it's .gz and not .csv.gz because only the last suffix is considered by the browser
      case AssetType.PROCESS_MODEL:
        return [".bpmn"].join(", ");
      case AssetType.SIMULATION_MODEL:
      case AssetType.OPTIMOS_CONFIGURATION:
        return [".json"].join(", ");
      case AssetType.SIMOD_CONFIGURATION:
        return [".yaml", ".yml"].join(", ");
      case AssetType.ZIP_FILE:
        return [".zip"].join(", ");
    }
  }

  function preventDefaultStopPropagation(e: any) {
    e.preventDefault();
    e.stopPropagation();
  }

  function onHiddenInputChange(e: any, assetType: AssetType) {
    e.preventDefault();
    const file = e.target.files[0];
    switch (assetType) {
      case AssetType.EVENT_LOG:
        setEventLogFile(file);
        break;
      case AssetType.PROCESS_MODEL:
        setProcessModelFile(file);
        break;
      case AssetType.SIMULATION_MODEL:
        setSimulationModelFile(file);
        break;
      case AssetType.SIMOD_CONFIGURATION:
        setSimodConfigurationFile(file);
        break;
      case AssetType.OPTIMOS_CONFIGURATION:
        setOptimosConfigurationFile(file);
        break;
      case AssetType.ZIP_FILE:
        setZipFile(file);
        break;
    }
  }

  function onDragEnterOrLeaveOrOver(e: any, assetType: AssetType, dragActive: boolean) {
    preventDefaultStopPropagation(e);

    let fileExists = false;
    switch (assetType) {
      case AssetType.EVENT_LOG:
        fileExists = !!eventLogFile;
        setEventLogDragActive(dragActive);
        break;
      case AssetType.PROCESS_MODEL:
        fileExists = !!processModelFile;
        setProcessModelDragActive(dragActive);
        break;
      case AssetType.SIMULATION_MODEL:
        fileExists = !!simulationModelFile;
        setSimulationModelDragActive(dragActive);
        break;
      case AssetType.SIMOD_CONFIGURATION:
        fileExists = !!simodConfigurationFile;
        setSimodConfigurationDragActive(dragActive);
        break;
      case AssetType.OPTIMOS_CONFIGURATION:
        fileExists = !!optimosConfigurationFile;
        setOptimosConfigurationDragActive(dragActive);
        break;
      case AssetType.ZIP_FILE:
        fileExists = !!zipFile;
        setZipDragActive(dragActive);
        break;
    }

    if (fileExists) {
      e.dataTransfer.dropEffect = "none";
    }
  }

  function onDragDrop(e: any, assetType: AssetType) {
    onDragEnterOrLeaveOrOver(e, assetType, false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      switch (assetType) {
        case AssetType.EVENT_LOG:
          setEventLogFile(file);
          eventLogInputRef.current.files = e.dataTransfer.files;
          break;
        case AssetType.PROCESS_MODEL:
          setProcessModelFile(file);
          processModelInputRef.current.files = e.dataTransfer.files;
          break;
        case AssetType.SIMULATION_MODEL:
          setSimulationModelFile(file);
          simulationModelInputRef.current.files = e.dataTransfer.files;
          break;
        case AssetType.SIMOD_CONFIGURATION:
          setSimodConfigurationFile(file);
          simodConfigurationInputRef.current.files = e.dataTransfer.files;
          break;
        case AssetType.OPTIMOS_CONFIGURATION:
          setOptimosConfigurationFile(file);
          optimosConfigurationInputRef.current.files = e.dataTransfer.files;
          break;
        case AssetType.ZIP_FILE:
          setZipFile(file);
          zipInputRef.current.files = e.dataTransfer.files;
          break;
      }
    }
  }

  function onRemoveClick(assetType: AssetType) {
    switch (assetType) {
      case AssetType.EVENT_LOG:
        setEventLogFile(null);
        eventLogInputRef.current.value = "";
        break;
      case AssetType.PROCESS_MODEL:
        setProcessModelFile(null);
        processModelInputRef.current.value = "";
        break;
      case AssetType.SIMULATION_MODEL:
        setSimulationModelFile(null);
        simulationModelInputRef.current.value = "";
        break;
      case AssetType.SIMOD_CONFIGURATION:
        setSimodConfigurationFile(null);
        simodConfigurationInputRef.current.value = "";
        break;
      case AssetType.OPTIMOS_CONFIGURATION:
        setOptimosConfigurationFile(null);
        optimosConfigurationInputRef.current.value = "";
        break;
      case AssetType.ZIP_FILE:
        setZipFile(null);
        zipInputRef.current.value = "";
        break;
    }
  }

  function openFileBrowser(assetType: AssetType) {
    switch (assetType) {
      case AssetType.EVENT_LOG:
        eventLogInputRef.current.value = "";
        eventLogInputRef.current.click();
        break;
      case AssetType.PROCESS_MODEL:
        processModelInputRef.current.value = "";
        processModelInputRef.current.click();
        break;
      case AssetType.SIMULATION_MODEL:
        simulationModelInputRef.current.value = "";
        simulationModelInputRef.current.click();
        break;
      case AssetType.SIMOD_CONFIGURATION:
        simodConfigurationInputRef.current.value = "";
        simodConfigurationInputRef.current.click();
        break;
      case AssetType.OPTIMOS_CONFIGURATION:
        optimosConfigurationInputRef.current.value = "";
        optimosConfigurationInputRef.current.click();
        break;
      case AssetType.ZIP_FILE:
        zipInputRef.current.value = "";
        zipInputRef.current.click();
        break;
    }
  }

  return (
    <div className="flex items-center justify-center">
      <fetcher.Form
        method="post"
        encType="multipart/form-data"
        className="flex flex-col items-center justify-center space-y-8"
      >
        <input type="hidden" name="assetType" value={assetType} />
        {/* Hidden input element that hold actual files and allows and allow to select files for upload on the button click. */}
        <input
          type="file"
          name="eventLogFile"
          ref={eventLogInputRef}
          className="hidden"
          accept={getValidFileTypes(AssetType.EVENT_LOG)}
          onChange={(e: any) => onHiddenInputChange(e, AssetType.EVENT_LOG)}
        />
        <input
          type="text"
          name="eventLogColumnMapping"
          className="hidden"
          value={eventLogColumnMapping.toString()}
          readOnly={true}
        />
        <input
          type="file"
          name="processModelFile"
          ref={processModelInputRef}
          className="hidden"
          accept={getValidFileTypes(AssetType.PROCESS_MODEL)}
          onChange={(e: any) => onHiddenInputChange(e, AssetType.PROCESS_MODEL)}
        />
        <input
          type="file"
          name="simulationModelFile"
          ref={simulationModelInputRef}
          className="hidden"
          accept={getValidFileTypes(AssetType.SIMULATION_MODEL)}
          onChange={(e: any) => onHiddenInputChange(e, AssetType.SIMULATION_MODEL)}
        />
        <input
          type="file"
          name="simodConfigurationFile"
          ref={simodConfigurationInputRef}
          className="hidden"
          accept={getValidFileTypes(AssetType.SIMOD_CONFIGURATION)}
          onChange={(e: any) => onHiddenInputChange(e, AssetType.SIMOD_CONFIGURATION)}
        />
        <input
          type="file"
          name="optimosConfigurationFile"
          ref={optimosConfigurationInputRef}
          className="hidden"
          accept={getValidFileTypes(AssetType.OPTIMOS_CONFIGURATION)}
          onChange={(e: any) => onHiddenInputChange(e, AssetType.OPTIMOS_CONFIGURATION)}
        />
        <input
          type="file"
          name="zipFile"
          ref={zipInputRef}
          className="hidden"
          accept={getValidFileTypes(AssetType.ZIP_FILE)}
          onChange={(e: any) => onHiddenInputChange(e, AssetType.ZIP_FILE)}
        />

        {assetType === AssetType.EVENT_LOG && (
          <div className="flex flex-col items-center justify-center space-y-2 my-4">
            <DragAndDropContainer
              file={eventLogFile}
              assetType={assetType}
              dragActiveFlag={eventLogDragActive}
              onDragEnter={(e) => onDragEnterOrLeaveOrOver(e, assetType, true)}
              onDragLeave={(e) => onDragEnterOrLeaveOrOver(e, assetType, false)}
              onDrop={(e) => onDragDrop(e, assetType)}
              onSelectFile={() => openFileBrowser(assetType)}
              onRemove={() => onRemoveClick(assetType)}
            />
            {/* Event log mapping */}
            <Transition
              show={eventLogColumnMappingEnabled}
              enter="transition-opacity duration-1000"
              enterFrom="opacity-0"
              enterTo="opacity-100"
            >
              {eventLogColumnMappingEnabled && (
                <div className="flex flex-col space-y-2 mb-4">
                  <ArrowDownIcon className="h-10 w-auto text-blue-200" aria-hidden="true" />
                  <EventLogColumnMappingDialog
                    trigger={
                      <button
                        type="button"
                        className={`${
                          eventLogColumnMappingFilledIn
                            ? "bg-green-500 hover:bg-green-600 text-white"
                            : "bg-green-50 hover:bg-green-100 text-green-900"
                        } border-2 border-green-500 px-5 py-3 w-80 text-lg font-semibold`}
                      >
                        Specify column mapping
                      </button>
                    }
                    columnMapping={eventLogColumnMapping}
                    setColumnMapping={setEventLogColumnMapping}
                    setColumnMappingFilledIn={setEventLogColumnMappingFilledIn}
                  />
                </div>
              )}
            </Transition>
          </div>
        )}

        {assetType === AssetType.PROCESS_MODEL && (
          <DragAndDropContainer
            className="m-4"
            file={processModelFile}
            assetType={assetType}
            dragActiveFlag={processModelDragActive}
            onDragEnter={(e) => onDragEnterOrLeaveOrOver(e, assetType, true)}
            onDragLeave={(e) => onDragEnterOrLeaveOrOver(e, assetType, false)}
            onDrop={(e) => onDragDrop(e, assetType)}
            onSelectFile={() => openFileBrowser(assetType)}
            onRemove={() => onRemoveClick(assetType)}
          />
        )}

        {assetType === AssetType.SIMULATION_MODEL && (
          <div className="flex flex-wrap items-center justify-center">
            {/* Process Model */}
            <DragAndDropContainer
              className="m-4"
              file={processModelFile}
              assetType={AssetType.PROCESS_MODEL}
              dragActiveFlag={processModelDragActive}
              onDragEnter={(e) => onDragEnterOrLeaveOrOver(e, AssetType.PROCESS_MODEL, true)}
              onDragLeave={(e) => onDragEnterOrLeaveOrOver(e, AssetType.PROCESS_MODEL, false)}
              onDrop={(e) => onDragDrop(e, AssetType.PROCESS_MODEL)}
              onSelectFile={() => openFileBrowser(AssetType.PROCESS_MODEL)}
              onRemove={() => onRemoveClick(AssetType.PROCESS_MODEL)}
            />

            {/* Simulation Parameters */}
            <DragAndDropContainer
              className="m-4"
              file={simulationModelFile}
              assetType={assetType}
              dragActiveFlag={simulationModelDragActive}
              onDragEnter={(e) => onDragEnterOrLeaveOrOver(e, assetType, true)}
              onDragLeave={(e) => onDragEnterOrLeaveOrOver(e, assetType, false)}
              onDrop={(e) => onDragDrop(e, assetType)}
              onSelectFile={() => openFileBrowser(assetType)}
              onRemove={() => onRemoveClick(assetType)}
            />
          </div>
        )}

        {assetType === AssetType.SIMOD_CONFIGURATION && (
          <DragAndDropContainer
            className="m-4"
            file={simodConfigurationFile}
            assetType={assetType}
            dragActiveFlag={simodConfigurationDragActive}
            onDragEnter={(e) => onDragEnterOrLeaveOrOver(e, assetType, true)}
            onDragLeave={(e) => onDragEnterOrLeaveOrOver(e, assetType, false)}
            onDrop={(e) => onDragDrop(e, assetType)}
            onSelectFile={() => openFileBrowser(assetType)}
            onRemove={() => onRemoveClick(assetType)}
          />
        )}

        {assetType === AssetType.OPTIMOS_CONFIGURATION && (
          <div className="flex flex-wrap items-center justify-center direction-column">
            {/* OPTIMOS Configuration */}
            <DragAndDropContainer
              className="m-4"
              file={optimosConfigurationFile}
              assetType={assetType}
              dragActiveFlag={optimosConfigurationDragActive}
              onDragEnter={(e) => onDragEnterOrLeaveOrOver(e, assetType, true)}
              onDragLeave={(e) => onDragEnterOrLeaveOrOver(e, assetType, false)}
              onDrop={(e) => onDragDrop(e, assetType)}
              onSelectFile={() => openFileBrowser(assetType)}
              onRemove={() => onRemoveClick(assetType)}
            />
          </div>
        )}

        <div className="text-center m-4 max-w-prose">
          Upload multiple files in a zip. All <code>.bpmn</code> files are assumed to be Process Models,{" "}
          <code>.json</code> Files will be matched against the schema for process models or optimos constraints.
        </div>
        <DragAndDropContainer
          className="m-4"
          file={zipFile}
          assetType={AssetType.ZIP_FILE}
          dragActiveFlag={zipDragActive}
          onDragEnter={(e) => onDragEnterOrLeaveOrOver(e, AssetType.ZIP_FILE, true)}
          onDragLeave={(e) => onDragEnterOrLeaveOrOver(e, AssetType.ZIP_FILE, false)}
          onDrop={(e) => onDragDrop(e, AssetType.ZIP_FILE)}
          onSelectFile={() => openFileBrowser(AssetType.ZIP_FILE)}
          onRemove={() => onRemoveClick(AssetType.ZIP_FILE)}
        />

        {!zipFile && (
          <button className="w-48" type="submit" disabled={!submitEnabled}>
            {fetcher.state === "submitting" ? "Uploading..." : "Upload"}
          </button>
        )}
        {zipFile && (
          <button
            className="w-48"
            onClick={async () => {
              if (!user || !user.token || !project) return;
              const { process_models, simulation_models, optimos_constraints, optimos_configurations, errors } =
                await unpackAndMatchZip(zipFile.arrayBuffer());

              if (process_models.length > 0 && simulation_models.length > 0) {
                const [processModelFileName, processModelContent] = process_models[0];
                const processModelFile = await uploadFile(
                  new Blob([processModelContent]),
                  processModelFileName,
                  FileType.PROCESS_MODEL_BPMN,
                  user.token
                );

                const [simulationModelFileName, simulationModelContent] = simulation_models[0];
                const simulationModelFile = await uploadFile(
                  new Blob([simulationModelContent]),
                  simulationModelFileName,
                  FileType.SIMULATION_MODEL_PROSIMOS_JSON,
                  user.token
                );

                await createAsset(
                  [processModelFile.id, simulationModelFile.id],
                  processModelFileName,
                  AssetType.SIMULATION_MODEL,
                  project.id,
                  user.token
                );
              }

              if (optimos_constraints.length > 0) {
                const optimosConfigFiles = [];
                const [fileName, content] = optimos_constraints[0];
                const file = await uploadFile(
                  new Blob([content]),
                  fileName,
                  FileType.CONSTRAINTS_MODEL_OPTIMOS_JSON,
                  user.token
                );
                optimosConfigFiles.push(file.id);
                if (optimos_configurations.length > 0) {
                  const [fileName, content] = optimos_configurations[0];
                  const file = await uploadFile(
                    new Blob([content]),
                    fileName,
                    FileType.CONFIGURATION_OPTIMOS_YAML,
                    user.token
                  );
                  optimosConfigFiles.push(file.id);
                }
                await createAsset(
                  optimosConfigFiles,
                  fileName,
                  AssetType.OPTIMOS_CONFIGURATION,
                  project.id,
                  user.token
                );
              }
              close();
            }}
          >
            Unpack Zip & Upload
          </button>
        )}
      </fetcher.Form>
    </div>
  );
}

function DragAndDropContainer(props: {
  file: any;
  assetType: AssetType;
  dragActiveFlag: boolean;
  onDragEnter: (e: any) => void;
  onDragLeave: (e: any) => void;
  onDrop: (e: any) => void;
  onSelectFile: () => void;
  onRemove: () => void;
  className?: string;
}) {
  return (
    <div
      className={`${
        props.dragActiveFlag ? `bg-blue-100 ${props.className}` : `bg-gray-50 ${props.className}`
      } border-4 border-blue-100 hover:border-blue-500 py-3 px-4 rounded-lg text-center flex flex-col items-center justify-center space-y-5`}
      onDragEnter={props.onDragEnter}
      onDragOver={props.onDragEnter}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
    >
      <DragAndDropHeader assetType={props.assetType} onSelectFile={props.onSelectFile} />
      <DroppedFile file={props.file} onRemove={props.onRemove} />
    </div>
  );
}

function DragAndDropHeader(props: { assetType: AssetType; onSelectFile: () => void }) {
  // Header of the drag-and-drop area, additional instructions, and controls.

  return (
    <div>
      <p className="text-lg mb-4 font-semibold">Add {assetTypeToString(props.assetType)}</p>
      <p className="">
        Drag & Drop or{" "}
        <span
          className="border border-blue-500 bg-white hover:bg-blue-50 rounded-md px-2 py-1 font-normal text-blue-600 cursor-pointer"
          onClick={props.onSelectFile}
        >
          {`select a file`}
        </span>{" "}
        to upload
      </p>
    </div>
  );
}

function DroppedFile(props: { file?: any; onRemove: () => void }) {
  if (props.file) {
    return (
      <div className="flex flex-col items-center p-3 mt-4">
        <div className="border-4 border-blue-100 bg-indigo-50 w-72 px-4 py-2 rounded-2xl flex space-x-2 my-1">
          <div className="flex items-center">
            <DocumentArrowUpIcon className="h-10 w-auto text-blue-500" />
          </div>
          <div className="flex flex-col flex-wrap max-w-sm overflow-hidden">
            <p className="truncate font-semibold text-blue-900">{props.file.name}</p>
            <div
              className="flex text-blue-500 hover:text-blue-600 cursor-pointer text-sm font-semibold"
              onClick={props.onRemove}
            >
              Remove
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
