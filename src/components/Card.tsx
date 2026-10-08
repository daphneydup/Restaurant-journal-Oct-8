import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...rest }: ComponentProps<'div'>) {
  return (
    <div className={cn('rounded-card bg-surface p-4 shadow-card md:p-5', className)} {...rest} />
  )
}
