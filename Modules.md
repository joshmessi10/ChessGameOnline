---

# 🚀 Arquitectura General del Sistema

El proyecto está diseñado bajo una arquitectura de **Cliente-Servidor de Dos Capas** desacoplada:

1. **Backend (FastAPI + SQLModel)**:
   - Sigue el patrón arquitectónico **Controller-Service-Repository** (Routers $\rightarrow$ Services $\rightarrow$ Repositories $\rightarrow$ DB Models).
   - Control de base de datos relacional (SQLite local / PostgreSQL en producción) a través de **SQLModel** (que combina la potencia de SQLAlchemy y la validación de Pydantic).
   - Servidor WebSocket integrado para la gestión de partidas, chat y sincronización en tiempo real.
   - Workers asíncronos en segundo plano (`asyncio.create_task`) para procesamiento recurrente como el matchmaking y expiración de turnos.

2. **Frontend (React + Vite + Vanilla CSS)**:
   - Interfaz interactiva de una sola página (SPA) con enrutamiento dinámico mediante `react-router-dom`.
   - Gestión de estado global de la sesión del usuario a través de React Context (`AuthContext`).
   - Conexiones en tiempo real por WebSocket para la interacción en el tablero de juego.

---

# 📦 Desglose Detallado de los Módulos del Sistema

---

## Módulo 1: Autenticación, Sesión y Seguridad (Auth & Session)

* **Objetivo**: Controlar el registro de cuentas, inicio de sesión, autorización y mantenimiento del estado de sesión seguro a lo largo de toda la aplicación.

### ⚙️ Componentes del Código Relacionados:
* **Backend**:
  * **Router**: [auth.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/routers/auth.py), [users.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/routers/users.py)
  * **Servicio**: [auth_service.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/services/auth_service.py), [user_service.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/services/user_service.py)
  * **Repositorio**: [usuario_repository.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/repositories/usuario_repository.py)
  * **Modelo**: [usuario.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/models/usuario.py)
  * **Dependencias**: [dependencies.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/core/dependencies.py) (Provee `CurrentUserDep` que valida los tokens JWT).
* **Frontend**:
  * **Páginas**: [LoginPage.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/pages/LoginPage.jsx), [RegisterPage.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/pages/RegisterPage.jsx)
  * **Componentes**: [ProtectedRoute.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/components/ProtectedRoute.jsx)
  * **Contexto**: [AuthContext.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/context/AuthContext.jsx)
  * **Servicio API**: [auth.js](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/api/auth.js)

### 🔑 Flujo y Reglas de Negocio Críticas:
1. El registro requiere nombre de usuario único, email único y contraseña. La contraseña se hashea en el backend usando algoritmos seguros (bcrypt).
2. El inicio de sesión genera un **JSON Web Token (JWT)** con un tiempo de expiración definido.
3. El frontend almacena este token (usualmente en `localStorage`) y lo envía en el encabezado `Authorization: Bearer <token>` en cada llamada HTTP REST.
4. Las rutas críticas del Frontend están envueltas en `<ProtectedRoute>` que redirige a `/login` si el token no es válido o expiró.

---

### 📝 Propuesta de Historias de Usuario (User Stories):

#### **US-1.1: Registro de Nuevos Jugadores**
> **Como** usuario no registrado  
> **Quiero** crear una cuenta introduciendo mi nombre de usuario, correo electrónico y contraseña  
> **Para** poder acceder a las funciones del juego en línea de ajedrez.
* **Criterios de Aceptación**:
  * **Garantía de Unicidad**: Si el nombre de usuario o el email ya están en uso, el backend debe retornar un código HTTP 400 con un mensaje descriptivo.
  * **Fortaleza de Contraseñas**: La contraseña no se almacena en texto plano; debe ser hasheada antes de persistir en la base de datos.
  * **Validaciones**: El formulario de registro en el frontend debe validar el formato del correo electrónico y obligar a rellenar todos los campos obligatorios.

