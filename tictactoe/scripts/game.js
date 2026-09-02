(function(root,factory){
'use strict';
const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.TicTacToeGame=api;
}(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const WINNING_LINES=Object.freeze([
    Object.freeze([0,1,2]),Object.freeze([3,4,5]),Object.freeze([6,7,8]),
    Object.freeze([0,3,6]),Object.freeze([1,4,7]),Object.freeze([2,5,8]),
    Object.freeze([0,4,8]),Object.freeze([2,4,6])
]);
const MARKS=Object.freeze(['X','O']);

function assertBoard(board){if(!Array.isArray(board)||board.length!==9||Array.from({length:9},(_,cell)=>board[cell]).some(mark=>mark!==null&&!MARKS.includes(mark)))throw new TypeError('Board must contain nine X, O, or null cells.');}
function assertSide(side){if(side!==0&&side!==1)throw new TypeError('Side must be 0 or 1.');}
function outcome(board){const line=WINNING_LINES.find(candidate=>board[candidate[0]]&&candidate.every(cell=>board[cell]===board[candidate[0]]))||null,winner=line?MARKS.indexOf(board[line[0]]):null,draw=!line&&board.every(Boolean);return{over:Boolean(line)||draw,winner,winningLine:line?[...line]:[],draw};}
function createBoard(){return Array(9).fill(null);}
function evaluate(board){assertBoard(board);return outcome(board);}
function winningLine(board){const line=evaluate(board).winningLine;return line.length?line:null;}
function availableMoves(board){assertBoard(board);if(outcome(board).over)return[];return board.flatMap((mark,cell)=>mark===null?[cell]:[]);}
function play(board,cell,side){assertBoard(board);assertSide(side);if(outcome(board).over||!Number.isInteger(cell)||cell<0||cell>8||board[cell]!==null)return null;const next=board.slice();next[cell]=MARKS[side];return{board:next,...outcome(next)};}
function minimax(board,turn,maximizingSide,depth,cache){const result=outcome(board);if(result.over)return result.draw?0:result.winner===maximizingSide?10-depth:depth-10;const key=`${board.map(mark=>mark||'-').join('')}:${turn}`;if(cache.has(key))return cache.get(key);const maximize=turn===maximizingSide;let best=maximize?-Infinity:Infinity;for(const cell of availableMoves(board)){const next=board.slice();next[cell]=MARKS[turn];const score=minimax(next,1-turn,maximizingSide,depth+1,cache);best=maximize?Math.max(best,score):Math.min(best,score);}cache.set(key,best);return best;}
function bestMove(board,side=1){assertBoard(board);assertSide(side);const moves=availableMoves(board);if(!moves.length)return null;const cache=new Map();let choice=moves[0],best=-Infinity;for(const cell of moves){const next=board.slice();next[cell]=MARKS[side];const score=minimax(next,1-side,side,0,cache);if(score>best){best=score;choice=cell;}}return choice;}

return{WINNING_LINES,MARKS,createBoard,evaluate,winningLine,availableMoves,play,bestMove};
}));
