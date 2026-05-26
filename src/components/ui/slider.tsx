import * as React from "react";
import { cn } from "../../lib/utils";

export interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(({ className, type: _type, ...props }, ref) => (
  <input type="range" className={cn("ui-slider", className)} ref={ref} {...props} />
));
Slider.displayName = "Slider";

export { Slider };
