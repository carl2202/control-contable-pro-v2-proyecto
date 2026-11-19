import { apiRequest } from './api';
import { OperationalAlerts } from '../types';

export const AlertsService = {
  async getAll(): Promise<OperationalAlerts> {
    return apiRequest<OperationalAlerts>('/alerts');
  },
};
