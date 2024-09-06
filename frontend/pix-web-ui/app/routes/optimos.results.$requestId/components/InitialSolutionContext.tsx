import { createContext, useContext } from "react";
import type { JSONSolution } from "~/shared/optimos_json_type";

export const InitialSolutionContext = createContext<JSONSolution | undefined>(undefined);

export const useInitialSolution = () => {
  const initialSolution = useContext(InitialSolutionContext);
  if (initialSolution === undefined) {
    throw new Error("useInitialSolution must be used within a InitialSolutionProvider");
  }
  return initialSolution;
};
