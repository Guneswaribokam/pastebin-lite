
# Pastebin Lite

Pastebin Lite is a simple web application that allows users to create text pastes and share them using a unique link.  
Each paste can optionally expire after a specified time or after a limited number of views.

## Running the Project Locally

### Prerequisites
- Node.js (version 18 or higher)
- Git

### Steps

1. Clone the repository:
   git clone https://github.com/Guneswaribokam/pastebin-lite.git

2. Navigate into the project directory:
   cd pastebin-lite

3. Install the required dependencies:
   npm install

4. Start the server:
   npm start

After starting the server, the application will be available at:
http://localhost:3000

## Persistence Layer

This project uses SQLite as its persistence layer through the better-sqlite3 library.  
All pastes are stored in a local SQLite database file, which allows data to persist across requests without relying on in-memory storage.  
This approach works well for serverless deployments and ensures reliability.

