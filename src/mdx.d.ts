declare module '*.mdx' {
  import type { ComponentType } from 'react';
  export const frontmatter: {
    title: string;
    slug: string;
    date: string;
    author: string;
    excerpt: string;
    hero: string;
  };
  const Component: ComponentType;
  export default Component;
}
