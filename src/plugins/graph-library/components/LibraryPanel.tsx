import GraphLibrary from "..";
import { Component, jsx } from "#DCGView";
import { For, If, IfElse, IconButton, Button } from "#components";
import { format } from "#i18n";

export function LibraryPanelFunc(gl: GraphLibrary) {
	return <LibraryPanel gl={gl} />;
}

class LibraryPanel extends Component<{ gl: GraphLibrary }> {
	gl!: GraphLibrary;

	init() {
		this.gl = this.props.gl();
	}

	template() {
		return (
			<div class="dcg-popover-interior dsm-graph-library-panel">
				<div class="dcg-popover-title">{format("graph-library-name")}</div>

				{/* Save current graph section */}
				<div class="dsm-graph-library-save-section">
					<Button
						color="blue"
						class="dsm-graph-library-save-current-button"
						onTap={() => this.gl.saveCurrentGraph()}
						disabled={() => !this.gl.canSaveCurrentGraph()}
					>
						{() =>
							this.gl.isCurrentGraphSaved()
								? format("graph-library-saved")
								: format("graph-library-save-current")
						}
					</Button>
					<If predicate={() => !this.gl.isInSavedGraph()}>
						{() => (
							<div class="dsm-graph-library-save-hint">
								{format("graph-library-save-hint")}
							</div>
						)}
					</If>
				</div>

				{/* Library list section */}
				<div class="dsm-graph-library-list-section">
					<div class="dcg-popover-title">
						{format("graph-library-saved-graphs")}
					</div>
					{this.renderLibraryList()}
				</div>
			</div>
		);
	}

	renderLibraryList() {
		return IfElse(() => this.gl.library.length === 0, {
			true: () => (
				<div class="dsm-graph-library-empty">
					{format("graph-library-empty")}
				</div>
			),
			false: () => (
				<div class="dsm-graph-library-list">
					<For each={() => this.gl.library} key={(entry) => entry.id}>
						{(entry: () => any) => (
							<div class="dsm-graph-library-entry">
								<div
									class="dsm-graph-library-entry-content"
									onClick={() =>
										this.gl.cc.dispatch({
											type: "dsm-graph-library-import",
											id: entry().id,
										})
									}
								>
									<div class="dsm-graph-library-entry-title">
										<i
											class={`dcg-shared-product-icon ${this.getCalculatorIconClass(
												entry().calculatorType
											)}`}
										/>
										<span class="dsm-graph-library-entry-title-text">

											<strong>{this.shouldFormatAsPrivate(entry().title) ? "private": ""}</strong> {this.formatTitle(entry().title)}

										</span>
									</div>
									<div class="dsm-graph-library-entry-date">
										{this.formatDate(entry().savedAt)}
									</div>
								</div>
								<div class="dsm-graph-library-entry-actions">
									<If predicate={() => this.gl.copiedEntryId === entry().id}>
										{() => (
											<i class="dcg-icon-check dsm-graph-library-copied-icon" />
										)}
									</If>
									<If predicate={() => this.gl.copiedEntryId !== entry().id}>
										{() => (
											<i
												class="dcg-icon-share dsm-graph-library-open-button"
												onClick={() =>
													this.gl.cc.dispatch({
														type: "dsm-graph-library-open",
														url: entry().url,
													})
												}
											/>
										)}
									</If>
									<If predicate={() => this.gl.copiedEntryId !== entry().id}>
										{() => (
											<i
												class="dcg-icon-delete dsm-graph-library-delete-button"
												onClick={() =>
													this.gl.cc.dispatch({
														type: "dsm-graph-library-delete",
														id: entry().id,
													})
												}
											/>
										)}
									</If>
								</div>
							</div>
						)}
					</For>
				</div>
			),
		});
	}

	formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) {
			return "Today";
		} else if (diffDays === 1) {
			return "Yesterday";
		} else if (diffDays < 7) {
			return `${diffDays} days ago`;
		} else {
			return date.toLocaleDateString();
		}
	}

	getCalculatorIconClass(type: string): string {
		switch (type) {
			case "graphing":
				return "dcg-icon-graphing";
			case "geometry":
				return "dcg-icon-geometry";
			case "3d":
				return "dcg-icon-3d";
			default:
				return "dcg-icon-graphing"; // fallback
		}
	}

	shouldFormatAsPrivate(title: string): boolean {
		return title.startsWith("@private ");
  }

  formatTitle(title: string): string {
    // If its too long truncate it
    const maxLength = 30;
    if (title.length > maxLength) {
      title = title.substring(0, maxLength - 3) + "...";
    }

		if (title.startsWith("@private ")) {
			const restOfTitle = title.substring(9); // Remove "@private "
			return restOfTitle;
		}
		return title;
	}
}
