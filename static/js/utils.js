var formatString = (function() {
	var replacer = function(context) {
		return function(s) {
			var result;

			var func = arguments[2];
			var args = [ arguments[1] ];

			$(args).each(function(i, item) {
				var m = item.match(/^["'](.*)["']$/);
				if (m) { // static string
					args[i] = m[0];
				} else {
					if (item.indexOf(".") > -1) { // property
						var tokens = item.split(".");
						var tmp = context;
						$(tokens).each(function(j, key) {
							tmp = tmp[key];
						});
						args[i] = tmp;
					} else { // placeholder
						args[i] = item in context ? context[item] : item;
					}
				}
			});

			if (func) {
				switch (func) {
				case "lower":
					return args[0].toLowerCase();
				case "upper":
					return args[0].toUpperCase();
				case "length":
					return args[0].length;
				case "trans":
					func = "gettext";
				default:
					result = window[func].apply(window, args);
				}
			} else {
				result = args[0];
			}

			return result;
		}
	}
	return function(input, context) {
		return input.replace(/\{\{ ([\w.'"]+)\|?(prettyDate|gettext|tans|lower|upper|length)? \}\}/g,
				replacer(context));
	}
})();

var showModalWindow = function(options) {
  var context = $.extend({
    id: "modal-window",
    title: "",
    body: "",
  }, options);
  $(formatString('\
  <div class="modal" id="{{ id }}">\
  <div class="modal-header">\
    <a class="close" data-dismiss="modal">×</a>\
    <h3>{{ title }}</h3>\
  </div>\
  <div class="modal-body">\
      {{ body }}\
  </div>\
  <div class="modal-footer">\
      <a href="#" class="btn" data-dismiss="modal">Close</a>\
  </div>\
  </div>\
  ', context)).modal().on("hidden", function() {
    $(this).remove();
  });
}