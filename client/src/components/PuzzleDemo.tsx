/**
 * Interactive Chess Puzzle Demo
 * A simple puzzle component to showcase the learning experience
 * Uses a visual chess board with clickable squares
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Lightbulb, 
  RotateCcw, 
  ChevronRight,
  Trophy,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// Chess piece unicode characters
const PIECES: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
};

// Sample puzzles with FEN-like positions and solutions
const PUZZLES = [
  {
    id: 1,
    title: "Mate in 1",
    difficulty: "Beginner",
    description: "White to move. Find the checkmate!",
    // Simplified board state (8x8 array, uppercase = white, lowercase = black)
    position: [
      ['r', '.', '.', '.', 'k', '.', '.', 'r'],
      ['p', 'p', 'p', '.', '.', 'p', 'p', 'p'],
      ['.', '.', '.', '.', '.', '.', '.', '.'],
      ['.', '.', '.', '.', '.', '.', '.', '.'],
      ['.', '.', '.', '.', '.', '.', '.', '.'],
      ['.', '.', '.', '.', '.', '.', '.', '.'],
      ['P', 'P', 'P', '.', '.', 'P', 'P', 'P'],
      ['R', '.', '.', '.', 'Q', '.', 'K', '.'],
    ],
    solution: { from: [7, 4], to: [0, 4] }, // Qe8#
    hint: "Look for a back rank weakness",
  },
  {
    id: 2,
    title: "Fork the King and Queen",
    difficulty: "Intermediate",
    description: "White to move. Win material with a knight fork!",
    position: [
      ['r', '.', 'b', '.', 'k', '.', '.', 'r'],
      ['p', 'p', 'p', '.', '.', 'p', 'p', 'p'],
      ['.', '.', 'n', '.', '.', '.', '.', '.'],
      ['.', '.', '.', 'q', '.', '.', '.', '.'],
      ['.', '.', '.', '.', 'N', '.', '.', '.'],
      ['.', '.', '.', '.', '.', '.', '.', '.'],
      ['P', 'P', 'P', '.', '.', 'P', 'P', 'P'],
      ['R', '.', 'B', 'Q', '.', '.', 'K', '.'],
    ],
    solution: { from: [4, 4], to: [2, 3] }, // Nd6+ forking
    hint: "Knights can attack multiple pieces at once",
  },
  {
    id: 3,
    title: "Discovered Attack",
    difficulty: "Advanced",
    description: "White to move. Use a discovered attack to win the queen!",
    position: [
      ['r', '.', 'b', '.', 'k', '.', '.', 'r'],
      ['p', 'p', '.', '.', '.', 'p', 'p', 'p'],
      ['.', '.', '.', '.', '.', '.', '.', '.'],
      ['.', '.', '.', 'q', 'B', '.', '.', '.'],
      ['.', '.', '.', '.', '.', '.', '.', '.'],
      ['.', '.', '.', '.', '.', '.', '.', '.'],
      ['P', 'P', 'P', '.', 'R', 'P', 'P', 'P'],
      ['.', '.', '.', 'Q', '.', '.', 'K', '.'],
    ],
    solution: { from: [5, 4], to: [5, 0] }, // Bxa3+ discovering attack on queen
    hint: "Moving one piece can reveal an attack from another",
  },
];

interface PuzzleDemoProps {
  onClose?: () => void;
}

export function PuzzleDemo({ onClose }: PuzzleDemoProps) {
  const [currentPuzzle, setCurrentPuzzle] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null);
  const [solved, setSolved] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const puzzle = PUZZLES[currentPuzzle];

  const handleSquareClick = (row: number, col: number) => {
    if (solved) return;

    if (selectedSquare === null) {
      // Select a piece
      const piece = puzzle.position[row][col];
      if (piece !== '.' && piece === piece.toUpperCase()) {
        // Only allow selecting white pieces
        setSelectedSquare([row, col]);
      }
    } else {
      // Try to make a move
      const [fromRow, fromCol] = selectedSquare;
      const solution = puzzle.solution;

      if (
        fromRow === solution.from[0] &&
        fromCol === solution.from[1] &&
        row === solution.to[0] &&
        col === solution.to[1]
      ) {
        // Correct move!
        setSolved(true);
        toast.success("Correct! Great tactical vision! 🎉", {
          duration: 3000,
        });
      } else {
        // Wrong move
        setAttempts(prev => prev + 1);
        toast.error("Not quite. Try again!", {
          duration: 2000,
        });
      }
      setSelectedSquare(null);
    }
  };

  const resetPuzzle = () => {
    setSolved(false);
    setSelectedSquare(null);
    setShowHint(false);
    setAttempts(0);
  };

  const nextPuzzle = () => {
    setCurrentPuzzle((prev) => (prev + 1) % PUZZLES.length);
    resetPuzzle();
  };

  const getSquareColor = (row: number, col: number) => {
    const isLight = (row + col) % 2 === 0;
    const isSelected = selectedSquare && selectedSquare[0] === row && selectedSquare[1] === col;
    const isSolutionFrom = solved && puzzle.solution.from[0] === row && puzzle.solution.from[1] === col;
    const isSolutionTo = solved && puzzle.solution.to[0] === row && puzzle.solution.to[1] === col;

    if (isSelected) return "bg-burgundy/40";
    if (isSolutionFrom) return "bg-green-400/40";
    if (isSolutionTo) return "bg-green-500/50";
    return isLight ? "bg-amber-100" : "bg-amber-700";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg"
      >
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-stone dark:bg-secondary/30">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-burgundy/10 text-burgundy font-medium">
                    {puzzle.difficulty}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Puzzle {currentPuzzle + 1} of {PUZZLES.length}
                  </span>
                </div>
                <h3 className="font-semibold mt-1">{puzzle.title}</h3>
              </div>
              {onClose && (
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Chess Board */}
            <div className="p-4 bg-background">
              <div className="aspect-square w-full max-w-sm mx-auto rounded-lg overflow-hidden shadow-lg border-4 border-amber-900">
                <div className="grid grid-cols-8 h-full">
                  {puzzle.position.map((row, rowIndex) =>
                    row.map((piece, colIndex) => (
                      <button
                        key={`${rowIndex}-${colIndex}`}
                        onClick={() => handleSquareClick(rowIndex, colIndex)}
                        className={`
                          aspect-square flex items-center justify-center
                          text-2xl sm:text-3xl font-chess
                          transition-colors cursor-pointer
                          hover:brightness-110
                          ${getSquareColor(rowIndex, colIndex)}
                          ${piece !== '.' && piece === piece.toUpperCase() ? 'hover:ring-2 hover:ring-burgundy/50 hover:ring-inset' : ''}
                        `}
                        disabled={solved}
                      >
                        {piece !== '.' && (
                          <span className={piece === piece.toUpperCase() ? 'text-white drop-shadow-md' : 'text-gray-900'}>
                            {PIECES[piece]}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Description & Controls */}
            <div className="p-4 border-t border-border bg-stone dark:bg-secondary/30">
              <p className="text-sm text-muted-foreground mb-4">
                {puzzle.description}
              </p>

              {showHint && !solved && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 rounded-lg bg-burgundy/10 text-burgundy text-sm flex items-start gap-2"
                >
                  <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{puzzle.hint}</span>
                </motion.div>
              )}

              {solved && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm flex items-center gap-2"
                >
                  <Trophy className="w-4 h-4" />
                  <span>
                    Solved in {attempts + 1} {attempts === 0 ? 'attempt' : 'attempts'}! +50 XP
                  </span>
                </motion.div>
              )}

              <div className="flex gap-2">
                {!solved && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowHint(true)}
                      disabled={showHint}
                      className="gap-1"
                    >
                      <Lightbulb className="w-4 h-4" />
                      Hint
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetPuzzle}
                      className="gap-1"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset
                    </Button>
                  </>
                )}
                {solved && (
                  <Button
                    size="sm"
                    onClick={nextPuzzle}
                    className="bg-burgundy hover:bg-burgundy/90 text-white gap-1"
                  >
                    Next Puzzle
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// Trigger button component
export function PuzzleDemoTrigger() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Trophy className="w-4 h-4" />
        Try a Puzzle
      </Button>
      <AnimatePresence>
        {isOpen && <PuzzleDemo onClose={() => setIsOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
