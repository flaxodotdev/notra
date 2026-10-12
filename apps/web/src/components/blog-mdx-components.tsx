import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";

import {
  GitHubLogo,
  RailwayLogo,
  TinybirdLogo,
  WorkOSLogo,
} from "@/components/blog-diagrams/logos";
import {
  DemoApiFlowDiagram,
  DemoCookieDiagram,
  DemoDeploymentsDiagram,
  DemoPoolDiagram,
  DemoRebaseDiagram,
} from "@/components/blog-diagrams/notra-demo";
import { getMDXComponents } from "@/mdx-components";

const BRAND_LOGOS = {
  GitHub: GitHubLogo,
  Railway: RailwayLogo,
  Tinybird: TinybirdLogo,
  WorkOS: WorkOSLogo,
} as const;

function Brand({
  name,
  children,
}: {
  name: keyof typeof BRAND_LOGOS;
  children?: ReactNode;
}) {
  const Logo = BRAND_LOGOS[name];
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <Logo className="size-[0.9em] translate-y-[0.1em]" />
      {children ?? name}
    </span>
  );
}

export function getBlogMDXComponents(): MDXComponents {
  return getMDXComponents({
    DemoApiFlowDiagram,
    DemoCookieDiagram,
    DemoDeploymentsDiagram,
    DemoPoolDiagram,
    DemoRebaseDiagram,
    Brand,
    pre: ({ children, ...props }) => (
      <div className="code-block">
        <button
          aria-label="Copy code"
          className="code-copy-button"
          data-copy-code
          type="button"
        >
          <HugeiconsIcon className="code-copy-icon" icon={Copy01Icon} />
          <HugeiconsIcon className="code-copy-icon-success" icon={Tick02Icon} />
        </button>
        <pre {...props}>{children}</pre>
      </div>
    ),
  });
}
