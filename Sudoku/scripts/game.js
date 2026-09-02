(function(root,factory){
'use strict';
const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.SudokuGame=api;
}(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const SIZE=9;
const EMPTY_CELLS=Object.freeze({easy:36,medium:45,hard:52});

function assertGrid(grid){
 if(!Array.isArray(grid)||grid.length!==SIZE)throw new TypeError('Grid must contain nine rows of nine cells.');
 const rows=Array.from({length:SIZE},(_,row)=>grid[row]);
 if(rows.some(row=>!Array.isArray(row)||row.length!==SIZE))throw new TypeError('Grid must contain nine rows of nine cells.');
 const cells=rows.flatMap(row=>Array.from({length:SIZE},(_,column)=>row[column]));
 if(cells.some(value=>!Number.isInteger(value)||value<0||value>SIZE))throw new TypeError('Grid cells must be integers from 0 to 9.');
}
function assertCell(row,column){if(!Number.isInteger(row)||row<0||row>=SIZE||!Number.isInteger(column)||column<0||column>=SIZE)throw new RangeError('Cell must be inside the grid.');}
function cloneGrid(grid){assertGrid(grid);return grid.map(row=>[...row]);}
function shuffle(items,random=Math.random){
 const result=[...items];
 for(let index=result.length-1;index>0;index--){const sample=Number(random()),swapIndex=Math.floor(Math.max(0,Math.min(.9999999999999999,Number.isFinite(sample)?sample:0))*(index+1));[result[index],result[swapIndex]]=[result[swapIndex],result[index]];}
 return result;
}
function generateSolution(random=Math.random){
 const pattern=(row,column)=>(row*3+Math.floor(row/3)+column)%SIZE;
 const rows=shuffle([0,1,2],random).flatMap(group=>shuffle([0,1,2],random).map(row=>group*3+row));
 const columns=shuffle([0,1,2],random).flatMap(group=>shuffle([0,1,2],random).map(column=>group*3+column));
 const numbers=shuffle([1,2,3,4,5,6,7,8,9],random);
 return rows.map(row=>columns.map(column=>numbers[pattern(row,column)]));
}
function createPuzzle(difficulty,random=Math.random){
 if(!Object.hasOwn(EMPTY_CELLS,difficulty))throw new TypeError('Difficulty must be easy, medium, or hard.');
 const completed=generateSolution(random),playable=completed.map(row=>[...row]);
 shuffle(Array.from({length:SIZE*SIZE},(_,index)=>index),random).slice(0,EMPTY_CELLS[difficulty]).forEach(index=>{playable[Math.floor(index/SIZE)][index%SIZE]=0;});
 return{completed,playable};
}
function sameBox(rowA,columnA,rowB,columnB){return Math.floor(rowA/3)===Math.floor(rowB/3)&&Math.floor(columnA/3)===Math.floor(columnB/3);}
function placementValid(grid,row,column,value){
 for(let index=0;index<SIZE;index++){if(index!==column&&grid[row][index]===value)return false;if(index!==row&&grid[index][column]===value)return false;}
 const boxRow=Math.floor(row/3)*3,boxColumn=Math.floor(column/3)*3;
 for(let rowIndex=boxRow;rowIndex<boxRow+3;rowIndex++)for(let columnIndex=boxColumn;columnIndex<boxColumn+3;columnIndex++)if((rowIndex!==row||columnIndex!==column)&&grid[rowIndex][columnIndex]===value)return false;
 return true;
}
function isPlacementValid(grid,row,column,value){assertGrid(grid);assertCell(row,column);if(!Number.isInteger(value)||value<1||value>SIZE)return false;return placementValid(grid,row,column,value);}
function createNotes(){return Array.from({length:SIZE},()=>Array.from({length:SIZE},()=>new Set()));}
function removePeerNotes(notes,row,column,number){assertCell(row,column);notes.forEach((noteRow,rowIndex)=>noteRow.forEach((cellNotes,columnIndex)=>{if(rowIndex===row||columnIndex===column||sameBox(row,column,rowIndex,columnIndex))cellNotes.delete(number);}));}
function createSolver(source){
 const grid=cloneGrid(source),emptyCells=[];
 let consistent=true;
 grid.forEach((gridRow,row)=>gridRow.forEach((value,column)=>{if(!value)emptyCells.push({row,column});else if(!placementValid(grid,row,column,value))consistent=false;}));
 return{grid,emptyCells,nextCandidates:Array(emptyCells.length).fill(1),cellIndex:0,attempts:0,backtracks:0,complete:false,unsolvable:!consistent};
}
function stepSolver(solver){
 if(solver.complete)return{type:'complete'};if(solver.unsolvable)return{type:'unsolvable'};
 if(solver.cellIndex===solver.emptyCells.length){solver.complete=true;return{type:'complete'};}
 if(solver.cellIndex<0){solver.unsolvable=true;return{type:'unsolvable'};}
 const cell=solver.emptyCells[solver.cellIndex],candidate=solver.nextCandidates[solver.cellIndex];
 if(candidate>SIZE){solver.grid[cell.row][cell.column]=0;solver.nextCandidates[solver.cellIndex]=1;solver.cellIndex-=1;solver.backtracks+=1;const previous=solver.cellIndex>=0?solver.emptyCells[solver.cellIndex]:null;if(previous)solver.grid[previous.row][previous.column]=0;return{type:'backtrack',cell:{...cell},previous:previous?{...previous}:null};}
 solver.attempts+=1;solver.nextCandidates[solver.cellIndex]=candidate+1;solver.grid[cell.row][cell.column]=candidate;
 if(placementValid(solver.grid,cell.row,cell.column,candidate)){solver.cellIndex+=1;return{type:'accepted',cell:{...cell},candidate};}
 return{type:'rejected',cell:{...cell},candidate};
}

return{SIZE,EMPTY_CELLS,cloneGrid,generateSolution,createPuzzle,sameBox,isPlacementValid,createNotes,removePeerNotes,createSolver,stepSolver};
}));
