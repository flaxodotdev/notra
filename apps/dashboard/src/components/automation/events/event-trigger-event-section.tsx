import { Label } from "@notra/ui/components/ui/label";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { useStore } from "@tanstack/react-form";

import { EVENT_TYPE_ORDER } from "@/constants/event-triggers";
import type { EventTriggerFormSectionProps } from "@/types/automation/event-trigger";
import { IGNORE_COMMIT_PATTERNS_PLACEHOLDER } from "@/utils/ignore-commit-patterns";

import { EventTypeCard } from "./event-type-card";
import { TriggerSwitchRow } from "./trigger-switch-row";

export function EventTriggerEventSection({
  form,
}: EventTriggerFormSectionProps) {
  const eventType = useStore(form.store, (s) => s.values.eventType);

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Trigger event</h3>
        <p className="text-muted-foreground text-sm">When should this fire?</p>
      </div>
      <form.Field name="eventType">
        {(field) => (
          <div className="grid gap-3 md:grid-cols-2">
            {EVENT_TYPE_ORDER.map((type) => (
              <EventTypeCard
                eventType={type}
                key={type}
                onSelect={() => field.handleChange(type)}
                selected={field.state.value === type}
              />
            ))}
          </div>
        )}
      </form.Field>
      {eventType === "release" && (
        <form.Field name="includePreReleases">
          {(field) => (
            <TriggerSwitchRow
              checked={field.state.value}
              id={field.name}
              label="Include pre-releases"
              onCheckedChange={field.handleChange}
              tooltip="When off, releases marked as pre-release on GitHub will not fire this trigger."
            />
          )}
        </form.Field>
      )}
      {eventType === "push" && (
        <form.Field name="ignoreCommitPatternsText">
          {(field) => {
            const error = field.state.meta.errors[0];
            const errorMessage =
              typeof error === "string"
                ? error
                : (error as { message?: string } | undefined)?.message;
            return (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor={field.name}>Ignore commits matching</Label>
                  <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-[11px] font-medium">
                    Optional
                  </span>
                </div>
                <Textarea
                  aria-label="Ignore commits matching"
                  aria-invalid={field.state.meta.errors.length > 0}
                  className="min-h-20 font-mono text-xs"
                  id={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                  placeholder={`e.g. ${IGNORE_COMMIT_PATTERNS_PLACEHOLDER}`}
                  value={field.state.value}
                />
                {errorMessage ? (
                  <p className="text-destructive text-xs">{errorMessage}</p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    One case-sensitive regex per line. Pushes where every commit
                    message matches are skipped, so chores never turn into
                    content.
                  </p>
                )}
              </div>
            );
          }}
        </form.Field>
      )}
    </section>
  );
}
