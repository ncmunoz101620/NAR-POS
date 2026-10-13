let redirecting = false;

export const isSessionRedirecting = () => redirecting;

export function redirectExpiredSession(status) {
  const path = window.location.pathname;
  if (![401, 419].includes(status) || !(path === '/admin' || path.startsWith('/admin/'))) return false;
  if (!redirecting) {
    redirecting = true;
    window.location.replace('/login');
  }
  return true;
}