#### **US-1.2: Inicio de Sesión y Autenticación JWT**
> **Como** jugador registrado  
> **Quiero** iniciar sesión con mis credenciales (nombre de usuario y contraseña)  
> **Para** obtener un token de sesión seguro que me permita interactuar con el backend de forma autenticada.
* **Criterios de Aceptación**:
  * **Validación de Credenciales**: El backend debe retornar un token JWT válido si el usuario y la contraseña coinciden; en caso contrario, un error HTTP 401.
  * **Persistencia del Estado**: Al recargar la página en el frontend, el estado de sesión debe mantenerse si el token local sigue siendo válido (`AuthContext` lee el token al montar).
  * **Expiración de Sesión**: Si el token expira o el backend retorna error de autorización, el usuario debe ser redirigido automáticamente a la pantalla de login.

---

## Módulo 2: Perfil del Jugador y Configuración (Profile & Settings)

* **Objetivo**: Permitir a los jugadores personalizar su cuenta, actualizar sus datos personales, configurar opciones de privacidad y consultar su progreso personal y ELO.

### ⚙️ Componentes del Código Relacionados:
* **Backend**:
  * **Router**: [profile.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/routers/profile.py), [settings.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/routers/settings.py)
  * **Servicio**: [user_service.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/services/user_service.py)
  * **Repositorio**: [usuario_repository.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/repositories/usuario_repository.py), [rating_repository.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/repositories/rating_repository.py), [statistics_repository.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/repositories/statistics_repository.py)
  * **Modelo**: [rating.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/models/rating.py), [statistics.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/models/statistics.py)
* **Frontend**:
  * **Páginas**: [ProfilePage.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/pages/ProfilePage.jsx), [SettingsPage.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/pages/SettingsPage.jsx)

### 🔑 Flujo y Reglas de Negocio Críticas:
1. El perfil del jugador muestra las estadísticas globales acumuladas (victorias, derrotas, empates, partidas jugadas).
2. Muestra los ratings ELO detallados del usuario separados por cada modo de juego: **Bullet**, **Blitz**, **Rapid** y **Classical**.
3. En la pantalla de ajustes, el usuario puede actualizar datos como su avatar, nombre visible o cambiar su contraseña.

---

### 📝 Propuesta de Historias de Usuario (User Stories):

#### **US-2.1: Visualización del Perfil de Jugador**
> **Como** jugador autenticado  
> **Quiero** visualizar mi perfil (o el de otros usuarios) con estadísticas globales de juego  
> **Para** analizar mi progreso, porcentaje de victorias y comparar mi desempeño.
* **Criterios de Aceptación**:
  * **Desglose de Estadísticas**: Debe mostrar el total de partidas jugadas, victorias, derrotas y empates del usuario consultado.
  * **Desglose de ELO**: Debe renderizar el rating numérico actual del jugador para cada una de las modalidades habilitadas (Bullet, Blitz, Rapid, Classical).
  * **Tratamiento Visual**: Las derrotas deben destacarse en color rojo ("DEFEAT") y las victorias de forma diferenciada para facilitar la lectura del historial del jugador.

#### **US-2.2: Modificación de Ajustes de la Cuenta**
> **Como** jugador registrado  
> **Quiero** actualizar la información de mi perfil (como contraseña o nombre de usuario)  
> **Para** mantener mis datos actualizados y asegurar mi cuenta.
* **Criterios de Aceptación**:
  * **Seguridad**: El cambio de contraseña debe exigir introducir la contraseña actual para verificar la identidad del usuario.
  * **Validación**: No se debe permitir cambiar el correo electrónico o nombre de usuario a uno ya registrado por otra persona.

---

## Módulo 3: Red Social y Búsqueda de Jugadores (Social & Friends)

