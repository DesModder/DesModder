import GLesmos from "..";
import { jsx } from "#DCGView";
import { If } from "#components";
import { format } from "#i18n";

export function GLesmosToggle(
  glesmos: GLesmos,
  id: string,
  ToggleView: any,
  allowInequality: boolean
) {
  return (
    <If
      predicate={() =>
        glesmos.canBeGLesmos(id) &&
        (allowInequality || !glesmos.isInequality(id))
      }
    >
      {() => (
        <div class="dcg-options-menu-section-title dsm-gl-fill-title">
          {() => format("GLesmos-label-toggle-glesmos")}
          <ToggleView
            ariaLabel={() => format("GLesmos-label-toggle-glesmos")}
            toggled={() => glesmos.isGlesmosMode(id)}
            onChange={() => glesmos.toggleGlesmos(id)}
          />
        </div>
      )}
    </If>
  );
}
