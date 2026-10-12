"use client";

import type {
  ChatAttachment,
  ChatSessionSummary,
  ContextItem,
  TextSelection,
} from "@notra/ai/types/chat";
import type { ChatStatus, UIMessage } from "ai";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useEffectEvent,
} from "react";

import ChatInput from "@/components/chat-input";
import type { QueuedMessage } from "@/components/chat/chat-queue";
import { ContentChatActivityPanel } from "@/components/content/content-chat-activity-panel";
import {
  ContentPanelOverview,
  ContentPanelTabs,
} from "@/components/content/overview/content-panel-tabs";
import { RightPanel } from "@/components/dashboard/right-panel";
import { useRightPanel } from "@/components/dashboard/right-panel-context";
import {
  isContentPanelDismissed,
  setContentPanelDismissed,
  setContentPanelHasOverview,
  useContentPanelTab,
} from "@/lib/content-panel-tab";
import type {
  ChatInputEditingTarget,
  ContentChatInputHandle,
} from "@/types/components/chat-input";

export interface ContentDetailChatComposerProps {
  ref: RefObject<ContentChatInputHandle | null>;
  context: ContextItem[];
  disabled: boolean;
  error: string | null;
  isLoading: boolean;
  onAddContext: (item: ContextItem) => void;
  onClearError: () => void;
  onClearSelection: () => void;
  onEditQueued: (message: QueuedMessage) => void;
  onRemoveContext: (item: ContextItem) => void;
  onRemoveQueued: (id: string) => void;
  onSteerQueued: (message: QueuedMessage) => void;
  onSend: (
    instruction: string,
    attachments?: ChatAttachment[]
  ) => Promise<void>;
  onStop: () => void;
  onValueChange: (value: string) => void;
  organizationId: string;
  organizationSlug: string;
  placeholder?: string;
  editingTarget?: ChatInputEditingTarget;
  queuedMessages: QueuedMessage[];
  selection: TextSelection | null;
  value: string;
}

function ContentDetailChatComposer(props: ContentDetailChatComposerProps) {
  return <ChatInput {...props} />;
}

interface ContentDetailFloatingChatProps extends ContentDetailChatComposerProps {
  sidebarOffsetClass: string;
  hideOnLargeScreens: boolean;
}

export function ContentDetailFloatingChat({
  sidebarOffsetClass,
  hideOnLargeScreens,
  ...composerProps
}: ContentDetailFloatingChatProps) {
  return (
    <div
      className={`fixed right-0 bottom-0 left-0 mx-auto w-full max-w-2xl px-4 pb-4 md:w-auto ${sidebarOffsetClass} ${hideOnLargeScreens ? "lg:hidden" : ""}`}
    >
      <ContentDetailChatComposer {...composerProps} />
    </div>
  );
}

interface ContentDetailChatPanelProps {
  activeChatId: string | null;
  isHistoryLoading: boolean;
  messages: UIMessage[];
  onClose: () => void;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  sessions: ChatSessionSummary[];
  status: ChatStatus;
  composer: ContentDetailChatComposerProps;
  /** Post details tab next to the agent; blog posts and changelogs only. */
  overview?: ReactNode;
}

function ContentDetailChatComposerSlot({
  composer,
}: {
  composer: ContentDetailChatComposerProps;
}) {
  return (
    <div className="shrink-0 p-2 pt-1">
      <ContentDetailChatComposer {...composer} />
    </div>
  );
}

export function ContentDetailChatPanel({
  composer,
  overview,
  ...panelProps
}: ContentDetailChatPanelProps) {
  const tab = useContentPanelTab();
  const hasOverview = Boolean(overview);
  const showOverview = hasOverview && tab === "overview";
  const { openPanel } = useRightPanel();
  const openByDefault = useEffectEvent(() => {
    if (!isContentPanelDismissed()) {
      openPanel("content");
    }
  });

  // Blog posts and changelogs open with the panel showing, unless it was
  // closed on purpose; the header button then shows "Details".
  useEffect(() => {
    setContentPanelHasOverview(hasOverview);
    if (hasOverview) {
      openByDefault();
    }
    return () => setContentPanelHasOverview(false);
  }, [hasOverview]);

  const onClose = () => {
    if (hasOverview) {
      setContentPanelDismissed(true);
    }
    panelProps.onClose();
  };
  return (
    <RightPanel id="content">
      {showOverview ? (
        <ContentPanelOverview onClose={onClose}>
          {overview}
        </ContentPanelOverview>
      ) : (
        <ContentChatActivityPanel
          {...panelProps}
          onClose={onClose}
          organizationSlug={composer.organizationSlug}
          titleSlot={overview ? <ContentPanelTabs /> : undefined}
        >
          <ContentDetailChatComposerSlot composer={composer} />
        </ContentChatActivityPanel>
      )}
    </RightPanel>
  );
}
