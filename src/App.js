import './App.css';
import React, { useEffect } from 'react';
import guy from './assets/guy.png';
import spotlight from './assets/spotlight.png';

const buttonWords = ['Victim', 'Presenter', 'Gocian', 'TED Talker'];
const buttonWordIndex = Math.floor(Math.random() * buttonWords.length);

function App() {
  useEffect(() => {
    fetch('api/GetPresenters')
      .then(res => {
        console.log(res);
      })
      .catch(err => {
        console.log(err);
      })
  }, []);

  return (
    <div className="App">
      <h1 className="header">Pick a Presenter</h1>
      <button className="pick-button">
        Pick a New {buttonWords[buttonWordIndex]}
      </button>
      <div className="person-wrapper">
        <div className="list-of-people">
          <div className="person">
            <img className="person-image" src={guy} />
            <span className="person-name">Adam</span>
            <img className="spotlight-image" src={spotlight} />
          </div>
          <div className="person">
            <img className="person-image" src={guy} />
            <span className="person-name">Bailey</span>
          </div>
        </div>
      </div>
    </div>
  );
}
export default App;