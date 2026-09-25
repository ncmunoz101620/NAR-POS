import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport } from
"@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={5000}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} className="text-[hsl(var(--background))] bg-[hsl(var(--chart-1))]">
            <div className="grid gap-1">
              {title && <ToastTitle className="text-[hsl(var(--background))]">{title}</ToastTitle>}
              {description &&
              <ToastDescription>{description}</ToastDescription>
              }
            </div>
            {action}
            <ToastClose />
          </Toast>);

      })}
      <ToastViewport />
    </ToastProvider>);

}