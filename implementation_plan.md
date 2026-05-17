# Plan de Implementación - Ajedrez en Línea (Fases 1-5)

Este plan detalla los pasos para completar la implementación del juego de ajedrez en línea en la base de código actual. Basándome en la auditoría inicial y el estado real del repositorio, he expandido y completado la ruta con cambios técnicos detallados y precisos.

---

## User Review Required

> [!IMPORTANT]
> 1. **python-chess:** Se agregará `python-chess` al `backend/requirements.txt` y se instalará en el entorno virtual. Este motor backend será la autoridad única sobre las reglas de ajedrez y el estado de la partida.
> 2. **Arquitectura de Tiempo Real (WebSockets):** Crearemos un endpoint de WebSocket en `backend/routers/match.py` (`/api/match/{matchID}/ws`) con validación de tokens. Los movimientos se enviarán mediante HTTP `POST /api/match/{matchID}/move` y se notificarán en tiempo real al oponente a través del canal de WebSocket. Esto es extremadamente confiable y fácil de depurar.
> 3. **Matchmaking en Segundo Plano:** Implementaremos un bucle asíncrono continuo en el backend de FastAPI que se ejecute en segundo plano, emparejando a los usuarios según su ELO y el tiempo transcurrido en cola (el rango de emparejamiento se expandirá progresivamente).
> 4. **Mismatches y Bugs Identificados:**
>    - En `MatchmakingPage.jsx`, la redirección al encontrar partida navegaba erróneamente a `/play` (redireccionando de vuelta a la cola) en lugar de `/play/${matchID}`.
>    - En `FriendsPage.jsx`, el endpoint de rechazar amigo llamaba a `DELETE /friends/reject?targetID=${id}` en lugar de `DELETE /friends/${id}/reject`.
>    - `MatchService` carecía de los métodos `join_match` y `decline_invite` requeridos por los routers de invitaciones de juego.

---

## Proposed Changes

### Componente 1: Backend Core y Motor de Ajedrez

#### [NEW] [chess_engine.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/core/chess_engine.py)
- Crear el validador estático utilizando `python-chess`.
- Métodos clave:
  - `validate_move(fen: str, move_str: str, turn: str) -> dict`: Valida si una jugada dada (en formato SAN o UCI) es legal. Si lo es, devuelve el nuevo FEN y el movimiento aplicado en SAN. Si no, devuelve el motivo de rechazo.
  - `detect_status(fen: str) -> dict`: Retorna si hay jaque, jaque mate, tablas (por ahogado, material insuficiente, triple repetición, regla de 50 jugadas), etc.

#### [MODIFY] [requirements.txt](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/requirements.txt)
- Agregar `python-chess==1.10.0` para la lógica del ajedrez en backend.

#### [MODIFY] [match_service.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/services/match_service.py)
- Actualizar `make_move` para:
  1. Reconstruir el tablero de `chess.Board` reproduciendo la lista de movimientos guardada en `match.movimientos_pgn`.
  2. Determinar de quién es el turno ("white" o "black") basándose en el color del jugador actual en la partida.
  3. Validar el movimiento del jugador usando `ChessEngine.validate_move`.
  4. Si es válido, actualizar `movimientos_pgn` en la base de datos.
  5. Retornar el nuevo estado de la partida y flags de Jaque/Mate/Tablas.

---

### Componente 2: WebSocket y Tiempo Real

#### [NEW] [websocket_manager.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/core/websocket_manager.py)
- Administrador de conexiones en memoria para WebSockets, permitiendo registrar canales WebSocket por cada `match_id` activo y realizar transmisiones instantáneas (`broadcast_to_match`).

#### [MODIFY] [match.py (Router)](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/routers/match.py)
- Crear el endpoint `/api/match/{matchID}/ws` que:
  - Valide la conexión (autenticación opcional mediante parámetro de consulta `token`).
  - Registre la sesión en el `websocket_manager`.
  - Escuche eventos o mantenga viva la conexión hasta que ocurra una desconexión.
- Modificar el endpoint `make_move` existente para que, al procesar un movimiento exitoso, use `websocket_manager.broadcast_to_match` para enviar a ambos jugadores la actualización:
  ```json
  {
    "type": "move_made",
    "move": "e4",
    "board_state": "new_fen...",
    "is_checkmate": false,
    "is_draw": false,
    "turn": "black"
  }
  ```

#### [MODIFY] [GamePage.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/pages/GamePage.jsx)
- Establecer una conexión WebSocket persistente al montar el componente: `ws://localhost:8000/api/match/${matchId}/ws`.
- Al realizar una jugada en `onDrop`:
  - Enviar una petición POST a `/api/match/${matchId}/move` con el movimiento en formato UCI (ej. `"e2e4"`).
  - Si la petición falla, revertir la jugada localmente.
