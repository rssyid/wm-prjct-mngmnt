"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/**
 * Select dengan pencarian (searchable combobox).
 * API kompatibel dengan shadcn/Radix Select (Select, SelectTrigger, SelectValue,
 * SelectContent, SelectItem), tetapi dropdown dapat diketik untuk memfilter opsi.
 */

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectContextValue {
  value: string
  options: Map<string, SelectOption>
  open: boolean
  setOpen: (open: boolean) => void
  select: (value: string) => void
  disabled?: boolean
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext() {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error("Komponen Select harus berada di dalam <Select>")
  return ctx
}

function getNodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(getNodeText).join("")
  if (React.isValidElement(node)) {
    return getNodeText((node.props as { children?: React.ReactNode }).children)
  }
  return ""
}

function collectOptions(
  children: React.ReactNode,
  map: Map<string, SelectOption>
): void {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const props = child.props as {
      value?: string
      disabled?: boolean
      children?: React.ReactNode
    }
    if (child.type === SelectItem) {
      if (props.value !== undefined) {
        map.set(props.value, {
          value: props.value,
          label: getNodeText(props.children),
          disabled: props.disabled,
        })
      }
      return
    }
    if (props.children) collectOptions(props.children, map)
  })
}

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  name?: string
  required?: boolean
  children?: React.ReactNode
}

function Select({
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  onOpenChange,
  disabled,
  children,
}: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "")
  const [internalOpen, setInternalOpen] = React.useState(false)

  const value = valueProp !== undefined ? valueProp : internalValue
  const open = openProp !== undefined ? openProp : internalOpen

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [openProp, onOpenChange]
  )

  const select = React.useCallback(
    (next: string) => {
      if (valueProp === undefined) setInternalValue(next)
      onValueChange?.(next)
      setOpen(false)
    },
    [valueProp, onValueChange, setOpen]
  )

  const options = new Map<string, SelectOption>()
  collectOptions(children, options)

  const ctx: SelectContextValue = { value, options, open, setOpen, select, disabled }

  return (
    <SelectContext.Provider value={ctx}>
      <Popover open={open} onOpenChange={setOpen} modal>
        {children}
      </Popover>
    </SelectContext.Provider>
  )
}

const SelectGroup = ({ children }: { children?: React.ReactNode }) => <>{children}</>

const SelectValue = ({
  placeholder,
  className,
}: {
  placeholder?: React.ReactNode
  className?: string
}) => {
  const { value, options } = useSelectContext()
  const selected = value ? options.get(value) : undefined
  return (
    <span className={cn("truncate text-left", className)}>
      {selected ? selected.label : (placeholder ?? "")}
    </span>
  )
}

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, disabled, ...props }, ref) => {
  const { value, options, open, disabled: ctxDisabled } = useSelectContext()
  const hasValue = Boolean(value && options.has(value))
  return (
    <PopoverTrigger asChild>
      <button
        ref={ref}
        type="button"
        // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
        role="combobox"
        aria-expanded={open}
        disabled={disabled ?? ctxDisabled}
        data-placeholder={hasValue ? undefined : ""}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
    </PopoverTrigger>
  )
})
SelectTrigger.displayName = "SelectTrigger"

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: "popper" | "item-aligned"
  searchPlaceholder?: string
  emptyText?: string
}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  (
    {
      className,
      children,
      searchPlaceholder = "Ketik untuk mencari...",
      emptyText = "Tidak ada hasil.",
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      position,
      ...props
    },
    ref
  ) => (
    <PopoverContent
      ref={ref}
      className={cn(
        "w-[var(--radix-popover-trigger-width)] min-w-[8rem] max-w-[90vw]",
        className
      )}
      {...props}
    >
      <Command>
        <CommandInput placeholder={searchPlaceholder} autoFocus />
        <CommandList>
          <CommandEmpty>{emptyText}</CommandEmpty>
          <CommandGroup>{children}</CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  )
)
SelectContent.displayName = "SelectContent"

const SelectLabel = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props} />
)

interface SelectItemProps {
  value: string
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, value, disabled }, ref) => {
    const { value: current, select } = useSelectContext()
    const label = getNodeText(children)
    return (
      <CommandItem
        ref={ref}
        value={value}
        keywords={[label]}
        disabled={disabled}
        onSelect={() => select(value)}
        className={cn("pr-8", className)}
      >
        <span className="truncate">{children}</span>
        {current === value && (
          <Check className="absolute right-2 h-4 w-4" />
        )}
      </CommandItem>
    )
  }
)
SelectItem.displayName = "SelectItem"

const SelectSeparator = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
)

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
}
