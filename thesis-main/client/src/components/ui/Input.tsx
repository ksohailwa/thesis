import React from 'react'

type Props = React.InputHTMLAttributes<HTMLInputElement>

const base =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400 placeholder:text-neutral-400'

const Input = React.forwardRef<HTMLInputElement, Props>(({ className = '', ...props }, ref) => {
  return <input ref={ref} className={`${base} ${className}`} {...props} />
})

Input.displayName = 'Input'

export default Input
