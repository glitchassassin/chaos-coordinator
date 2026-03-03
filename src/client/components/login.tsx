// Login is handled server-side as plain HTML.
// This component is only used if we ever need a client-side login form.
export function Login() {
  return (
    <div class="empty-state">
      <p>Redirecting to login...</p>
    </div>
  );
}
