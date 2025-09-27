'use client'

import { cn } from '@/utils/index'
import { type ComponentProps, memo, useMemo } from 'react'
import { Streamdown } from 'streamdown'

type ResponseProps = ComponentProps<typeof Streamdown>

export const Response = memo(
  ({ className, components, children, ...props }: ResponseProps) => {
    return (
      <Streamdown className={cn('size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)} {...props}>
        {children}
      </Streamdown>
    )
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
)

Response.displayName = 'Response'
