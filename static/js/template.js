var formatString = (function() {
	var replacer = function(context) {
		return function(s, name) {
			if(name.indexOf(".") > -1) {
				var tokens = name.split(".");
				var tmp = context;
				$(tokens).each(function(i, item) {
					tmp = tmp[item];
				});
				return tmp;
			}
			return context[name];
		}
	}
	return function(input, context) {
		return input.replace(/\{\{ ([\w.]+) \}\}/g, replacer(context));
	}
})();