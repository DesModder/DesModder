import { Desmos } from "desmodder";

export default class DesmosRightClick {
	constructor(enabled = true) {
		this._enabled = enabled;
		if (this._enabled) {
			document.addEventListener("contextmenu", onContextMenu);
			window.addEventListener("mousedown", onMouseDown);
		}
	}
	
	enable () {
		// prevent enabling it twice
		if (!this._enabled) {
			this._enabled = true;
			document.addEventListener("contextmenu", onContextMenu);
			window.addEventListener("mousedown", onMouseDown);
		}
	}
	
	disable () {
		// prevent disabling it twice
		if (this._enabled) {
			this._enabled = false;
			document.removeEventListener("contextmenu", onContextMenu);
			window.removeEventListener("mousedown", onMouseDown);
		}
	}
}

function onContextMenu(params: any) {
	if (!showContextMenu) {
		showContextMenu = true;
		e.preventDefault();
	}
}

function onMouseDown (e: any) {
	if (e.button === 2) {
		let tag = e.target.tagName.toLowerCase();
		
		// determines if clicked target is an icon container
		let isIconContainer = (tagName, lvl, type) => {
			let container = seekParent(e.target, lvl);
			if (container === null) return false;
			return (
				tag === tagName &&
				'classList' in container &&
				container.classList.contains(`dcg-${type}-icon-container`)
			);
		};
		
		// determines if container is part of an expression or image
		let hasLongHoldButton = (lvl) => {
			let wrapper = seekParent(e.target, lvl + 1);
			if (wrapper === null) return false;
			if (typeof wrapper.classList === 'undefined') return false;
			return (
				wrapper.classList.contains('dcg-expression-icon-container') !== -1
			);
		};
		
		if ( // hidden color bubble of expressions or images
			isIconContainer('span', 2, 'expression') &&
			hasLongHoldButton(1)
		) {
			showContextMenu = false;
			Desmos.$(seekParent(e.target, 1)).trigger('dcg-longhold');
			
		} else if ( // shown color bubble of expressions
			isIconContainer('i', 3, 'expression') &&
			hasLongHoldButton(2)
		) {
			showContextMenu = false;
			Desmos.$(seekParent(e.target, 2)).trigger('dcg-longhold');
			
		} else if ( // hidden color bubble of table columns
			isIconContainer('span', 2, 'table')
		) {
			showContextMenu = false;
			Desmos.$(seekParent(e.target, 1)).trigger('dcg-longhold');
			
			
		} else if ( // shown color bubble of table columns
			isIconContainer('i', 3, 'table')
		) {
			showContextMenu = false;
			Desmos.$(seekParent(e.target, 2)).trigger('dcg-longhold');
			
		}
	}
}
