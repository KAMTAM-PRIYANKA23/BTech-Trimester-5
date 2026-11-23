# Cloud-Based CI/CD Pipeline for Automated Application Deployment

## Project Overview

This project demonstrates how a web application can be developed, connected to a database, and deployed automatically using cloud technologies.

The application is a Task Manager that allows users to add, view, complete, and delete tasks.

## Objectives

- Develop a full-stack web application.
- Understand frontend and backend communication.
- Store application data using MySQL.
- Learn Docker containerization.
- Deploy the application on AWS EC2.
- Automate deployment using GitHub Actions.
- Monitor the application using AWS CloudWatch.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js, Vite |
| Backend | Node.js, Express.js |
| Database | MySQL |
| API | REST API |
| Version Control | Git, GitHub |
| Containerization | Docker (planned) |
| CI/CD | GitHub Actions (planned) |
| Cloud | AWS (planned) |
| Monitoring | AWS CloudWatch (planned) |

## Project Structure

- frontend/ - React application
- backend/ - Express server and database connection
- database/ - MySQL database schema
- docs/ - Project documentation and screenshots

## Current Progress

- React frontend developed.
- Node.js and Express backend developed.
- MySQL database connected.
- Task creation, viewing, completion, and deletion tested.
- Docker, AWS deployment, and CI/CD automation are the next stages.

## Local Setup

### Backend

1. Open PowerShell in the backend folder.
2. Run `npm install`.
3. Create a local `.env` file with your database settings.
4. Run `npm run dev`.

### Frontend

1. Open another terminal in the frontend folder.
2. Run `npm install`.
3. Run `npm run dev`.

## Security

Database passwords and environment variables must remain in the local `.env` file and must never be uploaded to GitHub.
