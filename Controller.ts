export default class Controller {
	// I was going to use jquery but for now I'm going to use vanilla js
	readonly panel: HTMLElement | null;
	readonly onFocus: (evtInfo: FocusEvent) => void;
	
	filterTag: string[];
	enabled: boolean = false;
	
	constructor(
		filterTag: string[],
		callback: (evtInfo: FocusEvent) => void
	) {
		this.panel = document.querySelector(".dcg-exppanel-outer");
		this.onFocus = callback;
		this.filterTag = filterTag;
		let evtPred = (e: FocusEvent) => {
			let elem: HTMLElement = e.target as HTMLElement;
			let isTarget: boolean = this.filterTag.includes(elem.tagName.toLowerCase());
			if (isTarget && this.enabled) {
				callback(e);
			}
		}
		
		this.panel?.addEventListener('focusin', evtPred, false);
		this.panel?.addEventListener('focusout', evtPred, false);
		
	}
	
	enable() {
		this.enabled = true;
	}
	
	disable() {
		this.enabled = false;
	}
	
}
