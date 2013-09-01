// main.js
var clip = new ZeroClipboard(document.getElementById("copy-button"), {
    moviePath: "js/zeroclipboard/ZeroClipboard.swf"
});

clip.on('complete', function(client, args) {
    $('#copy-button').text('Copied!');
});

