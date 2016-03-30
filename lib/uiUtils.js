/**
 * This file is part of AdBlock Ultimate Browser Extension
 *
 * AdBlock Ultimate Browser Extension is free software: you can redistribute it and/or modify
 * it serves under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * AdBlock Ultimate Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with AdBlock Ultimate Browser Extension.  If not, see <http://www.gnu.org/licenses/>.
 */
var {Cu, Cc, Ci} = require('chrome');

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

var winMediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);

var unload = require('sdk/system/unload');
var Prefs = require('./prefs').Prefs;
var Mobile = Prefs.mobile;

/**
 * Helper methods for work with windows
 */
var UiUtils = exports.UiUtils = {

	getMostRecentWindow: function () {
		return winMediator.getMostRecentWindow("navigator:browser");
	},

	getBrowserWindows: function () {

		var result = [];

		var enumerator = Services.wm.getZOrderDOMWindowEnumerator(null, true);
		if (!enumerator.hasMoreElements()) {
			enumerator = Services.wm.getEnumerator(null);
		}
		while (enumerator.hasMoreElements()) {
			var window = enumerator.getNext().QueryInterface(Ci.nsIDOMWindow);
			if (UiUtils.isBrowserWindow(window)) {
				result.push(window);
			}
		}

		return result;
	},

	isBrowserWindow: function (window) {
		return window.document.documentElement.getAttribute('windowtype') == 'navigator:browser';
	}
};

exports.WindowObserver = WindowObserver;

function WindowObserver(listener) {

	this.listener = listener;

	var windows = [];
	var e = Services.wm.getZOrderDOMWindowEnumerator(null, true);
	while (e.hasMoreElements()) {
		windows.push(e.getNext());
	}

	// Check if there are any windows that we missed
	var eAll = Services.ww.getWindowEnumerator();
	while (eAll.hasMoreElements()) {
		var element = eAll.getNext();
		if (windows.indexOf(element) < 0) {
			windows.push(element);
		}
	}

	for (var i = 0; i < windows.length; i++) {
		var window = windows[i].QueryInterface(Ci.nsIDOMWindow);
		this.listener.applyToWindow(window);
	}

	if (Mobile) {
		Services.wm.addListener(this);
	} else {
		Services.obs.addObserver(this, "chrome-document-global-created", true);
	}

	this.shutdownHandler = function () {
		var e = Services.ww.getWindowEnumerator();
		while (e.hasMoreElements()) {
			var window = e.getNext().QueryInterface(Ci.nsIDOMWindow);
			this.listener.removeFromWindow(window);
		}
		if (Mobile) {
			Services.wm.removeListener(this);
		} else {
			Services.obs.removeObserver(this, "chrome-document-global-created");
		}
	}.bind(this);

	//call shutdownHandler on unload
	unload.when(this.shutdownHandler);
}

WindowObserver.prototype = {

	listener: null,

	onOpenWindow: function (window) {
		let domWindow = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
		var event = "UIReady";
		var listener = function () {
			domWindow.removeEventListener(event, listener, false);
			if (this.listener) {
				this.listener.applyToWindow(domWindow);
			}
		};
		domWindow.addEventListener(event, listener, false);
	},

	observe: function (subject, topic, data) {
		if (topic == "chrome-document-global-created") {
			var window = subject.QueryInterface(Ci.nsIDOMWindow);
			var event = "load";
			var listener = function () {
				window.removeEventListener(event, listener, false);
				if (this.listener) {
					this.listener.applyToWindow(window);
				}
			}.bind(this);
			window.addEventListener(event, listener, false);
		}
	},

	QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver])
};

