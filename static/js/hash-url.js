var HASH_PARAMS;
$(function() {
	$.history.init(function(hash) {
		if (hash == "") {
			$.history.load("!");
			return;
		}
		var idx = hash.indexOf("?");
    HASH_PARAMS = {};
    if (idx > -1) {
      var queryString = hash.substring(idx + 1);
      $(queryString.split("&")).each(function(i, item) {
        var pair = item.split("=");
        HASH_PARAMS[pair[0]] = pair[1];
      })
    }
		if (hash.match(/^!/)) {
			var tokens = hash.substring(2, idx > -1 ? idx : hash.length).split("/");
			var callback = tokens.length > 1 && tokens[1] ? function() {
				models.Article.show(tokens[1]);
			} : models.Article.hide;
			models.Category.select(tokens[0], callback);
		}
		switch (hash.substring(1)) {

		}
	}, {
		unescape : true
	});
});