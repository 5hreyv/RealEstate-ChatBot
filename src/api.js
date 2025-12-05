import axios from "axios";

const api = axios.create({
  baseURL: "https://web-production-14a2c.up.railway.app/api/",
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
