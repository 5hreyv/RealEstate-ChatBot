# 🌐 Real Estate Analysis Chatbot

A full-stack web application built using **Django (Backend)** and **React (Frontend)** that allows users to analyze real estate localities through a chat-based interface. The system processes an Excel dataset, generates insights, displays charts, and returns filtered table data.

🔗 **GitHub Repository:** https://github.com/5hreyv/realestate-chatbot

---

## 📌 Table of Contents
- Overview  
- Key Features  
- Tech Stack  
- Architecture  
- Folder Structure  
- Backend Setup  
- Frontend Setup  
- API Endpoints  
- How the Chatbot Works  
- Suggested Prompts  
- Deployment Details  
- Demo Video  
- Future Improvements  
- Author  

---

## 🧠 Overview

This project was built as part of the **SigmaValue Full Stack Developer Assignment 2025**.

The chatbot can understand natural-language queries such as:

- “Analyze Wakad”  
- “Show price growth for Akurdi”  
- “Compare Aundh and Ambegaon Budruk demand trends”  

The backend (Django + Pandas) processes the provided Excel dataset and returns:

- A natural-language summary  
- Chart-ready JSON data  
- Filtered real estate records  

The frontend displays this data in a clean chat interface with charts and tables.

---

## ⭐ Key Features

### 🔹 Chat Interface
- Clean & responsive  
- Suggested prompts  
- Auto-scrolling message feed  

### 🔹 Data Analytics
- Excel parsing via Pandas  
- Locality-wise filtering  
- Trend extraction (price/demand)  
- Summary generation (mock or LLM-ready)  

### 🔹 Visual Output
- Price trend charts  
- Demand trend charts  
- Filtered data table  

### 🔹 Deployment Support
- Backend deployable via Render (Procfile + render.yaml)  
- Frontend deployable via Netlify/Vercel  

---

## 🛠 Tech Stack

### Frontend
- React  
- Bootstrap  
- Axios  
- Chart.js / Recharts  

### Backend
- Python  
- Django  
- Pandas  
- Django REST Framework *(optional)*  

### Tools
- Render (Backend Hosting)  
- Netlify / Vercel (Frontend Hosting)  
- GitHub  

---

## 🏗 Architecture
```
+---------------------+         +---------------------+
|     Frontend        |  --->   |       Backend       |
|   (React + Axios)   |  API    |  (Django + Pandas)  |
+---------------------+         +---------------------+
         |                                 |
         | User Query                      |
         |-------------------------------->|
         |                                 |
         |  Summary + Chart Data + Table   |
         <---------------------------------|
```
## 📁 Folder Structure
```
realestate-chatbot/
│── api/                    # Django API app (endpoints, serializers, views)
│── realestate_chatbot/     # Django project settings
│── data/                   # Excel dataset (if included)
│── src/                    # React frontend source code
│── public/                 # React public files
│── build/                  # Production React build (for deployment)
│── node_modules/           # React dependencies
│── manage.py               # Django entry file
│── db.sqlite3              # SQLite database (local)
│── requirements.txt        # Python dependencies
│── package.json            # Frontend dependencies
│── package-lock.json
│── Procfile                # For Render/Heroku backend deployment
│── render.yaml             # Render deployment config
└── README.md
```
---

## 🔧 Backend Setup

### Install dependencies
```
pip install -r requirements.txt
```
### Run migrations
```
python manage.py migrate
```
### Start backend server
```
python manage.py runserver
```

Runs at:
```
http://127.0.0.1:8000/
```
---

## 💻 Frontend Setup

### Install dependencies
```
npm install
```

### Start React development server
```
npm start
```

Runs at:
http://localhost:3000/

---

## 📡 API Endpoints

### **POST /api/chat/**  
Processes user query and returns:

- summary  
- price trend data  
- demand trend data  
- filtered table results  

**Example Request**
```json
{ "query": "Analyze Wakad" }
Example Response

json
Copy code
{
  "summary": "Wakad shows steady price growth...",
  "price_trend": [...],
  "demand_trend": [...],
  "table": [...]
}
```
## 💬 How the Chatbot Works

- User enters a query

- React sends it to Django via Axios

- Django extracts locality using keyword matching

- Pandas filters Excel data

### Backend returns:

- Summary

- Chart JSON

- Table JSON

- UI updates instantly

## 💡 Suggested Prompts

- Analyze Wakad

- Show price trend for Aundh

- Compare Wakad and Aundh

- Demand trend for Akurdi

- Last 3 years data for Akurdi

## 🚀 Deployment Details
### Backend Deployment

Includes:

- Procfile

- .yaml

### Deploy on:

- Render

- Replit

### Frontend Deployment

Generate build:
```
npm run build
```

### Host /build on:

- Netlify

- Vercel

- GitHub Pages

## 🌍 Hosted Website

You can access the live hosted version of the project here:

### 🔗 Live Demo:
https://05a3d778-caba-42de-8088-b11ef22d491c-00-3o0hm9t9payso.pike.replit.dev/

## 👩‍💻 Author

**Shreya Katare**
Full Stack Developer — React | Django | Python | Node.js

📧 Email: shreyakatare2004@gmail.com

🔗 GitHub: https://github.com/5hreyv
