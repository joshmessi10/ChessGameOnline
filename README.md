# ♟️ Chess Game Online

### 🚀 Juega ahora

https://chessgame-2q1s.onrender.com/

---

# 📖 Descripción

Chess Game Online es una plataforma de ajedrez multijugador en tiempo real desarrollada utilizando tecnologías modernas tanto para frontend como para backend.

La aplicación permite a los usuarios registrarse, iniciar sesión, gestionar amistades, emparejarse automáticamente con otros jugadores y disputar partidas de ajedrez sincronizadas en tiempo real mediante WebSockets.

El sistema fue construido siguiendo una arquitectura por capas que separa claramente la lógica de negocio, el acceso a datos, la comunicación en tiempo real y la interfaz de usuario, facilitando el mantenimiento y la escalabilidad del proyecto.

---

# ✨ Características

## 🔐 Autenticación

- Registro de usuarios
- Inicio de sesión seguro
- Autenticación basada en JWT
- Protección de rutas privadas
- Gestión de perfil

## 👥 Sistema de amistades

- Envío de solicitudes de amistad
- Aceptación y rechazo de solicitudes
- Listado de amigos
- Gestión de relaciones entre usuarios

## 🎯 Matchmaking

- Cola de emparejamiento automática
- Búsqueda de oponentes
- Creación automática de partidas
- Asignación de colores

## ♟️ Partidas en línea

- Comunicación mediante WebSockets
- Actualización instantánea de movimientos
- Sincronización en tiempo real
- Reconexión de jugadores
- Gestión del estado de la partida
- Selección de diferentes modos de juego: Bullet, Blitz, rapid y Classical

## 🧠 Motor de ajedrez

- Validación completa de movimientos
- Detección de jaque
- Detección de jaque mate
- Detección de tablas
- Control de turnos
- Gestión del tablero mediante FEN

## 📊 Estadísticas

- Historial de partidas
- Consulta de resultados
- Información de jugadores
- Seguimiento de desempeño

---

# 🏗️ Arquitectura General

```text
┌───────────────┐
│   Frontend    │
│ React + Vite  │
└───────┬───────┘
        │ HTTP
        ▼
┌───────────────┐
│    FastAPI    │
│    Routers    │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│   Services    │
│ Business Logic│
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Repositories  │
│ Data Access   │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ PostgreSQL DB │
└───────────────┘
```

---

# ⚡ Arquitectura en Tiempo Real

```text
Jugador A
     │
     ▼
 WebSocket
     │
     ▼
Connection Manager
     │
     ▼
 Chess Engine
     │
     ▼
 Broadcast
     │
     ▼
Jugador B
```

---

# 🛠️ Tecnologías Utilizadas

## Frontend

- React
- Vite
- React Router
- Context API
- JavaScript
- CSS

## Backend

- FastAPI
- SQLAlchemy
- SQLModel
- Pydantic
- PostgreSQL
- JWT Authentication
- WebSockets

## Infraestructura

- Render
- PostgreSQL
- GitHub

---

# 📂 Estructura del Proyecto

## Frontend

```text
frontend/
│
├── src/
│   ├── api/
│   ├── components/
│   ├── context/
│   ├── pages/
│   ├── utils/
│   ├── App.jsx
│   └── main.jsx
│
└── package.json
```

## Backend

```text
backend/
│
├── routers/
├── services/
├── repositories/
├── models/
├── schemas/
├── realtime/
├── core/
├── database.py
├── config.py
├── main.py
│
└── requirements.txt
```

---

# 🧩 Capas del Backend

## Routers

Responsables de exponer los endpoints HTTP.

Ejemplos:

```text
/auth
/profile
/friends
/match
/matchmaking
```

## Services

Contienen la lógica de negocio de la aplicación.

Ejemplos:

```text
AuthService
UserService
FriendshipService
MatchService
MatchmakingService
```

## Repositories

Abstracción encargada de interactuar con la base de datos.

Responsabilidades:

- Consultas SQL
- Inserciones
- Actualizaciones
- Eliminaciones

## Models

Representan las tablas de la base de datos.

Ejemplos:

```text
User
Match
Friendship
Statistics
```

## Schemas

Modelos Pydantic utilizados para:

- Validar requests
- Validar responses
- Serializar datos

---

# ♟️ Flujo de una Partida

## 1. Inicio de sesión

```text
Usuario
   ↓
Autenticación JWT
   ↓
Acceso autorizado
```

## 2. Matchmaking

```text
Jugador entra a cola
         ↓
Sistema busca rival
         ↓
Partida creada
```

## 3. Conexión WebSocket

```text
Jugador A
       ↕
WebSocket
       ↕
Servidor
       ↕
Jugador B
```

## 4. Movimiento

```text
Jugador mueve pieza
          ↓
Validación
          ↓
Actualización tablero
          ↓
Broadcast
          ↓
Oponente recibe movimiento
```

---

# 🗄️ Base de Datos

Principales entidades:

```text
Users
│
├── Friendships
│
├── Matches
│
└── Statistics
```

Relaciones:

```text
User
 ├── Matches
 ├── Friendships
 └── Profile Data
```

---

# 🔒 Seguridad

La aplicación implementa:

- JWT Authentication
- Protección de rutas privadas
- Hashing seguro de contraseñas
- Validación de datos mediante Pydantic
- Control de acceso por usuario

---

# 🚀 Instalación Local

## Clonar repositorio

```bash
git clone <repository-url>
```

---

## Backend

Instalar dependencias:

```bash
cd backend
pip install -r requirements.txt
```

Crear archivo `.env`

```env
DATABASE_URL=postgresql://usuario:password@localhost/database
SECRET_KEY=your_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

Ejecutar servidor:

```bash
uvicorn main:app --reload
```

---

## Frontend

Instalar dependencias:

```bash
cd frontend
npm install
```

Iniciar aplicación:

```bash
npm run dev
```

---

# ⚙️ Variables de Entorno

## Backend

```env
DATABASE_URL=
SECRET_KEY=
ALGORITHM=
ACCESS_TOKEN_EXPIRE_MINUTES=
```

## Frontend

```env
VITE_API_URL=
VITE_WS_URL=
```

---

# ✅ Aspectos Destacados

- Arquitectura por capas
- Backend desacoplado
- Comunicación en tiempo real mediante WebSockets
- Persistencia en PostgreSQL
- Sistema JWT
- Matchmaking automático
- Gestión de amistades
- Historial de partidas
- Despliegue en la nube

---

# 👨‍💻 Autores

**Karen Yireth Castañeda Castro**
**Josh Sebastián López Murcia**

---

# 🌐 Demo

https://chessgame-2q1s.onrender.com/

¡Gracias por visitar el proyecto! ♟️
