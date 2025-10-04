'use client'

import { cn } from '../../utils'
import { type ComponentProps, memo, useMemo } from 'react'
import { Streamdown } from 'streamdown'

type ResponseProps = ComponentProps<typeof Streamdown> & {
  showMermaidControls?: boolean
}

export const Response = memo(
  ({ className, components, showMermaidControls = true, children, ...props }: ResponseProps) => {
    return (
      <Streamdown
        className={cn('size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}
        controls={{ mermaid: showMermaidControls }}
        {...props}
      >
        {children}
      </Streamdown>
    )
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
)

Response.displayName = 'Response'
