'use client';

import { Component, useEffect } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import dynamic from 'next/dynamic';
import { WorkshopOverlay } from '../../components/dashboard/WorkshopOverlay';

const WorkshopScene = dynamic(
  () => import('../../components/dashboard/WorkshopScene'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#E8DED2]">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    ),
  },
);

class SceneBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[SceneBoundary] 3D scene crashed:', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-[#E8DED2] text-white/60 text-sm">
          3D scene failed to load — use the menu below
        </div>
      );
    }
    return this.props.children;
  }
}

class OverlayBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[OverlayBoundary] Overlay crashed:', error, info.componentStack);
  }
  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}

function MountLogger() {
  useEffect(() => {
    console.log('[HomePage] mounted');
    return () => console.log('[HomePage] unmounted');
  }, []);
  return null;
}

export default function HomePage() {
  return (
    <>
      <MountLogger />
      <div className="fixed inset-0 top-14 bg-[#E8DED2]">
        <SceneBoundary>
          <WorkshopScene />
        </SceneBoundary>
      </div>
      <OverlayBoundary>
        <WorkshopOverlay />
      </OverlayBoundary>
    </>
  );
}
