import JSZip from "jszip";
import { constraintsSchema } from "~/routes/projects.$projectId.$processingType/components/optimos/validation/constraintsSchema";
import { timetableSchema } from "~/routes/projects.$projectId.$processingType/components/optimos/validation/timetableSchema";
import type { ConsParams, Constraints, ScenarioProperties, SimParams } from "~/shared/optimos_json_type";
import YAML from "yaml";

export const unpackAndMatchZip = async (fileContent: ArrayBuffer) => {
  const zip = await new JSZip().loadAsync(fileContent);
  const files = zip.files;

  const process_models: [string, string][] = [];
  const simulation_models: [string, string][] = [];
  const optimos_constraints: [string, string][] = [];
  const optimos_configurations: [string, string][] = [];
  const errors: string[] = [];

  for (const [filename, file] of Object.entries(files)) {
    if (file.dir) continue;
    // We match the file extension to determine before we read the file,
    // to speed up the process and avoid reading binary files.
    if (!filename.match(/\.(bpmn|json|yaml)$/i)) {
      errors.push(`Unknown file: ${filename}`);
      continue;
    }

    const content = await file.async("text");
    if (filename.endsWith(".bpmn")) {
      process_models.push([filename, content]);
    } else if (filename.endsWith(".json")) {
      var parsedJson;
      try {
        parsedJson = JSON.parse(content);
      } catch (e) {
        errors.push(`Error parsing ${filename}: ${e}`);
        continue;
      }
      if (timetableSchema.isValidSync(parsedJson)) {
        simulation_models.push([filename, content]);
      } else if (constraintsSchema.isValidSync(parsedJson)) {
        optimos_constraints.push([filename, content]);
      } else {
        errors.push(`Unknown JSON file: ${filename}`);
      }
    } else if (filename.endsWith(".yaml")) {
      try {
        // Try parse
        YAML.parse(content);
        optimos_configurations.push([filename, content]);
      } catch (e) {
        errors.push(`Error parsing ${filename}: ${e}`);
        continue;
      }
    }
  }

  return {
    process_models,
    simulation_models,
    optimos_constraints,
    optimos_configurations,
    errors,
  };
};
