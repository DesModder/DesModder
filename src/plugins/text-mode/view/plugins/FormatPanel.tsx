import { astToText } from "../../../../../text-mode-core";
import { analysisStateField } from "../../LanguageServer";
import "./FormatPanel.less";
import { EditorView } from "@codemirror/view";
import { Component, jsx } from "#DCGView";
import { Button, Checkbox, If, Tooltip } from "#components";
import { format } from "#i18n";

export class FormatPanel extends Component<{
  ev: EditorView;
  update: () => void;
}> {
  ev!: EditorView;
  spaces!: boolean;
  newlines!: boolean;

  init() {
    this.spaces = true;
    this.newlines = true;
    this.ev = this.props.ev();
  }

  template() {
    return (
      <div class="dsm-cm-format-panel">
        <Button color="light-gray" onTap={() => this.format()}>
          {() => format("text-mode-format")}
        </Button>

        <Tooltip
          tooltip={() => format("text-mode-toggle-spaces-tooltip")}
          gravity="n"
        >
          <Checkbox
            checked={() => this.spaces}
            onChange={(checked) => {
              this.spaces = checked;
              if (this.spaces) this.newlines = true;
              this.format();
              this.props.update();
            }}
            ariaLabel={() => format("text-mode-toggle-spaces")}
          >
            {() => format("text-mode-toggle-spaces")}
          </Checkbox>
        </Tooltip>
        <If predicate={() => !this.spaces}>
          {() => (
            <Tooltip
              tooltip={() => format("text-mode-toggle-newlines-tooltip")}
              gravity="n"
            >
              <Checkbox
                checked={() => this.newlines}
                onChange={(checked) => {
                  this.newlines = checked;
                  this.format();
                  this.props.update();
                }}
                ariaLabel={() => format("text-mode-toggle-newlines")}
              >
                {() => format("text-mode-toggle-newlines")}
              </Checkbox>
            </Tooltip>
          )}
        </If>
      </div>
    );
  }

  format() {
    const analysis = this.ev.state.field(analysisStateField);
    this.ev.dispatch({
      changes: [
        {
          from: 0,
          to: this.ev.state.doc.length,
          insert: astToText(analysis.program, {
            noNewlines: !this.newlines,
            noOptionalSpaces: !this.spaces,
          }),
        },
      ],
    });
  }
}
