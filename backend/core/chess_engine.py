import chess

class ChessEngine:
    @staticmethod
    def validate_move(fen: str, move_str: str, turn: str) -> dict:
        """
        Validates if a move is legal on the board corresponding to the given FEN.
        Args:
            fen: The board state as a FEN string.
            move_str: The move to play, either in SAN (e.g., "e4", "Nf3") or UCI (e.g., "e2e4").
            turn: The player attempting the move ("white" or "black").
        Returns:
            A dictionary with the keys:
            - isValid: bool indicating if the move is legal.
            - newBoardState: the new FEN string if valid.
            - appliedMove: the move in SAN format if valid.
            - rejectionReason: explanation string if invalid.
        """
        try:
            board = chess.Board(fen)
        except ValueError:
            return {"isValid": False, "rejectionReason": "Invalid FEN board state"}
        
        # Check turn
        expected_turn = "white" if board.turn == chess.WHITE else "black"
        if turn.lower() != expected_turn:
            return {
                "isValid": False,
                "rejectionReason": f"It is {expected_turn}'s turn, but {turn} attempted to move"
            }
        
        # Try to parse the move (first as SAN, then as UCI)
        move = None
        try:
            move = board.parse_san(move_str)
        except ValueError:
            try:
                move = board.parse_uci(move_str)
            except ValueError:
                return {"isValid": False, "rejectionReason": f"Invalid move notation: {move_str}"}
        
        if move not in board.legal_moves:
            return {"isValid": False, "rejectionReason": f"Illegal move: {move_str}"}
        
        # Apply the move and get details
        san_move = board.san(move)
        board.push(move)
        
        return {
            "isValid": True,
            "newBoardState": board.fen(),
            "appliedMove": san_move
        }

    @staticmethod
    def detect_status(fen: str) -> dict:
        """
        Analyzes the board FEN and returns flags for current check/mate/draw statuses.
        """
        try:
            board = chess.Board(fen)
        except ValueError:
            return {"status": "error", "message": "Invalid FEN board state"}
            
        is_check = board.is_check()
        is_checkmate = board.is_checkmate()
        is_stalemate = board.is_stalemate()
        is_insufficient_material = board.is_insufficient_material()
        is_fivefold_repetition = board.is_fivefold_repetition()
        is_seventyfive_moves = board.is_seventyfive_moves()
        
        # General draw check (game over without mate)
        is_draw = board.is_game_over() and not board.is_checkmate()
        
        return {
            "isCheck": is_check,
            "isCheckmate": is_checkmate,
            "isStalemate": is_stalemate,
            "isDraw": is_draw,
            "insufficientMaterial": is_insufficient_material,
            "repetition": is_fivefold_repetition,
            "seventyFiveMoves": is_seventyfive_moves
        }
