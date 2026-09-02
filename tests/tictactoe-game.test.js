'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const game=require('../tictactoe/scripts/game');

test('creates independent empty boards and validates their shape',()=>{
 const first=game.createBoard(),second=game.createBoard();first[0]='X';
 assert.deepEqual(second,Array(9).fill(null));
 const partiallySparse=Array(9).fill(null);delete partiallySparse[4];
 for(const invalid of [[],Array(8).fill(null),Array(9).fill('Z'),Array(9),partiallySparse])assert.throws(()=>game.evaluate(invalid),/nine X, O, or null cells/);
});

test('detects every winning line for either side',()=>{
 for(const [side,mark] of game.MARKS.entries())for(const line of game.WINNING_LINES){
  const board=game.createBoard();line.forEach(cell=>board[cell]=mark);
  assert.deepEqual(game.evaluate(board),{over:true,winner:side,winningLine:[...line],draw:false});
  assert.deepEqual(game.winningLine(board),[...line]);
 }
 assert.equal(game.winningLine(['X','O','X','X','O','O','O','X','X']),null);
});

test('plays legal moves immutably and identifies wins and draws',()=>{
 const board=['X','X',null,'O','O',null,null,null,null],won=game.play(board,2,0);
 assert.deepEqual(board,['X','X',null,'O','O',null,null,null,null]);
 assert.deepEqual(won,{board:['X','X','X','O','O',null,null,null,null],over:true,winner:0,winningLine:[0,1,2],draw:false});
 assert.equal(game.play(won.board,5,1),null);
 assert.equal(game.play(board,0,1),null);
 assert.equal(game.play(board,9,1),null);
 const draw=game.play(['X','O','X','X','O','O','O','X',null],8,0);
 assert.equal(draw.over,true);assert.equal(draw.draw,true);assert.equal(draw.winner,null);assert.deepEqual(draw.winningLine,[]);
});

test('lists only legal moves and deterministic minimax wins or blocks without mutation',()=>{
 const winning=['X','X',null,'O','O',null,'X',null,null],winningBefore=[...winning];
 assert.deepEqual(game.availableMoves(winning),[2,5,7,8]);
 assert.equal(game.bestMove(winning,1),5);assert.deepEqual(winning,winningBefore);
 const blocking=['X','X',null,null,'O',null,null,null,null],blockingBefore=[...blocking];
 assert.equal(game.bestMove(blocking,1),2);assert.deepEqual(blocking,blockingBefore);
 assert.equal(game.bestMove(['X','O','X','X','O','O','O','X','X'],1),null);
});

test('deterministic O minimax cannot lose against any legal X sequence',()=>{
 function survives(board){
  const result=game.evaluate(board);if(result.over)return result.winner!==0;
  for(const cell of game.availableMoves(board)){
   const afterX=game.play(board,cell,0);if(afterX.winner===0)return false;if(afterX.over)continue;
   const afterO=game.play(afterX.board,game.bestMove(afterX.board,1),1);
   if(!survives(afterO.board))return false;
  }
  return true;
 }
 assert.equal(survives(game.createBoard()),true);
});
