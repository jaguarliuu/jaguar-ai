import path from "node:path";
import { postSchema, type PostEntry } from "./types";
import { listContentFiles, readValidatedMdx, sortByDateDesc } from "./shared";

async function loadPost(filePath: string): Promise<PostEntry> {
  const { body, frontmatter } = await readValidatedMdx(filePath, postSchema);

  return {
    ...frontmatter,
    body,
  };
}

export async function getAllPosts() {
  const files = await listContentFiles("posts/*.mdx");
  const posts = await Promise.all(files.map(loadPost));
  return sortByDateDesc(posts);
}

export async function getAllPostSlugs() {
  const posts = await getAllPosts();
  return posts.map((post) => post.slug);
}

export async function getPostBySlug(slug: string) {
  const filePath = path.join(process.cwd(), "content", "posts", `${slug}.mdx`);

  try {
    return await loadPost(filePath);
  } catch {
    return null;
  }
}
