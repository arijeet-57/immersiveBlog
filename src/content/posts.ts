import type { ComponentType } from 'react';

export interface PostFrontmatter {
  title: string;
  slug: string;
  date: string;
  author: string;
  excerpt: string;
  hero: string;
}

export interface Post extends PostFrontmatter {
  Component: ComponentType;
}

interface MdxModule {
  default: ComponentType;
  frontmatter: PostFrontmatter;
}

// Eager glob: every MDX file in /content/chronicles becomes a Post.
// remark-mdx-frontmatter exposes the front-matter as a named `frontmatter`
// export on the module.
const modules = import.meta.glob<MdxModule>('../../content/chronicles/*.mdx', {
  eager: true,
});

export const posts: Post[] = Object.values(modules)
  .map((m) => ({ ...m.frontmatter, Component: m.default }))
  .sort((a, b) => (a.date < b.date ? 1 : -1));

export const postsBySlug: Record<string, Post> = Object.fromEntries(
  posts.map((p) => [p.slug, p])
);

export function getPost(slug: string | undefined): Post | undefined {
  if (!slug) return undefined;
  return postsBySlug[slug];
}
