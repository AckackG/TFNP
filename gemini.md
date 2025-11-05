# Gemini CLI Project Guide: TFNP Extension

This document provides a high-level overview of the "TFNP" browser extension project to guide the Gemini CLI in understanding its structure and conventions.

## Project Overview

This is a browser extension that replaces the default new tab page. It is built with vanilla JavaScript, HTML, and CSS, and uses Bootstrap for styling and SortableJS for list manipulation.

## File Structure

The project is organized with a clear separation of concerns.

- **`manifest.json`**: The standard Chrome extension manifest file, defining the extension's properties, permissions, and entry points.
- **`new_tab.html`**: The main HTML file for the new tab page.
- **`new_tab.css`**: Custom styles for the new tab page.
- **`background.js`**: Handles background tasks for the extension.
- **`icons/`**: Contains the extension's icons in various sizes.
- **`lib/`**: Contains third-party libraries.
  - `bootstrap/`: Bootstrap 5 CSS and JS framework.
  - `sortablejs/`: SortableJS library for drag-and-drop functionality.
- **`js/`**: The core application logic, broken down into modules:
  - **`main.js`**: The main entry point for the application. It initializes the application state and sets up event listeners.
  - **`state.js`**: Manages the application's state, such as the list of items or user settings.
  - **`dom.js`**: Contains references to frequently used DOM elements.
  - **`ui.js`**: Includes functions responsible for rendering and updating the user interface based on the application state.
  - **`handlers.js`**: Defines event handlers for user interactions (e.g., button clicks, form submissions).
  - **`utils.js`**: Provides utility and helper functions used across the application.
  - **`constants.js`**: Stores application-wide constants.

## Core Concepts

The application follows a modular, vanilla JavaScript architecture.

1.  **Initialization**: `main.js` is the starting point.
2.  **State Management**: `state.js` holds the single source of truth. Any data that changes is managed here.
3.  **UI Rendering**: `ui.js` contains functions that take state as input and render the corresponding HTML.
4.  **User Interaction**: `handlers.js` listens for DOM events. These handlers call functions that update the state, and then trigger a UI re-render.

## Development Guidelines

- **Technology**: Use vanilla JavaScript (ES6+).
- **Style**: Follow the existing coding style and conventions.
- **Modularity**: Keep the concerns separated as per the existing file structure. New logic should be placed in the appropriate file.
- **Dependencies**: Use the versions of Bootstrap and SortableJS provided in the `lib` directory.
