import './App.css';
import React, { useEffect, useState, useCallback } from 'react';
import guy from './assets/guy.png';
import cn from 'classnames';
import { Presenter, PresentationStatus, ApiResponse } from './types';
import AddPresenterForm from './components/AddPresenterForm';
import NotificationSystem from './components/NotificationSystem';
import { NotificationProps } from './types';

const buttonWords = ['Victim', 'Presenter', 'Gocian', 'TED Talker'];
const buttonWordIndex = Math.floor(Math.random() * buttonWords.length);

function App() {
  const [presenters, setPresenters] = useState<Presenter[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  const [notifications, setNotifications] = useState<NotificationProps[]>([]);
  const [removingPresenter, setRemovingPresenter] = useState<string | null>(null);

  const addNotification = useCallback((notification: Omit<NotificationProps, 'id'>) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { ...notification, id }]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetch('api/GetPresenters')
      .then(res => res.json())
      .then((body: ApiResponse) => {
        if (body.presenters) {
          setPresenters(body.presenters);
        }
        setError(null);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load presenters');
        addNotification({
          type: 'error',
          message: 'Failed to load presenters'
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [addNotification]);

  const selectPresenter = useCallback(() => {
    if (isSelecting) return;

    setIsSelecting(true);
    fetch('api/SelectNextPresenter')
      .then(res => res.json())
      .then((body: ApiResponse) => {
        if (body.presenters) {
          setPresenters(body.presenters);
          addNotification({
            type: 'success',
            message: 'Presenter selected successfully!'
          });
        }
        setError(null);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to select presenter');
        addNotification({
          type: 'error',
          message: 'Failed to select presenter'
        });
      })
      .finally(() => {
        setTimeout(() => {
          setIsSelecting(false);
        }, 2000);
      });
  }, [isSelecting, addNotification]);

  const addPresenter = useCallback(async (name: string, avatar?: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('api/AddPresenter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, avatar }),
      });

      const body: ApiResponse = await response.json();

      if (response.ok && body.presenters) {
        setPresenters(body.presenters);
        setShowAddForm(false);
        addNotification({
          type: 'success',
          message: `${name} added successfully!`
        });
      } else {
        throw new Error(body.error || 'Failed to add presenter');
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add presenter';
      setError(errorMessage);
      addNotification({
        type: 'error',
        message: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  }, [addNotification]);

  const removePresenter = useCallback(async (name: string) => {
    if (window.confirm(`Are you sure you want to remove ${name}?`)) {
      setRemovingPresenter(name);
      try {
        const response = await fetch('api/RemovePresenter', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name }),
        });

        const body: ApiResponse = await response.json();

        if (response.ok && body.presenters) {
          setPresenters(body.presenters);
          addNotification({
            type: 'success',
            message: `${name} removed successfully!`
          });
        } else {
          throw new Error(body.error || 'Failed to remove presenter');
        }
      } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to remove presenter';
        setError(errorMessage);
        addNotification({
          type: 'error',
          message: errorMessage
        });
      } finally {
        setRemovingPresenter(null);
      }
    }
  }, [addNotification]);

  const resetPresenters = useCallback(async () => {
    if (window.confirm('Are you sure you want to reset all presenters?')) {
      setIsLoading(true);
      try {
        const response = await fetch('api/ResetPresenters', {
          method: 'POST',
        });

        const body: ApiResponse = await response.json();

        if (response.ok && body.presenters) {
          setPresenters(body.presenters);
          addNotification({
            type: 'success',
            message: 'All presenters reset successfully!'
          });
        } else {
          throw new Error(body.error || 'Failed to reset presenters');
        }
      } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to reset presenters';
        setError(errorMessage);
        addNotification({
          type: 'error',
          message: errorMessage
        });
      } finally {
        setIsLoading(false);
      }
    }
  }, [addNotification]);

  return (
    <div className="App">
      <div className="wrapper">
        <div className="content">
          <h1 className="header">Pick a Presenter</h1>

          <div className="button-group">
            <button
              className="pick-button"
              onClick={selectPresenter}
              disabled={isSelecting || isLoading}
            >
              {isSelecting ? 'Selecting...' : `Pick a New ${buttonWords[buttonWordIndex]}`}
            </button>

            <button
              className="add-button"
              onClick={() => setShowAddForm(true)}
              disabled={isLoading}
            >
              Add Presenter
            </button>

            <button
              className="reset-button"
              onClick={resetPresenters}
              disabled={isLoading}
            >
              Reset All
            </button>
          </div>

          {showAddForm && (
            <AddPresenterForm
              onSubmit={addPresenter}
              onCancel={() => setShowAddForm(false)}
              isLoading={isLoading}
              existingNames={presenters.map(p => p.name)}
            />
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="presenter-list">
            {presenters.map(presenter => (
              <div key={presenter.name} className="person">
                <div className={cn('item', {
                  presented: presenter.presentationStatus === PresentationStatus.PRESENTED,
                  assigned: presenter.presentationStatus === PresentationStatus.ASSIGNED,
                })}>
                  <img alt={`${presenter.name} avatar`} src={presenter.avatar || guy} />
                  <span>{presenter.name}</span>
                  <button
                    className="remove-button"
                    onClick={() => removePresenter(presenter.name)}
                    disabled={removingPresenter === presenter.name || isLoading}
                    title={`Remove ${presenter.name}`}
                  >
                    {removingPresenter === presenter.name ? '...' : '×'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {isLoading && (
            <div className="loading-indicator">
              Loading...
            </div>
          )}
        </div>
      </div>

      <NotificationSystem
        notifications={notifications}
        onRemove={removeNotification}
      />
    </div>
  );
}

export default App;
