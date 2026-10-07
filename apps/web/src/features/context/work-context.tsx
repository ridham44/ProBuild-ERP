'use client';

import * as React from 'react';

type WorkContextValue = {
  /** Selected branch, or null for all branches. Features read this to scope lists once they support it. */
  branchId: string | null;
  setBranchId: (id: string | null) => void;
};

const WorkContext = React.createContext<WorkContextValue | null>(null);
const STORAGE_KEY = 'pb.context.branch';

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(value: string | null): void {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, value);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

/** Per-viewer convenience only: the choice is remembered in this browser and never trusted by the API. */
export function WorkContextProvider({ children }: { children: React.ReactNode }) {
  const [branchId, setBranchState] = React.useState<string | null>(null);

  React.useEffect(() => {
    setBranchState(readStored());
  }, []);

  const setBranchId = React.useCallback((id: string | null) => {
    setBranchState(id);
    writeStored(id);
  }, []);

  const value = React.useMemo(() => ({ branchId, setBranchId }), [branchId, setBranchId]);
  return <WorkContext.Provider value={value}>{children}</WorkContext.Provider>;
}

export function useWorkContext(): WorkContextValue {
  const value = React.useContext(WorkContext);
  if (!value) throw new Error('useWorkContext must be used inside WorkContextProvider');
  return value;
}
