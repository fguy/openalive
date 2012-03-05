/*
 * JavaScript Pretty Date
 * Copyright (c) 2011 John Resig (ejohn.org)
 * Licensed under the MIT and GPL licenses.
 */

// Tuned by Taehoon Kang (fguy.com)

// Takes an ISO time and returns a string representing how
// long ago the date represents.
function prettyDate(time) {
	var diff = (((new Date()).getTime() - Date.parse(time)) / 1000), day_diff = Math
			.floor(diff / 86400);

	if(day_diff < 0) {
		return gettext("Few seconds ago");
	}
	if(isNaN(day_diff) || day_diff >= 31) {
		return time;
	}

	return day_diff == 0
			&& (diff < 10 && gettext("Just now") || diff < 60 && parseInt(diff)
					+ gettext(" seconds ago") || diff < 120
					&& gettext("About 1 minute ago") || diff < 3600
					&& Math.floor(diff / 60) + gettext(" minutes ago") || diff < 7200
					&& gettext("An hour ago") || diff < 86400 && Math.floor(diff / 3600)
					+ gettext(" hours ago")) || day_diff == 1 && gettext("Yesterday")
			|| day_diff < 7 && day_diff + gettext(" days ago") || day_diff < 31
			&& Math.ceil(day_diff / 7) + gettext(" weeks ago") || day_diff < 365
			&& parseInt(day_diff / 30) + gettext(" months ago")
			|| parseInt(day_diff / 365) + gettext(" years ago");
}

// If jQuery is included in the page, adds a jQuery plugin to handle it as well
if (typeof jQuery != "undefined") {
	jQuery.fn.prettyDate = function() {
		return this.each(function() {
			var date = prettyDate(this.title);
			if (date)
				jQuery(this).text(date);
		});
	};
	// Update time periodically. 
	setInterval(function() {
		jQuery("time[datetime]").each(function() {
			jQuery(this).text(prettyDate(jQuery(this).attr("datetime")));
		});
	}, 20000);	
}

/**
 * Date.parse with progressive enhancement for ISO-8601
 * © 2010 Colin Snover <http://zetafleet.com>
 * Released under MIT license.
 */
(function () {
    'use strict';
    var origParse = Date.parse;
    Date.parse = function (date) {
        var timestamp = origParse(date), minutesOffset = 0, struct;
        if (isNaN(timestamp) && (struct = /(\d{4})-?(\d{2})-?(\d{2})(?:[T ](\d{2}):?(\d{2}):?(\d{2})?(?:\.(\d{3,}))?(?:(Z)|([+\-])(\d{2})(?::?(\d{2}))?))/.exec(date))) {
            if (struct[8] !== 'Z') {
                minutesOffset = +struct[10] * 60 + (+struct[11]);
                
                if (struct[9] === '+') {
                    minutesOffset = 0 - minutesOffset;
                }
            }
            
            timestamp = Date.UTC(+struct[1], +struct[2] - 1, +struct[3], +struct[4], +struct[5] + minutesOffset, +struct[6], +struct[7].substr(0, 3));
        }
        
        return timestamp;
    };
}());