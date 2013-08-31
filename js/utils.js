'use strict';
/*
 * utils.js - toolbox helpers for chess engine
 * 
 * depends : -.
 */

// From : http://www.bloggingdeveloper.com/post/JavaScript-QueryString-ParseGet-QueryString-with-Client-Side-JavaScript.aspx
function getQuerystring(key, default_)
{
    if (default_ == null) {
        default_ = "";
    }
    key = key.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regex = new RegExp("[\\?&]" + key + "=([^&#]*)");
    var qs = regex.exec(window.location.href);
    if (qs == null) {
        return default_;
    } else {
        return qs[1];
    }
}