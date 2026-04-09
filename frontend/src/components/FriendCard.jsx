import React from 'react';

const FriendCard = ({ friend, onRemove, onAccept }) => {
  return (
    <div className="friend-card glass-panel" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 20px',
      marginBottom: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img 
          src={friend.url_avatar || 'https://via.placeholder.com/40'} 
          alt="avatar" 
          style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--border-color)' }}
        />
        <div>
          <div style={{ fontWeight: 'bold' }}>{friend.amigo_name || friend.nombre_usuario}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{friend.estado}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {friend.estado === 'pending' ? (
          <button className="primary-btn" onClick={() => onAccept(friend.amigo_id)}>Accept</button>
        ) : null}
        <button className="secondary-btn" style={{ color: 'var(--error-color)' }} onClick={() => onRemove(friend.amigo_id)}>Remove</button>
      </div>
    </div>
  );
};

export default FriendCard;
