import { useState, useEffect, useRef } from "preact/hooks";

export function useDoubleCheck() {
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    setPending(false);
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function getButtonProps(props?: Record<string, unknown>) {
    const onClick = pending
      ? props?.onClick
      : (e: MouseEvent) => {
          e.stopPropagation();
          setPending(true);
          timer.current = setTimeout(cancel, 5000);
        };

    const onBlur = () => cancel();

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };

    return { ...props, onClick, onBlur, onKeyUp };
  }

  return { pending, getButtonProps };
}
