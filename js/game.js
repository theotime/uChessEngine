'use strict';
/*
 * game.js - chess engine network game
 * works with game.php as a server.
 * 
 * depends : chess.js, chessboard.js, jquery.
 */

var Game = function (divname) {

    var url = window.location.href;
    if (url.search('token') === -1 ) {
        url += '?token=';
    } else {
        url = "you're black player, token is ";
    }
    
    var frameRefresh = 4 * 1000;
    var timer, token, color;
    var game = new Chess();

    var onDragStart = function (source, piece, position, orientation) {
        if (color == 'w' && (game.in_checkmate() === true || game.in_draw() === true ||
                piece.search(/^b/) !== -1)) {
            return false;
        }
        
        if (color == 'b' && (game.in_checkmate() === true || game.in_draw() === true ||
                piece.search(/^w/) !== -1)) {
            return false;
        }
    };

    var onDrop = function (source, target) {
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

        // ajax POST update
        $.ajax({
           url: 'game.php',
           type: 'GET',
           data: { 'token': token, 'move': move.san }
        });
    };

    // update the board position after the piece snap
    // for castling, en passant, pawn promotion
    var onSnapEnd = function () {
        board.position(game.fen());
    };

    function getLastFENfromServer() {
        var XHRret = $.ajax({
           url: 'game.php',
           type: 'GET',
           data: { 'token': token },
           async: false
        });
        
        var ret = JSON.parse(XHRret.responseText);
        if(ret.return === 'fail') {
            $('.message').text(ret.message);
            $('.message-box').fadeIn();
            if (typeof board !== 'undefined') {
                window.clearInterval(timer);
                board.clear();
            }
            return null;
        }
        if(ret.color !== color) {
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
        $.ajax({
           url: 'game.php',
           type: 'GET',
           async: false
        }).done(function ( data ) {
            var ret = JSON.parse(data);
            token = ret.token;
        });
    }
    
    this.run = function () {
        timer = window.setInterval(gameLoop, frameRefresh);
        $('input.show-share-token').val(url + token);
        $('span.show-share-token').text(url + token);
    };
    
    token = getQuerystring('token', false);
    if (token === false) {
        createNewGame();
    }
    var fen = getLastFENfromServer();
    if (fen === null) {
        this.run = function () {};
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