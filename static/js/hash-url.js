$(function() {
  $.history.init(function(hash) {
    if (hash == "") {
      // initialize your app
      return;
    }
    if (hash.match(/^!/)) {
      Category.select(hash.substring(2));
    }
    switch(hash.substring(1)) {
      
    }
  }, {
    unescape : ",/"
  });
});