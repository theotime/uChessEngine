<?php

/**
 * 
 * game.php - µChessEngine Server
 *
 *
 */
///// CONSTANTS /////
define('SAVEDIR', '/home/theo/uChessEngine/saves/');
define('TIMEOUT', 900); //in seconds = 15 minutes
define('MAXFILES', 10000); 

//Filename
define('COUNTNAME', 'count');
define('TSNAME', 'timestamp');

class Utils {

    function __construct() {
        
    }

    public function generateToken($length = 7) {
        $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        $charactersLength = strlen($characters) - 1;
        $token = '';

        //select some random characters
        for ($i = 0; $i < $length; $i++) {
            $token .= $characters[mt_rand(0, $charactersLength)];
        }

        return $token;
    }

    public function post($input) {
        if (isset($_POST[$input])) {
            return $_POST[$input];
        } else {
            return false;
        }
    }

    public function get($input) {
        if (isset($_GET[$input])) {
            return $_GET[$input];
        } else {
            return false;
        }
    }

    public function session($input, $set = '__NOINPUT__') {
        if ($set !== '__NOINPUT__') {
            $_SESSION[$input] = $set;
            return;
        }

        if (isset($_SESSION[$input])) {
            return $_SESSION[$input];
        } else {
            return false;
        }
    }

}

class GarbageCollector {

    private $ts;

    function __construct() {
        $now = time();
        $filename = SAVEDIR . TSNAME;
        if (!file_exists($filename)) {
            file_put_contents($filename, $now);
            $this->ts = 0;
        } else {
            $last = file_get_contents($filename);
            $this->ts = $now - $last;
        }
    }

    public function clean() {
        if ($this->ts > (4 * TIMEOUT)) {
            register_shutdown_function(array(&$this, 'cleanSaveDirectory'));
            $now = time();
            $filename = SAVEDIR . TSNAME;
            file_put_contents($filename, $now);
        }
    }

    public function cleanSaveDirectory() {
        $dh = opendir(SAVEDIR);
        while (false !== ($filename = readdir($dh))) {
            $save = json_decode(file_get_contents(SAVEDIR . $filename));

            $now = time();
            if (is_object($save) AND (($now - $save->lastupdate) > TIMEOUT)) {
                unlink(SAVEDIR . $filename);
            }
        }
        closedir($dh);
    }

    public function isOverride() {
        $filename = SAVEDIR . COUNTNAME;
        if (!file_exists($filename)) {
            file_put_contents($filename, 0);
            $count = 0;
            return false;
        } else {
            $count = file_get_contents($filename);
        }
        return ($count > MAXFILES) ? true : false;
    }

    public function autoIncrement() {
        $filename = SAVEDIR . COUNTNAME;
        $count = file_get_contents($filename);
        $count++;
        file_put_contents($filename, $count);
    }

}

class ChessEngine {

    private $utils = null;
    private $chess = null;
    private $gc = null;
    //json representation of the game.
    private $save = null;

    function __construct() {
        require_once 'Games/Chess/Standard.php';
        $this->chess = new Games_Chess_Standard;
        $this->utils = new Utils();
        $this->gc = new GarbageCollector();
        $this->gc->clean();
        session_start();
    }

    public function main() {
        $token = $this->utils->get('token');
        $move = $this->utils->get('move');
        $action = $this->utils->get('action');

        if ($token === false AND $move === false) {
            $this->newgame();
            return;
        }

        if ($token !== false AND $action === 'close') {
            $this->closegame($token);
            return;
        }

        if ($token !== false AND $move === false) {
            $this->getlastupdate($token);
            return;
        }

        if ($token !== false AND $move !== false) {
            $this->postnewmove($token, $move);
            return;
        }
    }

    /////////////////
    /// Controllers
    /////////////////

    /**
     * GET game.php
     * 
     */
    private function newgame() {
        if ($this->gc->isOverride()) {
            echo json_encode(array('return' => 'fail', 'message' => 'The server cannot create the party, re-try in ' . round((4 * TIMEOUT) / 60 / 60) . 'h.'));
            return false;
        }

        $token = COUNTNAME;
        while ($this->isTokenExist($token)) {
            $token = $this->utils->generateToken();
        }

        $this->createNewGame();
        $this->gc->autoIncrement();
        $this->saveFEN($token);
        $this->utils->session($token, 'W');
        echo json_encode(array('return' => 'success', 'token' => $token));
    }

