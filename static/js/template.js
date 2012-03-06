var ternary = function(condition, resultTrue, resultFalse) {
  if (!resultFalse) {
    resultFalse = "";
  }
  return condition ? resultTrue : resultFalse;
}
var formatString = (function() {
  var replacer = function(context) {
    return function(s) {
      var func;
      var result;
      var args;

      if (s.indexOf("{{") === 0) {
        func = arguments[2];
        args = [ arguments[1] ];
      } else if (s.indexOf("{%") === 0) {
        func = arguments[3];
        args = arguments[4].split(" "); // this will not be work correctly.
      }

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
    return input
        .replace(
            /\{\{ ([\w.]+)\|?(prettyDate|gettext)? \}\}|\{% (trans|lower|upper|length|trans|ternary) (.*) %\}/g,
            replacer(context));
  }
})();