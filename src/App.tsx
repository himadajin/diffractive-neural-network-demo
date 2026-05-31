import { useCallback, useEffect, useRef, useState } from "react";
import { OpticalBenchCanvas, type OpticalBenchHandle } from "./OpticalBenchCanvas";

export function App() {
  const benchRef = useRef<OpticalBenchHandle | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const clear = useCallback(() => {
    benchRef.current?.clear();
    setHasInk(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key.toLowerCase() === "c") {
        clear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clear]);

  return (
    <main className="app-shell">
      <OpticalBenchCanvas ref={benchRef} onInkChange={setHasInk} />
      <button
        className="clear-button"
        type="button"
        aria-label="Clear drawing"
        title="Clear drawing"
        disabled={!hasInk}
        onClick={clear}
      >
        <span aria-hidden="true">×</span>
      </button>
    </main>
  );
}