    /**
     * GET game.php?action=close
     * @param type $token
     * @return type
     */
    private function closegame($token) {
        if (!$this->isTokenExist($token)) {
            echo json_encode(array('return' => 'fail', 'message' => 'Invalid token.'));
            return;
        }
        if (!$this->utils->session($token)) {
            echo json_encode(array('return' => 'fail', 'message' => 'You are spectator.'));
            return;
        }
        $this->utils->session($token, false);
        $this->removeGame($token);
        echo json_encode(array('return' => 'success'));
    }

    /**
     * GET game.php
     * @param type $token
     * @return type
     */
    private function getlastupdate($token) {
        if (!$this->isTokenExist($token)) {
            echo json_encode(array('return' => 'fail', 'message' => 'The game has closed.'));
            return;
        }
        $fen = $this->getFEN($token);

        $now = time();
        if ((($now - $this->getLastTime($token)) > TIMEOUT) AND ($this->chess->toMove() !== $this->utils->session($token))) {
            $this->removeGame($token);
            echo json_encode(array('return' => 'fail', 'message' => 'Timeout : your opponent is probably gone!'));
            return;
        }

        //The next players connecting to the game are spectators
        if ($this->utils->session($token) === false && $this->getPlayersInGame($token) == 'wb') {
            echo json_encode(array('return' => 'success', 'fen' => $fen, 'color' => 's'));
            return;
        }

        // first connection for black player?
        if ($this->utils->session($token) === false && $this->getPlayersInGame($token) == 'w') {
            $this->utils->session($token, 'B');
            $this->setPlayersInGame($token, 'b');
        }
        $c = strtolower($this->utils->session($token));
        echo json_encode(array('return' => 'success', 'fen' => $fen, 'color' => $c));
    }

    /**
     * GET game.php
     * @param type $token
     * @param type $move
     * @return type
     */
    private function postnewmove($token, $move) {
        if (!$this->isTokenExist($token)) {
            echo json_encode(array('return' => 'fail', 'message' => 'Invalid token.'));
            return;
        }
        $this->chess->resetGame($this->getFEN($token));
        if ($this->chess->toMove() !== $this->utils->session($token)) {
            echo json_encode(array('return' => 'fail', 'message' => 'Not your turn.'));
            return;
        }
        $move = str_replace(array('+', '#'), '', $move);
        $err = $this->chess->moveSAN($move);
        if ($this->chess->isError($err)) {
            echo json_encode(array('return' => 'fail', 'message' => $err->getMessage()));
            return;
        } else {
            $this->saveFEN($token);
            echo json_encode(array('return' => 'success'));
        }
    }

    /////////////////
    /// Core System
    /////////////////
    private function isTokenExist($token) {
        return file_exists(SAVEDIR . $token);
    }

    private function removeGame($token) {
        unlink(SAVEDIR . $token);
    }

    private function createNewGame() {
        $this->chess->resetGame();
        $this->save = new StdClass();
        $this->save->FEN = "";
        $this->save->ig_players = "w"; //Default
        $this->save->lastupdate = time();
    }

    private function writeSave($token) {
        $this->save->lastupdate = time();
        return file_put_contents(SAVEDIR . $token, json_encode($this->save));
    }

    private function saveFEN($token) {
        if ($this->save === null) {
            $this->save = json_decode(file_get_contents(SAVEDIR . $token));
        }
        $this->save->FEN = $this->chess->renderFen();
        return $this->writeSave($token);
    }

    private function getFEN($token) {
        if ($this->save === null) {
            $this->save = json_decode(file_get_contents(SAVEDIR . $token));
        }
        return $this->save->FEN;
    }

    private function getPlayersInGame($token) {
        if ($this->save === null) {
            $this->save = json_decode(file_get_contents(SAVEDIR . $token));
        }
        return $this->save->ig_players;
    }

    private function setPlayersInGame($token, $player) {
        if ($this->save === null) {
            $this->save = json_decode(file_get_contents(SAVEDIR . $token));
        }
        $this->save->ig_players .= $player;
        return $this->writeSave($token);
    }

    private function getLastTime($token) {
        if ($this->save === null) {
            $this->save = json_decode(file_get_contents(SAVEDIR . $token));
        }
        return $this->save->lastupdate;
    }

}

$engine = new ChessEngine();
$engine->main();