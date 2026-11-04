<script lang="ts">
  import { auth } from '../auth.svelte';

  type Props = {
    onLoginClick: () => void;
  };

  let { onLoginClick }: Props = $props();
</script>

<header>
  <h1>Xmas Tree</h1>

  {#if auth.isAuthenticated && auth.user}
    <div class="user">
      <span>Logged in as <strong>{auth.user.name}</strong></span>
      <button type="button" onclick={() => auth.logout()}>Logout</button>
    </div>
  {:else if auth.status === 'unauthenticated'}
    <button type="button" onclick={onLoginClick}>Login</button>
  {/if}
</header>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  .user {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  strong {
    color: var(--accent);
  }

  button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--accent);
    border-radius: 8px;
    background: transparent;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    background: var(--accent);
    color: var(--on-accent);
  }
</style>
