import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { CameraConfig, Point3 } from "./types";

type CameraDebugControlsProps = {
  cameraConfig: CameraConfig;
  setCameraConfig: Dispatch<SetStateAction<CameraConfig>>;
  onResetCamera: () => void;
};

function readNumber(value: string, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function CameraDebugControls({
  cameraConfig,
  setCameraConfig,
  onResetCamera,
}: CameraDebugControlsProps) {
  const updateCameraValue = useCallback(
    (section: "position" | "target", axis: keyof Point3, value: string) => {
      setCameraConfig((config) => ({
        ...config,
        [section]: {
          ...config[section],
          [axis]: readNumber(value, config[section][axis]),
        },
      }));
    },
    [setCameraConfig],
  );

  const copyCamera = useCallback(() => {
    const value = `camera={ position:[${cameraConfig.position.x}, ${cameraConfig.position.y}, ${cameraConfig.position.z}], target:[${cameraConfig.target.x}, ${cameraConfig.target.y}, ${cameraConfig.target.z}], fov:${cameraConfig.fov} }`;
    void navigator.clipboard?.writeText(value);
    console.log(value);
  }, [cameraConfig]);

  return (
    <aside className="camera-debug" aria-label="Camera debug controls">
      <div className="camera-debug__row camera-debug__header">
        <span>camera</span>
        <button type="button" onClick={copyCamera}>
          copy
        </button>
        <button type="button" onClick={onResetCamera}>
          reset
        </button>
      </div>
      {(["position", "target"] as const).map((section) => (
        <fieldset key={section}>
          <legend>{section}</legend>
          {(["x", "y", "z"] as const).map((axis) => (
            <label key={axis}>
              <span>{axis}</span>
              <input
                type="number"
                step="0.01"
                value={cameraConfig[section][axis]}
                onChange={(event) =>
                  updateCameraValue(section, axis, event.target.value)
                }
              />
            </label>
          ))}
        </fieldset>
      ))}
      <fieldset>
        <legend>lens</legend>
        <label>
          <span>fov</span>
          <input
            type="number"
            step="0.1"
            min="10"
            max="75"
            value={cameraConfig.fov}
            onChange={(event) =>
              setCameraConfig((config) => ({
                ...config,
                fov: readNumber(event.target.value, config.fov),
              }))
            }
          />
        </label>
      </fieldset>
    </aside>
  );
}
