import './App.css';
import React, { useEffect, useState } from 'react';
import guy from './assets/guy.png';
import cn from 'classnames';

const buttonWords = ['Victim', 'Presenter', 'Gocian', 'TED Talker'];
const buttonWordIndex = Math.floor(Math.random() * buttonWords.length);
const PRESENTATION_STATUS = {
  NOT_SELECTED: 0,
  ASSIGNED: 10,
  PRESENTED: 20,
}
function App() {
  const [presenters, setPresenters] = useState([]);
  useEffect(() => {
    fetch('api/GetPresenters')
      .then(res => {
        setPresenters(JSON.parse(res.presenters));
      })
      .catch(err => {
        console.log(err);
      })
  }, []);

  const selectPresenter = () => {
    fetch('api/SelectPresenter')
      .then(res => {
        setPresenters(JSON.parse(res.presenters));
      })
      .catch(err => {
        console.log(err);
      })
  }

  return (
    <div className="App">
      <h1 className="header">Pick a Presenter</h1>
      <button className="pick-button"
        onClick={selectPresenter}>
        Pick a New {buttonWords[buttonWordIndex]}
      </button>
      <div className="person-wrapper">
        <div className="list-of-people">
          {presenters.map(presenter => (
            <div className="person">
              <div className={cn('item', {
                presented: presenter.presentationStatus === PRESENTATION_STATUS.PRESENTED,
                assigned: presenter.presentationStatus === PRESENTATION_STATUS.ASSIGNED,
              })}>
                <img alt="person" src={guy} />
                <span>{presenter.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
export default App;