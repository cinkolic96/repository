import { createContext, useContext } from 'react';
import type { Role } from './cloud';

export interface SessionInfo {
  mode: 'local' | 'cloud';
  email?: string;
  userId?: string;
  agencyId?: string;
  role: Role;
  offline?: boolean;
  signOut?: () => void;
  /** Ima više agencija – može da promijeni */
  switchAgency?: () => void;
}

export const SessionContext = createContext<SessionInfo>({ mode: 'local', role: 'owner' });

export function useSession(): SessionInfo {
  return useContext(SessionContext);
}

export function useIsOwner(): boolean {
  return useSession().role === 'owner';
}