* **Objetivo**: Facilitar la interacción comunitaria permitiendo buscar a otros usuarios, enviar, recibir, aceptar y rechazar solicitudes de amistad para habilitar retos directos.

### ⚙️ Componentes del Código Relacionados:
* **Backend**:
  * **Router**: [friends.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/routers/friends.py), [users.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/routers/users.py)
  * **Servicio**: [friendship_service.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/services/friendship_service.py)
  * **Repositorio**: [friendship_repository.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/repositories/friendship_repository.py)
  * **Modelo**: [friendship.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/models/friendship.py) (Maneja los estados definidos en `FriendshipStatus`: PENDING, ACCEPTED, REJECTED, BLOCKED).
* **Frontend**:
  * **Páginas**: [FriendsPage.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/pages/FriendsPage.jsx), [UserSearchPage.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/pages/UserSearchPage.jsx)
  * **Componentes**: [FriendCard.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/components/FriendCard.jsx)

### 🔑 Flujo y Reglas de Negocio Críticas:
1. Un usuario busca a otro por su nombre a través de un buscador con autocompletado u obtención instantánea de registros.
2. Al presionar "Agregar amigo", se crea un registro de amistad en estado `PENDING`.
3. El destinatario visualiza la solicitud en su bandeja de entrada de amigos. Puede aceptarla (pasa a `ACCEPTED`) o rechazarla/bloquearla.
4. Las listas de amigos diferencian claramente quiénes son amigos mutuos y quiénes son solicitudes pendientes de aceptación.

---

### 📝 Propuesta de Historias de Usuario (User Stories):

#### **US-3.1: Búsqueda Global de Usuarios**
> **Como** jugador autenticado  
> **Quiero** buscar a otros jugadores por su nombre de usuario  
> **Para** poder ver su perfil o enviarles una solicitud de amistad.
* **Criterios de Aceptación**:
  * **Filtros**: El sistema de búsqueda debe ignorar mayúsculas y minúsculas y permitir coincidencias parciales del nombre.
  * **Privacidad**: Un usuario no debería poder auto-enviarse una solicitud de amistad ni interactuar consigo mismo en esta lista.

#### **US-3.2: Gestión del Ciclo de Vida de Amistades**
> **Como** jugador autenticado  
> **Quiero** enviar, aceptar o rechazar solicitudes de amistad  
> **Para** controlar quiénes forman parte de mi red social interna en la aplicación.
* **Criterios de Aceptación**:
  * **Bandeja de Entrada**: La página de amigos debe contar con dos paneles separados: "Amigos activos" y "Solicitudes pendientes".
  * **Acciones en tiempo real**: Al aceptar una solicitud, ambos usuarios pasan inmediatamente al estado de "Amigos", permitiendo que se desafíen mutuamente de forma directa.

---

## Módulo 4: Sistema de Emparejamiento (Matchmaking)

* **Objetivo**: Conectar a jugadores que se encuentran en línea buscando una partida competitiva bajo las mismas reglas y parámetros de tiempo (Bullet, Blitz, Rapid, Classical).

