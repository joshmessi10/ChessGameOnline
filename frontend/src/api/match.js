import api from './auth';

export const getMatch = (id) => api.get(`/match/${id}`);
export const makeMove = (id, move) => api.post(`/match/${id}/move`, { move });
export const invite = (friendId, mode, time) => api.post('/match/invite', { friend_id: friendId, modo: mode, control_tiempo: time });
