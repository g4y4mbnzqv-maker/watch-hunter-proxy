var PROXY = "https://watch-hunter-proxy.vercel.app/api/ebay";
document.addEventListener("DOMContentLoaded", function() {
  fetch(PROXY + "?query=seiko+vintage+watch")
    .then(function(r) { return r.json(); })
    .then(function(d) {
      document.getElementById("listings").textContent = JSON.stringify(d).slice(0,200);
    })
    .catch(function(e) {
      document.getElementById("listings").textContent = "ERROR: " + e.message;
    });
});
