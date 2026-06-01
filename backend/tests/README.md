# Documentación de Pruebas Backend

Esta carpeta contiene la suite de pruebas del backend dividida en dos enfoques principales: **Unitarias** e **Integración**.

---

## 1. Pruebas Unitarias (`/unitarias`)
**¿Qué prueban?** Lógica pura de negocio y manipulación de datos en la capa de **Servicios**.
**¿Cómo lo prueban?** Instancian directamente las clases de servicio (ej. `UserService`, `AuthService`) pasándoles una sesión de base de datos en memoria (mock), sin levantar servidores ni simular peticiones HTTP. Son muy rápidas.

- **`test_services.py`**:
  - **Autenticación (HU-1):** Llama a `register` y `login` directamente en `AuthService` validando creación de usuario, contraseñas encriptadas y rechazo de duplicados.
  - **Perfil/Settings (HU-2):** Llama a `get_profile` y `update_settings` en `UserService` verificando que devuelva el DTO correcto con estadísticas y aplique cambios.
- **`test_social.py`**:
  - **Buscador y Amigos (HU-3):** Prueba `search_users`, envío de solicitudes, aceptar, rechazar y eliminar directamente en `FriendshipService` y `UserService`.
  - **Invitaciones (HU-3):** Prueba validación de invitaciones cruzadas y aceptar/declinar en `MatchService`.
- **`test_matchmaking.py`**:
  - **Emparejamiento (HU-4):** Prueba el algoritmo en `MatchmakingService`. Simula el ingreso a las colas (`_queues`), emparejamiento por mismo modo (`try_match_players`), y eliminación al cancelar.

---

## 2. Pruebas de Integración (`/integracion`)
**¿Qué prueban?** El flujo completo desde el **Router (Endpoint)** -> **Servicio** -> **Base de Datos**.
**¿Cómo lo prueban?** Utilizan `TestClient` de FastAPI para simular peticiones HTTP reales (GET, POST, PUT, DELETE), validando que la API procese el JSON, pase por los validadores, evalúe el Token JWT de autorización y retorne el código HTTP adecuado (200, 201, 400, 401).

- **`test_api.py`**:
  - **Endpoints Base (HU-1, HU-2):** Dispara `POST /api/auth/register`, `POST /api/auth/login` y `GET /api/profile/me`. Valida que `/profile/me` devuelva 401 sin token, y 200 con el JSON del perfil al pasarle el header `Authorization`.
- **`test_social_api.py`**:
  - **Endpoints Sociales (HU-3):** Hace peticiones a `GET /api/users/search`, `POST /api/friends/request`, y `POST /api/match/invite`. Evalúa respuestas JSON para verificar que el pipeline HTTP conecta correctamente la solicitud con el servicio social subyacente.
- **`test_matchmaking_api.py`**:
  - **Endpoints Matchmaking (HU-4):** Hace peticiones HTTP a `POST /api/matchmaking/join` y `GET /api/matchmaking/status`. Simula el flujo completo de un cliente web intentando buscar partida, consultando su estado y saliendo de la cola exitosamente.

---

## Dependencias Comunes (`conftest.py`)
Contiene utilidades inyectables (Fixtures) para no repetir código:
- `db`: Crea una base de datos SQLite en memoria limpia para cada prueba.
- `client`: Levanta la app de FastAPI mockeando procesos asíncronos en segundo plano para evitar bloqueos.
- `make_user`, `make_match`, `make_stats`: Funciones de fábrica (Factories) para insertar datos simulados rápidamente en la DB antes de cada prueba.
- `bearer`: Genera un token JWT simulado para las pruebas de integración que requieren autenticación.
