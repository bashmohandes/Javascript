'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const game=require('../Sudoku/scripts/game');

const solved=[
 [5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],
 [8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],
 [9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9]
];

test('generates deterministic valid solutions and difficulty-sized puzzles',()=>{
 const random=()=>.25,first=game.generateSolution(random),second=game.generateSolution(random);
 assert.deepEqual(first,second);
 for(const row of first)assert.deepEqual([...row].sort(),[1,2,3,4,5,6,7,8,9]);
 for(let column=0;column<9;column++)assert.deepEqual(first.map(row=>row[column]).sort(),[1,2,3,4,5,6,7,8,9]);
 for(const difficulty of Object.keys(game.EMPTY_CELLS)){const{completed,playable}=game.createPuzzle(difficulty,random);assert.equal(playable.flat().filter(value=>!value).length,game.EMPTY_CELLS[difficulty]);playable.flat().forEach((value,index)=>assert.ok(!value||value===completed.flat()[index]));}
 assert.throws(()=>game.createPuzzle('expert',random),/Difficulty/);
});

test('validates grids, placements, and box relationships',()=>{
 const grid=solved.map(row=>[...row]);grid[0][0]=0;
 assert.equal(game.isPlacementValid(grid,0,0,5),true);
 assert.equal(game.isPlacementValid(grid,0,0,3),false);
 assert.equal(game.isPlacementValid(grid,0,0,6),false);
 assert.equal(game.isPlacementValid(grid,0,0,9),false);
 assert.equal(game.sameBox(0,0,2,2),true);assert.equal(game.sameBox(0,0,3,0),false);
 const sparse=Array.from({length:9},()=>Array(9).fill(0));delete sparse[4][4];
 assert.throws(()=>game.cloneGrid(sparse),/integers from 0 to 9/);
 assert.throws(()=>game.cloneGrid(Array(9)),/nine rows of nine cells/);
});

test('removes a placed value only from peer notes',()=>{
 const notes=game.createNotes();notes.forEach(row=>row.forEach(cell=>cell.add(4)));
 game.removePeerNotes(notes,4,4,4);
 assert.equal(notes[4][8].has(4),false);assert.equal(notes[8][4].has(4),false);assert.equal(notes[5][5].has(4),false);assert.equal(notes[0][0].has(4),true);
});

test('stepwise solver completes a puzzle without mutating its input',()=>{
 const puzzle=solved.map(row=>[...row]);[[0,0],[0,1],[1,0],[4,4],[8,8]].forEach(([row,column])=>{puzzle[row][column]=0;});
 const before=puzzle.map(row=>[...row]),solver=game.createSolver(puzzle);let event;
 for(let steps=0;steps<10000&&!solver.complete&&!solver.unsolvable;steps++)event=game.stepSolver(solver);
 assert.deepEqual(puzzle,before);assert.equal(solver.complete,true);assert.equal(solver.unsolvable,false);assert.deepEqual(solver.grid,solved);assert.ok(solver.attempts>0);assert.ok(['accepted','complete'].includes(event.type));
 const invalid=solved.map(row=>[...row]);invalid[0][0]=invalid[0][1];assert.equal(game.stepSolver(game.createSolver(invalid)).type,'unsolvable');
});
