export const PLATFORM_LABEL: Record<string, string>;
export const TYPE_LABEL: Record<string, string>;
export const LINK_FIELD: Record<string, { perfil: LinkField; post: LinkField }>;
export const POST_TYPES: Set<string>;

export type LinkField = { label: string; placeholder: string; help: string };

export type BuiltCopy = {
  name: string;
  slug: string;
  shortDescription: string;
  descriptionHtml: string;
  bullets: string[];
  faq: { q: string; a: string }[];
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  link: LinkField;
};

export function buildCopy(input: { platform: string; type: string; orderKind?: string }): BuiltCopy;
