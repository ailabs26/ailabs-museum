import type { ComponentType, ReactNode } from 'react';

export function composeProviders(...providers: ComponentType<{ children: ReactNode }>[]) {
  return function ComposedProviders({ children }: { children: ReactNode }) {
    return providers.reduceRight<ReactNode>((content, Provider) => <Provider>{content}</Provider>, children);
  };
}
