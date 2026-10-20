import { Component, type ReactNode } from 'react';

export interface ArtifactRenderState { checksum: string; attempts: number; failed: boolean }

/** Only model construction/rendering lives here; annotations and pedestal remain mounted. */
export class ArtifactModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
