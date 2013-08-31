'use strict';
/*
 * game.js - chess engine network game
 * works with game.php as a server.
 * 
 * depends : chess.js, chessboard.js, jquery.
 */

var Game = function(divname) {

    var _this = this;
    var frameRefresh = 4 * 1000;
    var timer, token, color, url;
    var game = new Chess();

    /**
     * Send GET request to the server
     * @param {type} data
     * @returns {@exp;JSON@call;parse}
     */
    function sendXHRrequest(data) {
        if (data === undefined)
            data = false;

        var XHRret = $.ajax({
            url: 'game.php',
            type: 'GET',
            data: data,
            async: false
        });

        return JSON.parse(XHRret.responseText);
    }

    var onDragStart = function(source, piece, position, orientation) {
        if (color === 'w' && (game.in_checkmate() === true || game.in_draw() === true ||
                piece.search(/^b/) !== -1)) {
            return false;
        }

        if (color === 'b' && (game.in_checkmate() === true || game.in_draw() === true ||
                piece.search(/^w/) !== -1)) {
            return false;
        }
    };

    var onDrop = function(source, target) {
        // see if the move is legal
        var move = game.move({
            from: source,
            to: target,
            promotion: 'q' // NOTE: always promote to Queen for example simplicity
        });

        // illegal move
        if (move === null) {
            return 'snapback';
        }

        sendXHRrequest({token: token, move: move.san});
    };

    // update the board position after the piece snap
    // for castling, en passant, pawn promotion
    var onSnapEnd = function() {
        board.position(game.fen());
    };

    function getLastFENfromServer() {
        var ret = sendXHRrequest({token: token});

        if (ret.return === 'fail') {
            $('.message').text(ret.message);
            $('.message-box').fadeIn();
            unsetGame();
            return null;
        }
        if (ret.color !== color) {
            color = ret.color;
        }

        var fen = ret.fen;
        game.load(fen);
        return game.fen();
    }

    function render(fen) {
        board.position(fen);
        var array = fen.split(' ');
        var color = (array[1] === 'w') ? 'White' : 'Black';
        $('#turn > strong').text(color);
    }

    var gameLoop = function() {
        if (!game.game_over()) {
            var fen = getLastFENfromServer();
            render(fen);
        } else {
            window.clearInterval(timer);
        }
    };

    function createNewGame() {
        var ret = sendXHRrequest();
        token = ret.token;
    }

    function unsetGame() {
        if (typeof board !== 'undefined') {
            window.clearInterval(timer);
            board.clear();
        }
    }

    function resetGame() {
        unsetGame();
        createNewGame();
        var fen = getLastFENfromServer();
        board.orientation((color === 'w') ? 'white' : 'black');
        render(fen);
        _this.run();

    }

    // jQuery handler
    function setBtnControl() {

        //external link : new window
        $('a[rel="external"]').click(function() {
            window.open($(this).attr('href'));
            return false;
        });

        $('#restartgame').click(function() {
            sendXHRrequest({token: token, action: 'close'});
            resetGame();
            return false;
        });

        $('#closegame').click(function() {
            sendXHRrequest({token: token, action: 'close'});
            unsetGame();
            return false;
        });
    }
    
    function getCurrentUrl() {
        var url = window.location.href;
        if (url.search('token') === -1) {
            url += '?token=';
        } else {
            var l = url.length;
            url = url.slice(0, l - 7);
        }
        return url;
    }
    
    this.run = function () {
        timer = window.setInterval(gameLoop, frameRefresh);
        $('input.show-share-token').val(url + token);
        $('span.show-share-token').text(url + token);
    };

    //init
    setBtnControl();

    url = getCurrentUrl();

    token = getQuerystring('token', false);
    if (token === false) {
        createNewGame();
    }
    var fen = getLastFENfromServer();
    if (fen === null) {
        this.run = function() {};
    }

    var board = new ChessBoard(divname, {
        draggable: true,
        position: fen,
        orientation: (color === 'w') ? 'white' : 'black',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
    });
}; 