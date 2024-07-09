import { useContext, useEffect, useState } from "react";
import type { ToastOptions } from "react-hot-toast";
import toast from "react-hot-toast";
import { UserContext } from "~/routes/contexts";
import type { User } from "~/services/auth";
import { ProcessingRequestStatus, type ProcessingRequest, getProcessingRequest } from "~/services/processing_requests";

const terminalStatuses = [
  ProcessingRequestStatus.CANCELLED,
  ProcessingRequestStatus.FAILED,
  ProcessingRequestStatus.FINISHED,
];

function showToast(requestUpdated: ProcessingRequest) {
  const toastMessage = `Processing request ${requestUpdated.id} is ${requestUpdated.status}`;
  const toastProps = { duration: 10000, position: "top-center" } as ToastOptions;
  if (requestUpdated.status === ProcessingRequestStatus.FINISHED) toast.success(toastMessage, toastProps);
  else if (requestUpdated.status === ProcessingRequestStatus.FAILED) toast.error(toastMessage, toastProps);
  else toast(toastMessage, { ...toastProps, icon: "👌" });
}
export const useAutoRefreshRequest = (initialRequest?: ProcessingRequest) => {
  const user = useContext(UserContext);
  const [request, setRequest] = useState<ProcessingRequest | undefined>(initialRequest);

  useEffect(() => {
    if (!user?.token || !request) return;
    if (terminalStatuses.includes(request.status)) return;

    // set up polling for newly created or running processing requests
    const interval = setInterval(async () => {
      console.log(`Polling processing request ${request.id} with status ${request.status}...`);
      // fetch the processing request
      let requestUpdated;
      try {
        requestUpdated = await getProcessingRequest(request.id, user.token!);
      } catch (e: any) {
        throw new Error(e);
      }

      // update on change
      if (request && requestUpdated.status !== request.status) {
        showToast(requestUpdated);
      }
      console.log("Update Request to", requestUpdated);
      setRequest(requestUpdated);

      // remove polling when done processing
      if (terminalStatuses.includes(requestUpdated.status)) clearInterval(interval);
    }, 5000);
    return () => clearInterval(interval);
  }, [request, user?.token]);

  return request;
};
