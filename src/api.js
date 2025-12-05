import axios from "axios";

const api = axios.create({
  baseURL: "https://web-production-14a2c.up.railway.app/api",

});

export default api;
