'use client';

import * as React from 'react';

type WorkContextValue = {
  /** Selected branch, or null for all branches. Features read this to scope lists once they support it. */
  branchId: string | null;
  setBranchId: (id: string | null) => void;
  /** Selected project, or null for all projects. Procurement and stock lists pre-filter by it. */
  projectId: string | null;
  setProjectId: (id: string | null) => void;
};

const WorkContext = React.createContext<WorkContextValue | null>(null);
const BRANCH_KEY = 'pb.context.branch';
const PROJECT_KEY = 'pb.context.project';

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    return;
  }
}

/** Per-viewer convenience only: the choice is remembered in this browser and never trusted by the API. */
export function WorkContextProvider({ children }: { children: React.ReactNode }) {
  const [branchId, setBranchState] = React.useState<string | null>(null);
  const [projectId, setProjectState] = React.useState<string | null>(null);

  React.useEffect(() => {
    setBranchState(readStored(BRANCH_KEY));
    setProjectState(readStored(PROJECT_KEY));
  }, []);

  const setBranchId = React.useCallback((id: string | null) => {
    setBranchState(id);
    writeStored(BRANCH_KEY, id);
  }, []);
  const setProjectId = React.useCallback((id: string | null) => {
    setProjectState(id);
    writeStored(PROJECT_KEY, id);
  }, []);

  const value = React.useMemo(
    () => ({ branchId, setBranchId, projectId, setProjectId }),
    [branchId, setBranchId, projectId, setProjectId],
  );
  return <WorkContext.Provider value={value}>{children}</WorkContext.Provider>;
}

export function useWorkContext(): WorkContextValue {
  const value = React.useContext(WorkContext);
  if (!value) throw new Error('useWorkContext must be used inside WorkContextProvider');
  return value;
}
