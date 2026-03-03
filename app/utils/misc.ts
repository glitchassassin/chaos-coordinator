import { useState, useEffect } from "react";

function callAll<Args extends unknown[]>(
  ...fns: ((...args: Args) => unknown)[]
) {
  return (...args: Args) => {
    fns.forEach((fn) => {
      fn(...args);
    });
  };
}

/**
 * Double-check hook for destructive actions.
 *
 * First click sets the pending state (show "Confirm?" label).
 * Second click lets the event proceed (form submit, onClick, etc.).
 * Auto-resets after `timeoutMs` (default 5 s), on blur, or on Escape.
 */
export function useDoubleCheck(timeoutMs = 5000) {
  const [doubleCheck, setDoubleCheck] = useState(false);

  useEffect(() => {
    if (!doubleCheck) return;
    const id = setTimeout(() => {
      setDoubleCheck(false);
    }, timeoutMs);
    return () => {
      clearTimeout(id);
    };
  }, [doubleCheck, timeoutMs]);

  function getButtonProps(props?: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const onBlur: React.ButtonHTMLAttributes<HTMLButtonElement>["onBlur"] = () => {
      setDoubleCheck(false);
    };

    const onClick: React.ButtonHTMLAttributes<HTMLButtonElement>["onClick"] = doubleCheck
      ? undefined
      : (e) => {
          e.preventDefault();
          setDoubleCheck(true);
        };

    const onKeyUp: React.ButtonHTMLAttributes<HTMLButtonElement>["onKeyUp"] = (e) => {
      if (e.key === "Escape") {
        setDoubleCheck(false);
      }
    };

    return {
      ...props,
      onBlur: callAll(onBlur, props?.onBlur),
      onClick: callAll(onClick, props?.onClick),
      onKeyUp: callAll(onKeyUp, props?.onKeyUp),
    };
  }

  return { doubleCheck, getButtonProps };
}
