import { json, redirect } from "@remix-run/node";
import type { TypedResponse, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { isRouteErrorResponse, useLoaderData, useRouteError } from "@remix-run/react";
import type { AxiosError } from "axios";
import { getAsset } from "~/services/assets.server";
import { getProcessingRequest } from "~/services/processing_requests.server";
import { requireLoggedInUser } from "~/shared/guards.server";
import OptimizationResults from "./components/OptimosResults";
import { FileType, getFileContent } from "~/services/files.server";
import Header from "~/components/Header";
import { UserContext } from "../contexts";
import type { User } from "~/services/auth";
import { getProject } from "~/services/projects.server";
import type { Project } from "~/services/projects";
import type { ProcessingRequest } from "~/services/processing_requests";
import type { FullOutputJson } from "~/shared/optimos_json_type";
import JSZip from "jszip";

export const meta: MetaFunction = ({ matches }) => {
  const rootMeta = matches.find((match) => match.id === "root")?.meta as
    | { title?: string; description?: string }[]
    | undefined;
  const title = rootMeta?.find((meta) => meta.title)?.title;
  const description = rootMeta?.find((meta) => meta.description)?.description;

  return [
    { title: `Simulation Statistics —— ${title}` },
    {
      name: "description",
      content: description,
    },
  ];
};

export const loader = async ({
  request,
  params,
}: LoaderFunctionArgs): Promise<
  TypedResponse<{
    report: FullOutputJson | null;
    project?: Project;
    user?: User;
    processingRequest?: ProcessingRequest;
  }>
> => {
  const user = await requireLoggedInUser(request);
  const requestId = params.requestId as string;

  let processingRequest, outputAsset;
  try {
    processingRequest = await getProcessingRequest(requestId, user.token!);
    if (processingRequest?.output_assets_ids.length === 0) {
      throw new Response("No output assets found", { status: 404 });
    }
    outputAsset = await getAsset(processingRequest.output_assets_ids[0], false, user.token!);
  } catch (e: any) {
    const err = e as AxiosError;
    if (err.response?.status === 401) {
      throw redirect("/login");
    }
    const status = err.response?.status || 500;
    const message = (err.response?.data as string) || err.message || "Error";
    throw new Response(message, { status: status });
  }

  const optimosReportJsonFile = outputAsset.files?.find(
    (file) => file.type === FileType.OPTIMIZATION_REPORT_OPTIMOS_JSON
  );
  if (!optimosReportJsonFile) return json({ report: null });
  var jsonStr = "";
  if (optimosReportJsonFile.name.endsWith(".zip")) {
    const fileContent = await getFileContent(optimosReportJsonFile.id, user.token!, "arraybuffer");
    const zipFile = await new JSZip().loadAsync(fileContent);
    jsonStr = await Object.values(zipFile.files)[0].async("string");
  } else {
    jsonStr = await getFileContent(optimosReportJsonFile.id, user.token!, "text");
  }

  const report = JSON.parse(jsonStr);

  const projectId = processingRequest.project_id;

  const project = await getProject(projectId, user.token!);

  return json({ report, project, user, processingRequest });
};

export default function OptimosStatisticsPage() {
  const { report, user, processingRequest } = useLoaderData<typeof loader>();

  if (!report || !user || !processingRequest) return <div>No report found (yet). Please try to refresh the page.</div>;
  return (
    <UserContext.Provider value={user}>
      <div className="min-h-full flex flex-col justify-between">
        <div className="flex grow flex-col min-h-full">
          <Header userEmail={user.email} />

          {report && (
            <OptimizationResults report={report as unknown as FullOutputJson} processingRequest={processingRequest} />
          )}
        </div>
      </div>
    </UserContext.Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return (
      <div className="h-full flex flex-col justify-center items-center">
        <div className="m-8 text-center">
          <p className="text-3xl">
            <span className="text-red-600">{error.statusText || "Error"}</span>
          </p>
          <p className="text-base mt-2">{error.data}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="h-full flex flex-col justify-center items-center">
      <div className="m-8 text-center">
        <p className="text-3xl">
          <span className="text-red-600">Something went wrong</span>
        </p>
      </div>
    </div>
  );
}