- Escuchar los eventos WebSocket de tipo `"move_made"` para actualizar el tablero de ajedrez local (`game.load(fen)`) y renderizar el movimiento del oponente al instante.
- Escuchar eventos `"match_ended"` para redirigir automáticamente a la pantalla de resultados con el estado final.

---

### Componente 3: Matchmaking Automatizado

#### [MODIFY] [matchmaking_service.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/services/matchmaking_service.py)
- Guardar en las colas en memoria no solo el `user_id`, sino un diccionario con `{ "user_id": user_id, "rating": rating, "joined_at": datetime }`.
- Mantener un registro global en memoria de emparejamientos resueltos: `_matches: Dict[int, int]` (usuario_id -> match_id).
- Método `try_match_players(mode: MatchType) -> Optional[dict]`:
  - Recorrer la cola de jugadores.
  - Para cada par, verificar si su diferencia de ELO está dentro de un umbral.
  - El umbral de ELO inicial es de 100 y se expande en 50 puntos por cada 5 segundos de espera transcurridos.
  - Al hacer match, eliminar a ambos jugadores de la cola y crear el registro de la partida en la base de datos (con asignación aleatoria de blancas/negras).
  - Registrar el match en `_matches`.
- Método `get_status(user_id: int) -> dict`:
  - Si el usuario está en `_matches`, devolver `{"status": "matched", "matchID": match_id}` y remover la entrada. De lo contrario, devolver `{"status": "searching"}`.

#### [MODIFY] [main.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/main.py)
- Iniciar una tarea asíncrona de fondo en el evento `startup` (`asyncio.create_task`) que se ejecute continuamente cada 3 segundos, llamando a la lógica de emparejamiento para todas las colas de juego activas.

#### [MODIFY] [MatchmakingPage.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/pages/MatchmakingPage.jsx)
- Corregir el bug de redirección: en el poller de estado, cambiar `navigate('/play')` por `navigate(`/play/${data.matchID}`)`.

---

### Componente 4: Corrección de Invitaciones e Integración Social

#### [MODIFY] [match_service.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/services/match_service.py)
- Implementar `join_match(match_id: int, user_id: int)`:
  - Recuperar la partida por ID.
  - Verificar que el estado sea `WAITING` y el usuario sea el invitado (`jugador_negras_id`).
  - Cambiar el estado a `IN_PROGRESS`.
  - Guardar y retornar la partida.
- Implementar `decline_invite(match_id: int, user_id: int)`:
  - Cambiar el estado del match a `CANCELLED`.
  - Guardar.

#### [MODIFY] [match.py (Router)](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/routers/match.py)
- Actualizar `decline_invite` para recibir la sesión y el usuario actual, pasando la solicitud a `service.decline_invite`.

#### [MODIFY] [FriendsPage.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/pages/FriendsPage.jsx)
- Corregir el bug del endpoint al declinar amigo: cambiar `api.delete('/friends/reject?targetID=${id}')` por `api.delete(\`/friends/\${id}/reject\`)`.

---

### Componente 5: Estadísticas, Rendición y Pulido

#### [MODIFY] [match_service.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/services/match_service.py)
- En `end_match`, agregar lógica para actualizar la tabla de estadísticas (`stats_repo`) de ambos usuarios (incrementar victorias/derrotas/partidas jugadas de acuerdo al resultado).
- Notificar el fin de la partida por WebSocket a ambos jugadores enviando un mensaje `"match_ended"`.

#### [MODIFY] [GamePage.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/pages/GamePage.jsx)
- Conectar el botón de "Resign" (Rendirse) para que realice un llamado HTTP `PUT /api/match/${matchId}/end` con la razón `"victory"` para el oponente, en lugar de solo navegar localmente.

---

## Verification Plan

### Automated Tests
- Crear y ejecutar un script de prueba de integración `backend/core/test_integration.py` que valide:
  1. Movimientos válidos e inválidos a través de `ChessEngine`.
  2. Flujo completo de matchmaking e inserción de partidas en la BD de pruebas.

### Manual Verification
- Levantar el servidor backend y el frontend.
- Iniciar sesión con dos usuarios diferentes (abriendo una ventana en incógnito).
- Validar el matchmaking: ambos se unen a la cola "Rapid", se emparejan automáticamente y se les redirige a su respectiva página de juego `/play/{matchId}`.
- Jugar algunos movimientos: verificar que las piezas se muevan en tiempo real en la pantalla del oponente.
- Probar la rendición: al presionar "Resign", ambos jugadores son redirigidos a la pantalla de resultados con el ELO actualizado y la victoria/derrota asignada.
