"use client";

import * as React from "react";
import { Button } from "../core/button";
import { cn } from "../../utils";
import { ArrowDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useCallback } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn("relative flex-1 overflow-y-auto", className)}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>;

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <StickToBottom.Content className={cn("p-4", className)} {...props} />
);

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
      className
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </>
    )}
  </div>
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  const [isVisible, setIsVisible] = React.useState(false);
  const lastScrollTopRef = React.useRef(0);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  // Track scroll direction
  React.useEffect(() => {
    // Find the scroll container (the Conversation component with overflow)
    const findScrollContainer = (element: HTMLElement | null): HTMLElement | null => {
      if (!element) return null;
      const style = window.getComputedStyle(element);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        return element;
      }
      return findScrollContainer(element.parentElement);
    };

    const scrollContainer = buttonRef.current ? findScrollContainer(buttonRef.current.parentElement) : null;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const currentScrollTop = scrollContainer.scrollTop;
      const isScrollingDown = currentScrollTop > lastScrollTopRef.current;

      // Show button only when scrolling down and not at bottom
      setIsVisible(isScrollingDown && !isAtBottom);
      lastScrollTopRef.current = currentScrollTop;
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [isAtBottom]);

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
    setIsVisible(false);
  }, [scrollToBottom]);

  if (isAtBottom || !isVisible) {
    return null;
  }

  return (
    <Button
      ref={buttonRef}
      className={cn(
        "absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full transition-opacity duration-200",
        className
      )}
      onClick={handleScrollToBottom}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      <ArrowDownIcon className="size-4" />
    </Button>
  );
};
