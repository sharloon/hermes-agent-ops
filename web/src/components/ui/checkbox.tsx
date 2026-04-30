import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

export function Checkbox({
  checked,
  onCheckedChange,
  className,
  disabled,
  ...props
}: CheckboxProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'checked' | 'onChange'>) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onCheckedChange?.(e.target.checked);
      }}
      disabled={disabled}
      className={cn(
        "h-4 w-4 shrink-0 rounded border border-white/20 bg-white/5",
        "checked:bg-primary checked:border-primary",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}