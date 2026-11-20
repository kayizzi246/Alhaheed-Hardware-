/*
 * Keeps a desk's queue current.
 *
 * Shared hosting has no websocket worth relying on, so the page reloads
 * itself every ten seconds. That is the honest version of "live" here —
 * and a queue that quietly goes stale at a counter is worse than one
 * that visibly refreshes.
 *
 * It holds off while somebody is typing or a menu is open, because
 * reloading the page under a half-filled payment form would lose the
 * amount they just counted out.
 */
( function () {
	'use strict';

	var SECONDS = 10;
	var timer = null;

	function busy() {
		var el = document.activeElement;
		if ( ! el ) {
			return false;
		}
		var tag = el.tagName;
		return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
	}

	function tick() {
		// A page the browser has hidden does not need refreshing, and
		// reloading a background tab every ten seconds all day is rude
		// to a shared host.
		if ( document.hidden || busy() ) {
			return;
		}
		window.location.reload();
	}

	function start() {
		if ( timer ) {
			return;
		}
		timer = window.setInterval( tick, SECONDS * 1000 );
	}

	document.addEventListener( 'DOMContentLoaded', function () {
		// Only the queues refresh. Settings and the cash book are read
		// deliberately, not watched.
		var page = new URLSearchParams( window.location.search ).get( 'page' ) || '';
		if ( page.indexOf( 'al-hadeed' ) !== 0 || page.indexOf( 'settings' ) !== -1 ) {
			return;
		}

		start();

		// Submitting takes you to a fresh page anyway; stopping the
		// timer avoids a reload racing the submit.
		Array.prototype.forEach.call(
			document.querySelectorAll( '.ah-form' ),
			function ( form ) {
				form.addEventListener( 'submit', function () {
					window.clearInterval( timer );
					timer = null;
				} );
			}
		);
	} );
}() );
