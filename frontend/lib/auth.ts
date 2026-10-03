export const saveToken = (token: string, userId: string, name: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('energy_token', token);
    localStorage.setItem('energy_user_id', userId);
    localStorage.setItem('energy_user_name', name);
  }
};

export const getToken = (): string | null => {
  if (typeof window !== 'undefined') return localStorage.getItem('energy_token');
  return null;
};

export const getUserId = (): string | null => {
  if (typeof window !== 'undefined') return localStorage.getItem('energy_user_id');
  return null;
};

export const getUserName = (): string | null => {
  if (typeof window !== 'undefined') return localStorage.getItem('energy_user_name');
  return null;
};

export const clearToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('energy_token');
    localStorage.removeItem('energy_user_id');
    localStorage.removeItem('energy_user_name');
  }
};

export const isLoggedIn = (): boolean => !!getToken();
