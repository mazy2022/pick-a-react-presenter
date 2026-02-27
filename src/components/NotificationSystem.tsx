import React, { useEffect, useState, useCallback } from 'react';
import { NotificationProps } from '../types';

interface NotificationSystemProps {
  notifications: NotificationProps[];
  onRemove: (id: string) => void;
}

interface NotificationItemProps extends NotificationProps {
  onRemove: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  id,
  type,
  message,
  duration = 5000,
  onRemove
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const handleRemove = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => onRemove(id), 300); // Wait for animation
  }, [id, onRemove]);

  useEffect(() => {
    // Trigger animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (duration <= 0 || isPaused) return;

    const timer = setTimeout(() => {
      handleRemove();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, isPaused, id, handleRemove]);

  return (
    <div
      className={`notification notification-${type} ${isVisible ? 'visible' : ''}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="alert"
      aria-live="polite"
    >
      <div className="notification-content">
        <span className="notification-message">{message}</span>
        <button
          className="notification-close"
          onClick={handleRemove}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
};

const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notifications,
  onRemove
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="notification-system">
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          {...notification}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
};

export default NotificationSystem;