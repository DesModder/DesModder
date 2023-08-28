import GLesmos from "..";
import { jsx } from "#DCGView";
import { If } from "#components";
import { format } from "#i18n";

export function ConfirmLines(glesmos: GLesmos, id: string, ToggleView: any) {
  return (
    <If predicate={() => glesmos.isGlesmosMode(id) && glesmos.isInequality(id)}>
      {() => (
        <div class="dcg-options-menu-section-title dsm-gl-lines-confirm">
          {() => format("GLesmos-confirm-lines")}
          <ToggleView
            ariaLabel={() => format("GLesmos-confirm-lines")}
            toggled={() => glesmos.isGLesmosLinesConfirmed(id)}
            onChange={() => glesmos.toggleGLesmosLinesConfirmed(id)}
          />
          <If predicate={() => !glesmos.isGLesmosLinesConfirmed(id)}>
            {() => (
              <div class="dsm-gl-lines-confirm-body">
                {() => format("GLesmos-confirm-lines-body")}
              </div>
            )}
          </If>
        </div>
      )}
    </If>
  );
}
