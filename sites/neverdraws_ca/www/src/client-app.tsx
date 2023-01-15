import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';

const appRoot: HTMLElement = document.getElementById('app') || document.body;

// Render app at app element
ReactDOM.hydrateRoot(
    appRoot,
    <BrowserRouter>
        <App />
    </BrowserRouter>,
);
