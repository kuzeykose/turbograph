import { useState } from "react";

interface UseImpactAnalysisReturn {
  affectedPackages: string[];
  downstreamDependents: string[];
  handleImpactChange: (affected: string[], downstream: string[]) => void;
}

export function useImpactAnalysis(): UseImpactAnalysisReturn {
  const [affectedPackages, setAffectedPackages] = useState<string[]>([]);
  const [downstreamDependents, setDownstreamDependents] = useState<string[]>([]);

  const handleImpactChange = (affected: string[], downstream: string[]) => {
    setAffectedPackages(affected);
    setDownstreamDependents(downstream);
  };

  return {
    affectedPackages,
    downstreamDependents,
    handleImpactChange,
  };
}