### ⚙️ Componentes del Código Relacionados:
* **Backend**:
  * **Router**: [matchmaking.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/routers/matchmaking.py)
  * **Servicio**: [matchmaking_service.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/services/matchmaking_service.py)
  * **Worker en Background**: [main.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/main.py#L34-L45) (`matchmaking_worker` se ejecuta cada 3 segundos de forma asíncrona para juntar jugadores en espera).
* **Frontend**:
  * **Páginas**: [MatchmakingPage.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/pages/MatchmakingPage.jsx)

### 🔑 Flujo y Reglas de Negocio Críticas:
1. El usuario selecciona un tipo de juego (Bullet, Blitz, Rapid, Classical) y se une a la cola (`POST /api/matchmaking/join`).
2. El frontend muestra una pantalla de carga y realiza peticiones periódicas (o escucha cambios) sobre el estado de su emparejamiento (`GET /api/matchmaking/status`).
3. El worker del backend (`matchmaking_worker`) recorre la cola en memoria/BD agrupando de dos en dos a los usuarios por el mismo tipo de partida y un rango de ELO cercano.
4. Cuando el worker los empareja, crea una partida (`Match`) en estado `IN_PROGRESS`, asignando aleatoriamente quién lleva las piezas blancas y quién las negras.
5. El frontend, al detectar el estado exitoso de emparejamiento con el ID de la partida, redirige a ambos jugadores a la sala de juego `/play/{matchId}` de forma simultánea.

---

### 📝 Propuesta de Historias de Usuario (User Stories):

#### **US-4.1: Unión y Cancelación de la Cola de Matchmaking**
> **Como** jugador competitivo  
> **Quiero** unirme a una cola de emparejamiento seleccionando un ritmo de juego (ej. Blitz 3+2) o salir de ella si decido no jugar  
> **Para** encontrar un oponente balanceado o cancelar la búsqueda si cambio de opinión.
* **Criterios de Aceptación**:
  * **Exclusividad**: Un jugador no puede estar en múltiples colas de matchmaking activas a la vez. Si intenta unirse a otra, se le remueve de la anterior o se le notifica un error.
  * **Salida de la cola**: Si el usuario pulsa "Cancelar", el backend debe removerlo de la lista inmediatamente (`DELETE /api/matchmaking/leave`), impidiendo emparejamientos fantasma.

#### **US-4.2: Redirección Automática al Emparejar**
> **Como** jugador en cola de espera  
> **Quiero** ser redirigido de forma automática y transparente a la sala de juego una vez que el sistema halle un rival  
> **Para** iniciar la partida de inmediato sin retrasos innecesarios.
* **Criterios de Aceptación**:
  * **Sincronización**: Al ser emparejado, el estado en el frontend debe cambiar en menos de 3 segundos para redirigir al jugador a la ruta `/play/{matchId}`.
  * **Asignación de Color**: Uno de los jugadores debe tener asignado el rol de blancas (juega primero) y el otro el de negras de manera equilibrada y transparente.

---

## Módulo 5: Sala de Partida y Tablero en Tiempo Real (Game Play & Real-time)

* **Objetivo**: El núcleo de la aplicación. Maneja el renderizado del tablero de ajedrez, la validación de movimientos válidos, los relojes de tiempo en retroceso, las ofertas de tablas, rendición y la comunicación WebSocket de jugadas.

### ⚙️ Componentes del Código Relacionados:
* **Backend**:
  * **Router**: [match.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/routers/match.py) (Contiene el WebSocket Endpoint `/api/match/{matchID}/ws`).
  * **Servicio**: [match_service.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/services/match_service.py) (Lógica de movimientos, cobro de tiempo por turno, jaque mate, tablas).
  * **Validador de Ajedrez**: `core/chess_engine.py` (Usa el motor de Python `chess`).
* **Frontend**:
  * **Páginas**: [GamePage.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/pages/GamePage.jsx)
  * **Componentes**: [ChessBoard.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/components/ChessBoard.jsx)
  * **Servicio API**: [match.js](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/api/match.js)

### 🔑 Flujo y Reglas de Negocio Críticas:
1. Al entrar en `/play/{matchId}`, el cliente abre una conexión WebSocket persistente contra `/api/match/{matchID}/ws` autenticándose con su JWT.
2. Cada vez que un jugador realiza un movimiento en su interfaz:
   * El cliente realiza un `POST /api/match/{matchID}/move`.
   * El backend valida que la jugada sea legal según las reglas del ajedrez (usando la biblioteca `python-chess`).
   * Si es legal, el backend actualiza el estado del tablero (representado en formato FEN y el historial en formato PGN) en la BD.
   * El backend descuenta el tiempo del reloj del jugador que hizo el movimiento y le suma el incremento correspondiente (ej. +2 segundos).
   * Se difunde la jugada y el nuevo estado del tablero a ambos participantes mediante el **WebSocket Manager**.
3. **Control del Tiempo (Clocks)**: 
   * Mientras la partida esté activa, el backend tiene un sistema de timeout (`check_and_apply_timeout`). Si el tiempo de un jugador llega a 0.0, este pierde automáticamente la partida.
   * El frontend debe simular visualmente el reloj en cuenta regresiva en milisegundos/segundos por cada segundo transcurrido para el jugador cuyo turno esté activo.
4. **Finalización de la Partida**:
   * Ocurre por **Jaque Mate**, **Tablas** (ahogado, triple repetición, etc. detectadas por el motor), **Expiración de tiempo (Timeout)**, **Rendición voluntaria (Resignation)** o **Acuerdo Mutuo de Tablas**.
   * Tras finalizar, se llama a la lógica de actualización de ELO (`_finalize_match_ratings_and_stats`) que calcula la variación matemática del rating de ambos jugadores y actualiza la tabla de estadísticas históricas de cada uno en la Base de Datos de manera transaccional.

---

### 📝 Propuesta de Historias de Usuario (User Stories):

#### **US-5.1: Movimientos e Interacción con el Tablero**
> **Como** jugador en una partida activa  
> **Quiero** arrastrar o seleccionar una de mis piezas y moverla a una casilla válida en el tablero  
> **Para** registrar mi jugada y transferir el turno a mi oponente.
* **Criterios de Aceptación**:
  * **Validación en Cliente/Servidor**: Si el movimiento es ilegal según las reglas de la FIDE, la pieza debe regresar a su casilla de origen y el servidor debe rechazar la petición con un error HTTP 400.
  * **Actualización en Tiempo Real**: Al hacer un movimiento legal, el oponente debe ver la actualización reflejada en su tablero de forma instantánea sin recargar la página.
  * **Estado de Jaque**: Si el rey de un jugador está amenazado, el sistema debe alertarlo visualmente en el tablero.

#### **US-5.2: Reloj de Tiempo Dinámico**
> **Como** jugador bajo control de tiempo  
> **Quiero** ver el reloj de tiempo restante de ambos jugadores disminuir segundo a segundo cuando es su respectivo turno  
> **Para** planificar mi estrategia de juego y evitar perder por tiempo.
* **Criterios de Aceptación**:
  * **Sincronización de Reloj**: La diferencia de tiempo no debe desincronizarse entre el cliente y el servidor. El backend valida el timestamp exacto del movimiento contra el del turno anterior.
  * **Derrota por Tiempo**: Si el reloj de un jugador llega a 0, la partida termina inmediatamente indicando derrota por tiempo y se recalculan los puntos ELO.

#### **US-5.3: Comunicación e Interacción Social en la Partida (Chat y Tablas)**
> **Como** competidor deportivo  
> **Quiero** chatear con mi rival u ofrecerle un acuerdo de tablas durante la partida  
> **Para** mantener una interacción respetuosa y estratégica de acuerdo a las reglas del juego.
* **Criterios de Aceptación**:
  * **Mensajería**: El panel lateral de chat debe renderizar los mensajes de ambos usuarios en orden cronológico mediante WebSockets.
  * **Flujo de Tablas**: Al presionar "Ofrecer tablas", el oponente debe recibir una alerta interactiva para "Aceptar" o "Declinar". Si acepta, la partida finaliza como empate de inmediato.

---

## Módulo 6: Historial de Partidas y Reportes (Match History & Statistics)

* **Objetivo**: Proveer un visor de las partidas ya terminadas, permitiendo revisar los movimientos jugados (PGN), quién ganó, bajo qué circunstancias y los cambios de ELO generados.

### ⚙️ Componentes del Código Relacionados:
* **Backend**:
  * **Router**: [match.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/routers/match.py)
  * **Servicio**: [match_service.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/services/match_service.py)
  * **Repositorio**: [match_repository.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/repositories/match_repository.py), [statistics_repository.py](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/backend/repositories/statistics_repository.py)
* **Frontend**:
  * **Páginas**: [DashboardPage.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/pages/DashboardPage.jsx), [MatchDetailPage.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/pages/MatchDetailPage.jsx), [ResultPage.jsx](file:///c:/Users/JoshLopez/Documents/GitHub/ChessGame/frontend/src/pages/ResultPage.jsx)

### 🔑 Flujo y Reglas de Negocio Críticas:
1. Al concluir una partida, el frontend redirige a los usuarios a la página `ResultPage`, mostrando de forma prominente la ganancia/pérdida de ELO y el motivo del fin de la partida (ej. Jaque mate, abandono, tiempo).
2. El Dashboard del usuario carga el listado de partidas finalizadas en las que ha participado.
3. Al hacer clic en una partida del historial, se abre la vista `MatchDetailPage` que lee el registro PGN almacenado en la Base de Datos para permitir al usuario retroceder y avanzar las jugadas ya realizadas a modo de análisis o estudio.

---

### 📝 Propuesta de Historias de Usuario (User Stories):

#### **US-6.1: Visualización del Historial de Partidas**
> **Como** jugador analítico  
> **Quiero** ver una lista detallada de mis partidas jugadas en mi tablero principal (Dashboard)  
> **Para** consultar rápidamente contra quién jugué, si gané o perdí, y la fecha del encuentro.
* **Criterios de Aceptación**:
  * **Paginación**: Si el historial de partidas es largo, debe cargarse por partes o contar con desplazamiento infinito para no sobrecargar el navegador.
  * **Navegabilidad**: Cada fila del historial debe ser interactiva y redirigir al usuario al visor de la partida específica (`/match/{matchID}`).

#### **US-6.2: Visor de Partidas en PGN**
> **Como** jugador que desea mejorar su técnica  
> **Quiero** examinar los movimientos de una partida finalizada usando botones de navegación de jugadas  
> **Para** estudiar los errores tácticos y reproducir la partida paso a paso en un tablero virtual interactivo.
* **Criterios de Aceptación**:
  * **Control de Jugadas**: La vista detallada de la partida debe proveer controles para avanzar al movimiento siguiente, volver al anterior, o saltar directamente al inicio o al final de la partida.
  * **Carga de Datos**: El tablero debe reconstruirse fielmente a partir de la cadena PGN que retorna el backend.

---

# 🚀 Recomendaciones Técnicas para la Implementación de tus Historias de Usuario
* **Uso de WebSockets y HTTP**: Para operaciones de mutación (ej. Hacer un movimiento, rendirse), es preferible usar **HTTP POST/PUT** ya que ofrece un control y manejo de errores (códigos de estado HTTP, excepciones) mucho más limpio, mientras que el **WebSocket** debe ser utilizado principalmente para propagar eventos de difusión rápida (*broadcasts*) a las interfaces conectadas.
* **Robustez en la Desconexión**: Te recomiendo crear una historia técnica sobre la **Reconexión Automática de WebSockets**. Si un usuario experimenta microcortes de internet durante una partida de 10 minutos, el cliente React debe intentar re-conectarse de forma transparente y re-sincronizar el reloj y FEN del tablero.
* **Transaccionalidad en el ELO**: La escritura en las tablas de `Rating` y `Statistics` al finalizar una partida debe ejecutarse dentro de un bloque transaccional de Base de Datos para asegurar que no ocurran discrepancias numéricas en caso de interrupción del servidor.

Esta estructura modular y funcional te permitirá escribir historias de usuario detalladas y perfectamente alineadas con la arquitectura real de tu aplicación. Si necesitas profundizar en las firmas de funciones o detalles de algún archivo en específico, no dudes en decírmelo.