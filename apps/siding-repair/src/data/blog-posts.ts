/**
 * Blog posts data
 */

export interface BlogPostData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  publishDate: string;
  author?: string;
  category?: string;
  image?: string;
}

export const blogPosts: BlogPostData[] = [];
