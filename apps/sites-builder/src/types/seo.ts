export type JsonLdNode = Record<string, unknown>;

export interface ThemeColors {
  light: string;
  dark: string;
}

export interface SocialImage {
  url: string;
  large: boolean;
  /** The cover's own alt text, from `imageAlt` in the frontmatter. */
  alt?: string;
}

export interface ExtraMetaTag {
  key: "name" | "property";
  value: string;
  content: string;
}

export interface BaseLayoutProps {
  title: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  generatedImage?: string;
  type?: "website" | "article";
  noindex?: boolean;
  publishedTime?: Date;
  modifiedTime?: Date;
  tags?: string[];
  markdown?: string;
  jsonLd?: JsonLdNode[];
}
