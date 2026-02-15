'use client';

import dynamic from 'next/dynamic';

const WorkspaceScene = dynamic(
  () => import('../../components/workspace/WorkspaceScene'),
  { ssr: false }
);

export default function WorkspacePage() {
  return (
    <div className="h-screen w-screen bg-[#0c0c14]">
      <WorkspaceScene />
    </div>
  );
}
