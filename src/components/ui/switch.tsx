import * as React from "react";
import { cn } from "../../lib/utils";

export interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(({ className, checked = false, ...props }, ref) => (
  <button
    aria-checked={checked}
    className={cn("ui-switch", className)}
    data-state={checked ? "checked" : "unchecked"}
    ref={ref}
    role="switch"
    type="button"
    {...props}
  >
    <span className="ui-switch-thumb" />
  </button>
));
Switch.displayName = "Switch";

export { Switch };
