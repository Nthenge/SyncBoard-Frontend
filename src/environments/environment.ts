import { endpoints } from '../app/config/endpoints';

export const environment = {
  production: false,
  apiUrl: 'localhost:8084',
  api: {
    basePath: '',
    endpoints: endpoints
  }
};