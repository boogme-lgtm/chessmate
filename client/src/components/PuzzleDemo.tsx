/**
 * Interactive Chess Puzzle Demo - Powered by Lichess
 * Fetches real puzzles from Lichess API
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Lightbulb, 
  RotateCcw, 
  ChevronRight,
  Trophy,
  X,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// Chess piece unicode characters
const PIECES: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
};

interface PuzzleDemoTriggerProps {
  onClose?: () => void;
}

// Convert FEN string to 8x8 board array
function fenToBoard(fen: string): string[][] {
  const rows = fen.split(' ')[0].split('/');
  return rows.map(row => {
    const squares: string[] = [];
    for (const char of row) {
      if (char >= '1' && char <= '8') {
        // Empty squares
        squares.push(...Array(parseInt(char)).fill('.'));
      } else {
        squares.push(char);
      }
    }
    return squares;
  });
}

// Convert algebraic notation (e.g., "e2e4") to board coordinates
function algebraicToCoords(move: string): { from: [number, number], to: [number, number] } {
  const files = 'abcdefgh';
  const from = [8 - parseInt(move[1]), files.indexOf(move[0])];
  const to = [8 - parseInt(move[3]), files.indexOf(move[2])];
  return { from: from as [number, number], to: to as [number, number] };
}

export function PuzzleDemoTrigger({ onClose }: PuzzleDemoTriggerProps) {
  const [showPuzzle, setShowPuzzle] = useState(false);
  const [difficulty, setDifficulty] = useState<"easiest" | "easier" | "normal" | "harder" | "hardest">("normal");

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        onClick={() => setShowPuzzle(true)}
        className="gap-2"
      >
        <Trophy className="w-5 h-5" />
        Try a Puzzle
      </Button>

      <AnimatePresence>
        {showPuzzle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPuzzle(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl"
            >
              <PuzzleDemo 
                difficulty={difficulty}
                onDifficultyChange={setDifficulty}
                onClose={() => {
                  setShowPuzzle(false);
                  onClose?.();
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

interface PuzzleDemoProps {
  difficulty: "easiest" | "easier" | "normal" | "harder" | "hardest";
  onDifficultyChange: (difficulty: "easiest" | "easier" | "normal" | "harder" | "hardest") => void;
  onClose: () => void;
}

export function PuzzleDemo({ difficulty, onDifficultyChange, onClose }: PuzzleDemoProps) {
  const [board, setBoard] = useState<string[][]>([]);
  const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null);
  const [movesMade, setMovesMade] = useState<string[]>([]);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [currentPuzzle, setCurrentPuzzle] = useState<any>(null);

  const { data: puzzleData, isLoading, refetch } = trpc.puzzle.getNext.useQuery(
    { difficulty },
    { enabled: true }
  );

  useEffect(() => {
    if (puzzleData) {
      setCurrentPuzzle(puzzleData);
      setBoard(fenToBoard(puzzleData.puzzle.initialPly?.fen || puzzleData.game.fen));
      setMovesMade([]);
      setPuzzleSolved(false);
      setShowHint(false);
      setSelectedSquare(null);
    }
  }, [puzzleData]);

  const handleSquareClick = (row: number, col: number) => {
    if (puzzleSolved || !currentPuzzle) return;

    if (selectedSquare) {
      // Attempt to make a move
      const move = `${String.fromCharCode(97 + selectedSquare[1])}${8 - selectedSquare[0]}${String.fromCharCode(97 + col)}${8 - row}`;
      
      const nextMoveIndex = movesMade.length;
      const expectedMove = currentPuzzle.puzzle.solution[nextMoveIndex];

      if (move === expectedMove || move === expectedMove?.substring(0, 4)) {
        // Correct move!
        const newBoard = board.map(r => [...r]);
        newBoard[row][col] = newBoard[selectedSquare[0]][selectedSquare[1]];
        newBoard[selectedSquare[0]][selectedSquare[1]] = '.';
        setBoard(newBoard);
        setMovesMade([...movesMade, move]);
        setSelectedSquare(null);

        if (nextMoveIndex + 1 >= currentPuzzle.puzzle.solution.length) {
          // Puzzle solved!
          setPuzzleSolved(true);
          toast.success("Puzzle solved! Well done!");
        } else {
          toast.success("Correct move!");
        }
      } else {
        // Wrong move
        toast.error("Not quite! Try again.");
        setSelectedSquare(null);
      }
    } else {
      // Select a piece
      if (board[row][col] !== '.') {
        setSelectedSquare([row, col]);
      }
    }
  };

  const handleReset = () => {
    if (currentPuzzle) {
      setBoard(fenToBoard(currentPuzzle.puzzle.initialPly?.fen || currentPuzzle.game.fen));
      setMovesMade([]);
      setPuzzleSolved(false);
      setShowHint(false);
      setSelectedSquare(null);
    }
  };

  const handleNewPuzzle = () => {
    refetch();
  };

  const handleShowHint = () => {
    if (!currentPuzzle) return;
    const nextMove = currentPuzzle.puzzle.solution[movesMade.length];
    if (nextMove) {
      const coords = algebraicToCoords(nextMove);
      toast.info(`Hint: Move from ${String.fromCharCode(97 + coords.from[1])}${8 - coords.from[0]} to ${String.fromCharCode(97 + coords.to[1])}${8 - coords.to[0]}`);
      setShowHint(true);
    }
  };

  if (isLoading || !currentPuzzle) {
    return (
      <Card className="bg-background/95 border-border">
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center gap-4 min-h-[400px]">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading puzzle from Lichess...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const puzzleRating = currentPuzzle.puzzle.rating;
  const puzzleThemes = currentPuzzle.puzzle.themes || [];

  return (
    <Card className="bg-background/95 border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h3 className="text-2xl font-light">Chess Puzzle</h3>
            <Badge variant="outline" className="text-sm">
              Rating: {puzzleRating}
            </Badge>
            <select
              value={difficulty}
              onChange={(e) => onDifficultyChange(e.target.value as any)}
              className="px-3 py-1 rounded-md bg-background border border-border text-sm"
            >
              <option value="easiest">Easiest</option>
              <option value="easier">Easier</option>
              <option value="normal">Normal</option>
              <option value="harder">Harder</option>
              <option value="hardest">Hardest</option>
            </select>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex gap-6 flex-col lg:flex-row">
          {/* Chess Board */}
          <div className="flex-1">
            <div className="grid grid-cols-8 gap-0 w-full max-w-[500px] mx-auto aspect-square border-2 border-border">
              {board.map((row, rowIndex) =>
                row.map((piece, colIndex) => {
                  const isLight = (rowIndex + colIndex) % 2 === 0;
                  const isSelected = selectedSquare?.[0] === rowIndex && selectedSquare?.[1] === colIndex;
                  
                  return (
                    <button
                      key={`${rowIndex}-${colIndex}`}
                      onClick={() => handleSquareClick(rowIndex, colIndex)}
                      disabled={puzzleSolved}
                      className={`
                        relative flex items-center justify-center text-4xl transition-all
                        ${isLight ? 'bg-stone-300' : 'bg-stone-600'}
                        ${isSelected ? 'ring-4 ring-primary' : ''}
                        ${!puzzleSolved ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}
                        ${puzzleSolved ? 'opacity-60' : ''}
                      `}
                    >
                      {piece !== '.' && PIECES[piece]}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Puzzle Info */}
          <div className="flex-1 space-y-4">
            <div>
              <h4 className="text-lg font-medium mb-2">Themes</h4>
              <div className="flex flex-wrap gap-2">
                {puzzleThemes.map((theme: string) => (
                  <Badge key={theme} variant="secondary" className="text-xs">
                    {theme}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-lg font-medium mb-2">Progress</h4>
              <p className="text-sm text-muted-foreground">
                Moves: {movesMade.length} / {currentPuzzle.puzzle.solution.length}
              </p>
            </div>

            {puzzleSolved && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="p-4 bg-primary/10 border border-primary rounded-lg"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  <h4 className="font-medium">Puzzle Solved!</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Great job! Ready for another challenge?
                </p>
              </motion.div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={handleShowHint}
                disabled={puzzleSolved || showHint}
                className="w-full gap-2"
              >
                <Lightbulb className="w-4 h-4" />
                Show Hint
              </Button>

              <Button
                variant="outline"
                onClick={handleReset}
                disabled={movesMade.length === 0}
                className="w-full gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>

              <Button
                onClick={handleNewPuzzle}
                className="w-full gap-2"
              >
                <ChevronRight className="w-4 h-4" />
                New Puzzle
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Puzzles powered by{" "}
              <a
                href="https://lichess.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Lichess
              </a>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
