/**
 * Re-mounts per route (unlike layout.tsx), giving each page a subtle entrance:
 * 200ms fade with a 4px rise. The shell (sidebar, header) lives in the root
 * layout and is never re-mounted. `backwards` fill means no transform remains
 * after the animation, so sticky/fixed children behave normally.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
