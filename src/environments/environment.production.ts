import { endpoints } from '../app/config/endpoints';

export const environment = {
  production: true,
  apiUrl: 'localhost:8084',
  api: {
    basePath: '',
    endpoints: endpoints
  }
};