"use client";
import {useEffect} from 'react';

// Preserve links shared before the landing page was introduced.
const workspaceViews = new Set(['overview', 'agents', 'payments', 'policies', 'attack-lab', 'audit-log', 'developer', 'connections']);
export default function LegacyWorkspace() {
  useEffect(() => {
    if (workspaceViews.has(window.location.hash.slice(1))) window.location.replace(`/app${window.location.hash}`);
  }, []);
  return null;
}
