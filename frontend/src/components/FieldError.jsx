import React from 'react';

const FieldError = ({ message }) => {
  if (!message) return null;
  return (
    <p
      role="alert"
      style={{
        margin: '6px 0 0',
        fontSize: '12px',
        color: 'var(--error-color)',
        lineHeight: 1.4,
      }}
    >
      {message}
    </p>
  );
};

export default FieldError;
