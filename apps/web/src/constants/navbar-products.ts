import { Framer } from "@notra/ui/components/ui/svgs/framer";
import { Github } from "@notra/ui/components/ui/svgs/github";
import { Granola } from "@notra/ui/components/ui/svgs/granola";
import { Linear } from "@notra/ui/components/ui/svgs/linear";
import { Raycast } from "@notra/ui/components/ui/svgs/raycast";
import { Slack } from "@notra/ui/components/ui/svgs/slack";

import { NAVBAR_BENTO_TINTS } from "@/constants/navbar-bento";
import type {
  NavbarBentoFeatureStyle,
  NavbarBentoLogo,
  NavbarProductsCrawlerRow,
  NavbarProductsIntegrationLogo,
  NavbarProductsLinkTile,
  NavbarProductsMock,
  NavbarProductsPersona,
  NavbarProductsPurpose,
  NavbarProductsPurposeStyle,
  NavbarProductsTurn,
} from "@/types/navbar-bento";

export const NAVBAR_PRODUCTS_FEATURE_STYLES: Record<
  string,
  NavbarBentoFeatureStyle<NavbarProductsMock>
> = {
  "/features/personas": {
    iconClassName: NAVBAR_BENTO_TINTS.violet,
    mock: "personas",
  },
  "/features/conversations": {
    iconClassName: NAVBAR_BENTO_TINTS.indigo,
    mock: "conversations",
  },
  "/features/ai-crawler-logs": {
    iconClassName: NAVBAR_BENTO_TINTS.amber,
    mock: "crawler",
  },
};

export const NAVBAR_PRODUCTS_LINK_TILES: readonly NavbarProductsLinkTile[] = [
  {
    href: "/integrations",
    label: "Integrations",
    description: "Notra in the tools you already use.",
    className: "grow-[1.25]",
    copyClassName: "w-56",
    mock: "integrations",
  },
  {
    href: "/mcp",
    label: "MCP & CLI",
    description: "Bring Notra into your agent.",
    className: "grow",
    copyClassName: "w-44",
    mock: "terminal",
  },
];

export const NAVBAR_PRODUCTS_LOGOS: Record<
  NavbarProductsIntegrationLogo,
  NavbarBentoLogo
> = {
  framer: { Logo: Framer },
  github: { Logo: Github },
  granola: { Logo: Granola },
  linear: { Logo: Linear },
  raycast: { Logo: Raycast, className: "[&_path]:fill-[#FF6363]" },
  slack: { Logo: Slack },
};

export const NAVBAR_PRODUCTS_PERSONAS: readonly NavbarProductsPersona[] = [
  {
    name: "Maya Chen",
    role: "Head of Growth · Series B SaaS",
    avatar: "/features/personas/maya.svg",
    memory: "Budget under $500 a month. SOC 2 is a must.",
    rank: 1,
  },
  {
    name: "Daniel Okafor",
    role: "Founder · Developer tools",
    avatar: "/features/personas/daniel.svg",
    memory: "Team of four. Wants a free plan to start.",
    rank: 3,
  },
];

export const NAVBAR_PRODUCTS_TURNS: readonly NavbarProductsTurn[] = [
  {
    question: "What's the best tool to automate changelogs from GitHub?",
    sources: "Searched the web · 12 sources",
    answer:
      "Beamer is the best known. Notra turns merged PRs into changelogs and launch posts.",
    rank: 2,
  },
  {
    question: "Which of those is cheapest for a team of five?",
    sources: "Searched the web · 8 sources",
    answer:
      "Notra has a free plan and doesn't charge per seat. Beamer starts at $59 a month.",
    rank: 1,
  },
  {
    question: "Can it post the update to LinkedIn too?",
    sources: "Searched the web · 6 sources",
    answer:
      "Yes. Notra drafts the post and publishes it to X or LinkedIn after approval.",
    rank: 1,
  },
];

export const NAVBAR_PRODUCTS_PURPOSES: Record<
  NavbarProductsPurpose,
  NavbarProductsPurposeStyle
> = {
  live: {
    label: "Live answer",
    className: "border-[#DDCFFC] bg-[#F1EBFE] text-[#6D3FD9]",
  },
  search: {
    label: "Search index",
    className: "border-[#D3E0F4] bg-[#EEF3FB] text-[#2F5C9E]",
  },
  referral: {
    label: "Referral",
    className: "border-[#CBE8D4] bg-[#EAF6EE] text-[#2F7D4B]",
  },
  training: {
    label: "Training",
    className: "border-[#F2DABA] bg-[#FDF3E7] text-[#A8601A]",
  },
};

export const NAVBAR_PRODUCTS_CRAWLER_ROWS: readonly NavbarProductsCrawlerRow[] =
  [
    {
      time: "14:03:12",
      bot: "ChatGPT-User",
      engine: "chatgpt",
      path: "/pricing",
      purpose: "live",
    },
    {
      time: "14:02:47",
      bot: "PerplexityBot",
      engine: "perplexity",
      path: "/docs/integrations/github",
      purpose: "search",
    },
    {
      time: "14:01:58",
      bot: "chatgpt.com",
      engine: "chatgpt",
      path: "/pricing",
      purpose: "referral",
    },
    {
      time: "14:00:31",
      bot: "ClaudeBot",
      engine: "claude",
      path: "/blog/changelog-guide",
      purpose: "training",
    },
    {
      time: "13:59:04",
      bot: "Claude-User",
      engine: "claude",
      path: "/features/social-updates",
      purpose: "live",
    },
    {
      time: "13:57:40",
      bot: "GPTBot",
      engine: "chatgpt",
      path: "/changelog",
      purpose: "training",
    },
    {
      time: "13:56:22",
      bot: "Google-Extended",
      engine: "google",
      path: "/llms.txt",
      purpose: "training",
    },
  ];

export const NAVBAR_PRODUCTS_LOGO_ROWS: readonly (readonly NavbarProductsIntegrationLogo[])[] =
  [
    ["github", "linear", "slack", "framer"],
    ["granola", "raycast", "github", "slack", "linear"],
    ["framer", "linear", "granola", "raycast"],
  ];

export const NAVBAR_PRODUCTS_TERMINAL_LINES = [
  "$ claude mcp add --transport http notra https://mcp.usenotra.com/mcp",
  "$ notra geo projects list",
  "$ notra geo scans start proj_123 --wait",
] as const;
