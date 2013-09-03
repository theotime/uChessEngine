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
    var bufferMove = {source: "", target: ""};
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
        if (isPromotionSquare(source, target)) {
            if(isValidSquare(target, game.moves({square: source, verbose:true}))) {
                if (color === 'b' ) {
                    $('#promotion-queen+img').attr('src', '/img/chesspieces/wikipedia/bQ.png');
                    $('#promotion-rook+img').attr('src', '/img/chesspieces/wikipedia/bR.png');
                    $('#promotion-bishop+img').attr('src', '/img/chesspieces/wikipedia/bB.png');
                    $('#promotion-knight+img').attr('src', '/img/chesspieces/wikipedia/bN.png');
                }
                bufferMove.source = source;
                bufferMove.target = target;
                $('#promotion-modal').modal('show');
                return false;
            } else {
                return 'snapback';
            }
            
        }

        var move = game.move({
            from: source,
            to: target,
        });

        // illegal move
        if (move === null) {
            return 'snapback';
        }
        
        sendXHRrequest({token: token, move: move.san});
        
        if (game.game_over()) {
            unsetGame((game.turn() === 'b') ? "White wins." : "Black wins.");
        }
    };

    // update the board position after the piece snap
    // for castling, en passant, pawn promotion
    var onSnapEnd = function() {
        board.position(game.fen());
    };
    
    function isValidSquare(target, vGameMoves) {
        for(var i=0;i<vGameMoves.length;i++ ) {
            if(vGameMoves[i].to === target) {
                return true;
            }
        }
    }
    
    function isPromotionSquare(source, target) {
        var piece = game.get(source);
        
        var promotionLine = false;
        if((target.search('1') !== -1)  || (target.search('8') !== -1)) {
            promotionLine = true;
        }
        
        if ((piece.type === 'p') && (promotionLine === true) ) {
            return true;
        } else {
            return false;
        }
    }

    function getLastFENfromServer() {
        var ret = sendXHRrequest({token: token});

        if (ret.return === 'fail') {
            unsetGame(ret.message);
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
            unsetGame((game.turn() === 'b') ? "White wins." : "Black wins.");
        }
    };

    function createNewGame() {
        var ret = sendXHRrequest();
        if(ret.return === 'fail') {
            unsetGame(ret.message, 'override');
            return false;
        } else {
            token = ret.token;
            return true;
        }
    }

    function unsetGame(message, type) {
        if (type === undefined)
            type = 'restart';
        
        var tm = '#' + type + '-modal';
        
        if (typeof board !== 'undefined') {
            window.clearInterval(timer);
        }
        $('.message').text(message);
        $(tm).modal('show');
        
    }

    function resetGame() {
        window.clearInterval(timer);
        if (createNewGame()) {
            var fen = getLastFENfromServer();
            board.orientation((color === 'w') ? 'white' : 'black');
            render(fen);
            _this.run();
        }

    }

    // jQuery handler
    function setBtnControl() {

        //external link : new window
        $('a[rel="external"]').click(function() {
            window.open($(this).attr('href'));
            return false;
        });

        $('.restartgame').click(function() {
            sendXHRrequest({token: token, action: 'close'});
            resetGame();
            return false;
        });
        
        $('.restartgame-modal-btn').click(function() {
            $('#restart-modal').modal('hide');
            resetGame();
            return false;
        });

        $('.closegame').click(function() {
            sendXHRrequest({token: token, action: 'close'});
            unsetGame('You close the game.');
            return false;
        });
        
        $('.promote').click(function() {
            var promotion = $('#promotion-form input:checked').val();
            $('#promotion-modal').modal('hide');
            var move = game.move({
                from: bufferMove.source,
                to: bufferMove.target,
                promotion: promotion
            });

            sendXHRrequest({token: token, move: move.san});

            if (game.game_over()) {
                var player = getCurrentTurn();
                unsetGame((player === 'b') ? "White wins." : "Black wins.");
            }
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
        $('#copy-button').text('Share this game');
    };

    //init
    setBtnControl();

    url = getCurrentUrl();

    token = getQuerystring('token', false);
    if (token === false) {
        var created = createNewGame();
    }
    var fen = null;
    if (created) {
        fen = getLastFENfromServer();
    }
    
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